"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { usePrices, useOrderBook } from "@/hooks/use-prices"
import { LightweightChart } from "@/components/lightweight-chart"
import { formatProbability, formatEV, formatVolume, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"
import type { Market, Signal } from "@/lib/types"
import type { ChartDataPoint } from "@/lib/chart-types"
import type { UTCTimestamp } from "lightweight-charts"

interface SignalDetailResponse {
  signal: Signal
  market: Market | null
}

function useSignalDetail(id: string) {
  return useQuery<SignalDetailResponse>({
    queryKey: ["signal-detail", id],
    queryFn: async () => {
      const res = await fetch(`/api/signals/${id}`)
      if (!res.ok) throw new Error("Signal not found")
      return res.json()
    },
  })
}

function directionVerb(signal: Signal): string {
  if (signal.ev > 0.1) return "significantly underpriced"
  if (signal.ev > 0.05) return "underpriced"
  if (signal.ev > 0) return "slightly underpriced"
  if (signal.ev < -0.1) return "significantly overpriced"
  if (signal.ev < -0.05) return "overpriced"
  return "slightly overpriced"
}

function PriceChart({ tokenId, darwinEstimate }: { tokenId: string; darwinEstimate: number }) {
  const { data, isLoading } = usePrices(tokenId, "1w")

  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.prices) return []
    return data.prices.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.price,
    }))
  }, [data])

  const darwinData: ChartDataPoint[] = useMemo(() => {
    if (chartData.length < 2) return []
    return [
      { time: chartData[0].time, value: darwinEstimate },
      { time: chartData[chartData.length - 1].time, value: darwinEstimate },
    ]
  }, [chartData, darwinEstimate])

  if (isLoading) {
    return (
      <div className="h-[360px] flex items-center justify-center bg-darwin-bg border border-darwin-border">
        <span className="text-sm text-darwin-text-muted">Loading chart...</span>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-[360px] flex items-center justify-center bg-darwin-bg border border-darwin-border">
        <span className="text-sm text-darwin-text-muted">No price data available</span>
      </div>
    )
  }

  return (
    <div className="h-[360px] border border-darwin-border">
      <LightweightChart
        data={chartData}
        darwinData={darwinData}
        chartType="area"
        showDarwinEstimate={true}
        height={360}
      />
    </div>
  )
}

function OrderBook({ tokenId }: { tokenId: string }) {
  const { data, isLoading } = useOrderBook(tokenId)

  if (isLoading) {
    return (
      <div className="py-8 text-center">
        <span className="text-sm text-darwin-text-muted">Loading order book...</span>
      </div>
    )
  }

  if (!data || (data.bids.length === 0 && data.asks.length === 0)) {
    return (
      <div className="py-8 text-center">
        <span className="text-sm text-darwin-text-muted">No order book data</span>
      </div>
    )
  }

  const bids = [...data.bids].sort((a, b) => b.price - a.price).slice(0, 12)
  const asks = [...data.asks].sort((a, b) => a.price - b.price).slice(0, 12)

  let bidCum = 0
  const bidLevels = bids.map((b) => { bidCum += b.size; return { ...b, cum: bidCum } })
  let askCum = 0
  const askLevels = asks.map((a) => { askCum += a.size; return { ...a, cum: askCum } })
  const maxCum = Math.max(
    bidLevels.length > 0 ? bidLevels[bidLevels.length - 1].cum : 1,
    askLevels.length > 0 ? askLevels[askLevels.length - 1].cum : 1,
  )
  const spread = bids[0] && asks[0] ? asks[0].price - bids[0].price : 0

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-medium text-darwin-text">Order Book</h2>
        <span className="text-sm text-darwin-text-muted" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
          Spread {(spread * 100).toFixed(1)}¢
        </span>
      </div>
      <div className="flex gap-px border border-darwin-border">
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2.5 text-xs text-darwin-text-muted border-b border-darwin-border"
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
            <span>Bid</span>
            <span>Size</span>
          </div>
          {bidLevels.map((level, i) => (
            <div key={i} className="relative flex items-center justify-between px-4 py-2">
              <div className="absolute inset-y-0 right-0 bg-darwin-green/8"
                style={{ width: `${(level.cum / maxCum) * 100}%` }} />
              <span className="relative text-sm tabular-nums text-darwin-green"
                style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                {(level.price * 100).toFixed(1)}¢
              </span>
              <span className="relative text-sm tabular-nums text-darwin-text-secondary"
                style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                ${level.size.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex-1 border-l border-darwin-border">
          <div className="flex items-center justify-between px-4 py-2.5 text-xs text-darwin-text-muted border-b border-darwin-border"
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
            <span>Ask</span>
            <span>Size</span>
          </div>
          {askLevels.map((level, i) => (
            <div key={i} className="relative flex items-center justify-between px-4 py-2">
              <div className="absolute inset-y-0 left-0 bg-darwin-red/8"
                style={{ width: `${(level.cum / maxCum) * 100}%` }} />
              <span className="relative text-sm tabular-nums text-darwin-red"
                style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                {(level.price * 100).toFixed(1)}¢
              </span>
              <span className="relative text-sm tabular-nums text-darwin-text-secondary"
                style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                ${level.size.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SignalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, isLoading } = useSignalDetail(id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-darwin-bg">
        <header className="border-b border-darwin-border px-6 py-4">
          <Link href="/" className="text-sm text-darwin-text-muted hover:text-darwin-text transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </header>
        <div className="flex items-center justify-center py-20">
          <span className="text-darwin-text-muted">Loading signal...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-darwin-bg">
        <header className="border-b border-darwin-border px-6 py-4">
          <Link href="/" className="text-sm text-darwin-text-muted hover:text-darwin-text transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
        </header>
        <div className="flex items-center justify-center py-20">
          <span className="text-darwin-text-muted">Signal not found</span>
        </div>
      </div>
    )
  }

  const { signal, market } = data
  const isBullish = signal.ev > 0

  return (
    <div className="min-h-screen bg-darwin-bg">
      {/* Header */}
      <header className="border-b border-darwin-border px-6 py-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <Link href="/" className="text-sm text-darwin-text-muted hover:text-darwin-text transition-colors flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back to feed
          </Link>
          {market && (
            <Link
              href={`/compare?add=${market.id}`}
              className="text-sm text-darwin-blue hover:text-darwin-blue/80 transition-colors"
            >
              Open in compare view →
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Badges */}
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-sm font-bold uppercase tracking-wider px-3 py-1.5",
              isBullish
                ? "text-darwin-green bg-darwin-green/10 border border-darwin-green/20"
                : "text-darwin-red bg-darwin-red/10 border border-darwin-red/20"
            )}
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
          >
            {isBullish ? "Bullish" : "Bearish"} · {formatEV(signal.ev)}
          </span>
          <span
            className={cn(
              "text-sm uppercase tracking-wider px-3 py-1.5 border",
              signal.confidence === "high"
                ? "text-darwin-green border-darwin-green/20"
                : signal.confidence === "medium"
                  ? "text-darwin-text-secondary border-darwin-border"
                  : "text-darwin-text-muted border-darwin-border/50"
            )}
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
          >
            {signal.confidence} confidence
          </span>
          <span className="text-sm text-darwin-text-muted">
            {relativeTime(signal.createdAt)}
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl font-semibold text-darwin-text leading-tight">
          {signal.marketQuestion}
        </h1>

        {/* Summary */}
        <p className="text-lg text-darwin-text-secondary leading-relaxed">
          Darwin estimates this market is{" "}
          <span className={cn("font-medium", isBullish ? "text-darwin-green" : "text-darwin-red")}>
            {directionVerb(signal)}
          </span>
          . Market price is{" "}
          <span className="text-darwin-text font-medium">{formatProbability(signal.marketPrice)}</span>
          , Darwin fair value is{" "}
          <span className="text-darwin-text font-medium">{formatProbability(signal.darwinEstimate)}</span>
          .
        </p>

        {/* Stats */}
        <div className="flex items-center gap-8" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-darwin-text-muted">Market Price</span>
            <span className="text-2xl text-darwin-text font-medium">{formatProbability(signal.marketPrice)}</span>
          </div>
          <div className="text-darwin-text-muted text-xl">→</div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-darwin-text-muted">Darwin Estimate</span>
            <span className="text-2xl text-darwin-green font-medium">{formatProbability(signal.darwinEstimate)}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-darwin-text-muted">Expected Value</span>
            <span className={cn("text-2xl font-bold", isBullish ? "text-darwin-green" : "text-darwin-red")}>
              {formatEV(signal.ev)}
            </span>
          </div>
          {market && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-darwin-text-muted">Volume</span>
              <span className="text-2xl text-darwin-text font-medium">{formatVolume(market.volume)}</span>
            </div>
          )}
        </div>

        {/* Chart */}
        {market?.clobTokenId && (
          <div>
            <h2 className="text-base font-medium text-darwin-text mb-3">Price History</h2>
            <PriceChart tokenId={market.clobTokenId} darwinEstimate={signal.darwinEstimate} />
          </div>
        )}

        {/* Analysis */}
        {signal.reasoning && (
          <div>
            <h2 className="text-base font-medium text-darwin-text mb-3">Analysis</h2>
            <div className="text-base text-darwin-text-secondary leading-relaxed whitespace-pre-line border-l-2 border-darwin-border/50 pl-5">
              {signal.reasoning}
            </div>
          </div>
        )}

        {/* Sources */}
        {signal.newsEvents.length > 0 && (
          <div>
            <h2 className="text-base font-medium text-darwin-text mb-3">Sources</h2>
            <div className="space-y-3">
              {signal.newsEvents.map((event, i) => {
                // Parse "[Source] Title" format
                const match = event.match(/^\[([^\]]+)\]\s*(.*)$/)
                const source = match ? match[1] : null
                const title = match ? match[2] : event

                return (
                  <div key={i} className="flex items-start gap-3 p-4 bg-darwin-card border border-darwin-border/50">
                    <span className="text-sm text-darwin-text-muted shrink-0" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
                      [{i + 1}]
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-darwin-text">{title}</p>
                      {source && (
                        <p className="text-xs text-darwin-text-muted mt-1">{source}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Order Book */}
        {market?.clobTokenId && (
          <OrderBook tokenId={market.clobTokenId} />
        )}
      </main>
    </div>
  )
}
