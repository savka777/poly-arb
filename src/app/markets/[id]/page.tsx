"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { useMarket } from "@/hooks/use-market"
import { usePrices } from "@/hooks/use-prices"
import { useAnalysis } from "@/hooks/use-analysis"
import { LightweightChart } from "@/components/lightweight-chart"
import type { ChartDataPoint } from "@/components/lightweight-chart"
import { AlphaBar } from "@/components/alpha-bar"
import { SignalBadge } from "@/components/signal-badge"
import { AnalysisFeed, type FeedEntry } from "@/components/analysis-feed"
import { QueryInterface } from "@/components/query-interface"
import { CompareLink } from "@/components/compare-link"
import {
  formatProbability,
  formatEV,
  formatVolume,
  formatEndDate,
  relativeTime,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { ChevronLeft, TrendingDown, TrendingUp } from "lucide-react"
import type { UTCTimestamp } from "lightweight-charts"

type TimeRange = "1d" | "1w" | "1m" | "all"

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, isLoading } = useMarket(id)
  const analysis = useAnalysis()
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([])
  const [timeRange, setTimeRange] = useState<TimeRange>("all")

  const market = data?.market
  const signal = data?.signals?.[0]

  const { data: priceData, isLoading: pricesLoading } = usePrices(
    market?.clobTokenId,
    timeRange
  )

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!priceData?.prices || priceData.prices.length === 0) return []
    return priceData.prices.map((p) => ({
      time: p.time as UTCTimestamp,
      value: p.price,
    }))
  }, [priceData])

  const darwinData = useMemo<ChartDataPoint[] | undefined>(() => {
    if (!signal || chartData.length === 0) return undefined
    // Show Darwin estimate as a line on the last ~20% of the chart
    const startIdx = Math.max(0, Math.floor(chartData.length * 0.8))
    return chartData.slice(startIdx).map((p) => ({
      time: p.time,
      value: signal.darwinEstimate,
    }))
  }, [signal, chartData])

  const initialFeedEntries = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = []
    if (signal) {
      entries.push({ type: "signal", signal })
    }
    return entries
  }, [signal])

  const allEntries = useMemo(() => {
    return [...feedEntries, ...initialFeedEntries]
  }, [feedEntries, initialFeedEntries])

  function handleAnalyze(query: string) {
    const now = new Date().toISOString()
    setFeedEntries((prev) => [
      { type: "user_query", text: query, timestamp: now },
      ...prev,
    ])

    analysis.mutate(id, {
      onSuccess: (result) => {
        const newEntries: FeedEntry[] = []
        for (const tc of result.toolCalls) {
          newEntries.push({ type: "tool_call", toolCall: tc })
        }
        if (result.signal) {
          newEntries.push({ type: "signal", signal: result.signal })
        }
        setFeedEntries((prev) => [...newEntries, ...prev])
      },
      onError: (err) => {
        setFeedEntries((prev) => [
          {
            type: "error",
            message: err.message,
            timestamp: new Date().toISOString(),
          },
          ...prev,
        ])
      },
    })
  }

  if (isLoading || !market) {
    return (
      <div className="flex h-screen flex-col bg-darwin-bg">
        <header className="flex h-12 shrink-0 items-center border-b border-darwin-border px-6">
          <div className="h-4 w-48 animate-pulse rounded-sm bg-darwin-border" />
        </header>
        <div className="flex-1 animate-pulse bg-darwin-card" />
      </div>
    )
  }

  const isBullish = signal && signal.ev > 0
  const lineColor = signal
    ? signal.direction === "no"
      ? "#FF4444"
      : "#00D47E"
    : "#4488FF"

  const timeRanges: TimeRange[] = ["1d", "1w", "1m", "all"]

  return (
    <div className="flex h-screen flex-col bg-darwin-bg">
      {/* Header bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-darwin-border px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-darwin-text-secondary hover:text-darwin-text transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Markets
          </Link>
          <div className="h-4 w-px bg-darwin-border" />
          <span className="label-caps !text-[10px]">
            {market.category ?? "polymarket"}
          </span>
        </div>
        <CompareLink />
      </header>

      {/* Main content: chart left, activity right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Chart area */}
        <div className="flex flex-1 flex-col border-r border-darwin-border">
          {/* Market info header */}
          <div className="border-b border-darwin-border px-4 py-3">
            <h1 className="text-base font-semibold text-darwin-text leading-tight">
              {market.question}
            </h1>
            <div className="mt-2 flex items-center gap-4">
              <span className={cn(
                "font-data text-2xl font-semibold",
                signal
                  ? isBullish ? "text-darwin-green" : "text-darwin-red"
                  : "text-darwin-text"
              )}>
                {formatProbability(market.probability)}
              </span>
              {signal && (
                <span className={cn(
                  "flex items-center gap-1 font-data text-sm",
                  isBullish ? "text-darwin-green" : "text-darwin-red"
                )}>
                  {isBullish
                    ? <TrendingUp className="h-3.5 w-3.5" />
                    : <TrendingDown className="h-3.5 w-3.5" />
                  }
                  {formatEV(signal.ev)}
                </span>
              )}
              {signal && <SignalBadge confidence={signal.confidence} />}
            </div>
          </div>

          {/* Chart */}
          <div className="relative flex-1">
            {pricesLoading && chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-darwin-text-muted animate-pulse">
                  Loading price data...
                </span>
              </div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-xs text-darwin-text-muted">
                  No price history available for this market
                </span>
              </div>
            ) : (
              <LightweightChart
                data={chartData}
                darwinData={darwinData}
                lineColor={lineColor}
                darwinColor={signal?.direction === "no" ? "#FF4444" : "#00D47E"}
              />
            )}
          </div>

          {/* Chart footer — stats + time range selector */}
          <div className="flex items-center justify-between border-t border-darwin-border px-4 py-2">
            <div className="flex items-center gap-6 text-xs">
              <span className="text-darwin-text-secondary">
                {formatVolume(market.volume)} Vol
              </span>
              <span className="text-darwin-text-muted">|</span>
              <span className="text-darwin-text-secondary">
                Ends {formatEndDate(market.endDate)}
              </span>
              {signal && (
                <>
                  <span className="text-darwin-text-muted">|</span>
                  <span className="font-data">
                    <span className="text-darwin-text-muted">Darwin </span>
                    <span className="text-darwin-text">
                      {formatProbability(signal.darwinEstimate)}
                    </span>
                  </span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {timeRanges.map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium uppercase transition-colors",
                    timeRange === range
                      ? "bg-darwin-elevated text-darwin-text"
                      : "text-darwin-text-muted hover:text-darwin-text-secondary"
                  )}
                >
                  {range === "all" ? "ALL" : range.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right — Activity monitor / Chat */}
        <div className="flex w-[380px] shrink-0 flex-col">
          {/* Activity header */}
          <div className="border-b border-darwin-border px-4 py-3">
            <h2 className="text-sm font-medium text-darwin-text">
              Darwin Analysis
            </h2>
            <p className="mt-0.5 text-[11px] text-darwin-text-muted">
              AI-powered market intelligence
            </p>
          </div>

          {/* Signal summary card */}
          {signal && (
            <div className="border-b border-darwin-border px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="label-caps">Signal</span>
                <span className="text-[10px] text-darwin-text-muted">
                  {relativeTime(signal.createdAt)}
                </span>
              </div>
              <AlphaBar
                darwinEstimate={signal.darwinEstimate}
                marketPrice={signal.marketPrice}
                size="md"
              />
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <span className="block label-caps !text-[9px]">Market</span>
                  <span className="font-data text-sm text-darwin-text">
                    {formatProbability(signal.marketPrice)}
                  </span>
                </div>
                <div>
                  <span className="block label-caps !text-[9px]">Darwin</span>
                  <span className={cn(
                    "font-data text-sm",
                    isBullish ? "text-darwin-green" : "text-darwin-red"
                  )}>
                    {formatProbability(signal.darwinEstimate)}
                  </span>
                </div>
                <div>
                  <span className="block label-caps !text-[9px]">EV</span>
                  <span className={cn(
                    "font-data text-sm font-medium",
                    isBullish ? "text-darwin-green" : "text-darwin-red"
                  )}>
                    {formatEV(signal.ev)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Analysis feed (chat-style) */}
          <div className="flex-1 overflow-y-auto">
            <AnalysisFeed
              entries={allEntries}
              analyzing={analysis.isPending}
            />
            {allEntries.length === 0 && !analysis.isPending && (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-darwin-text-muted">
                  Ask Darwin to analyze this market.
                </p>
              </div>
            )}
          </div>

          {/* Query input at bottom */}
          <div className="border-t border-darwin-border p-3">
            <QueryInterface
              onSubmit={handleAnalyze}
              loading={analysis.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
