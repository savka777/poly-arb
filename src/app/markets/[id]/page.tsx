"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { useMarket } from "@/hooks/use-market"
import { useAnalysis } from "@/hooks/use-analysis"
import { AlphaBar } from "@/components/alpha-bar"
import { SignalBadge } from "@/components/signal-badge"
import { AnalysisFeed, type FeedEntry } from "@/components/analysis-feed"
import { QueryInterface } from "@/components/query-interface"
import {
  formatProbability,
  formatEV,
  formatVolume,
  formatEndDate,
  relativeTime,
} from "@/lib/format"
import { cn } from "@/lib/utils"
import { ChevronLeft } from "lucide-react"

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, isLoading } = useMarket(id)
  const analysis = useAnalysis()
  const [feedEntries, setFeedEntries] = useState<FeedEntry[]>([])

  const market = data?.market
  const signal = data?.signals?.[0]

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
      <div className="min-h-screen bg-darwin-bg">
        <header className="border-b border-darwin-border px-6 py-4">
          <div className="h-5 w-48 animate-pulse rounded-sm bg-darwin-border" />
        </header>
        <div className="px-6 py-6 space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-sm bg-darwin-border" />
          <div className="h-4 w-1/3 animate-pulse rounded-sm bg-darwin-border" />
          <div className="h-64 animate-pulse rounded-sm bg-darwin-border" />
        </div>
      </div>
    )
  }

  const isBullish = signal && signal.ev > 0

  return (
    <div className="min-h-screen bg-darwin-bg">
      {/* Header */}
      <header className="border-b border-darwin-border px-6 py-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-darwin-text-secondary hover:text-darwin-text transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Markets
        </Link>
      </header>

      {/* Market header */}
      <div className="border-b border-darwin-border px-6 py-4">
        <h1 className="text-xl font-semibold text-darwin-text mb-2">
          {market.question}
        </h1>
        <div className="flex items-center gap-3 text-xs text-darwin-text-secondary">
          <span className="label-caps !text-[11px]">POLYMARKET</span>
          <span className="text-darwin-text-muted">·</span>
          <span>Ends {formatEndDate(market.endDate)}</span>
          <span className="text-darwin-text-muted">·</span>
          <span>Vol {formatVolume(market.volume)}</span>
          <span className="text-darwin-text-muted">·</span>
          <span>Liq {formatVolume(market.liquidity)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left panel */}
          <div className="space-y-4">
            {/* Market price */}
            <div className="rounded-sm border border-darwin-border bg-darwin-card p-4">
              <span className="label-caps">Market Price</span>
              <p className="font-data text-3xl font-medium text-darwin-text mt-1">
                {formatProbability(market.probability)}
              </p>
            </div>

            {/* Darwin estimate */}
            {signal && (
              <div className="rounded-sm border border-darwin-border bg-darwin-card p-4">
                <span className="label-caps">Darwin Estimate</span>
                <p className="font-data text-3xl font-medium text-darwin-text mt-1">
                  {formatProbability(signal.darwinEstimate)}
                </p>
                <p
                  className={cn(
                    "font-data text-sm mt-1",
                    isBullish ? "text-darwin-green" : "text-darwin-red"
                  )}
                >
                  {formatEV(signal.ev)} divergence
                </p>
                <div className="mt-3">
                  <AlphaBar
                    darwinEstimate={signal.darwinEstimate}
                    marketPrice={signal.marketPrice}
                    size="md"
                  />
                </div>
              </div>
            )}

            {/* Signal details */}
            {signal && (
              <div className="rounded-sm border border-darwin-border bg-darwin-card p-4 space-y-2">
                <span className="label-caps">Signal Details</span>
                <div className="grid grid-cols-2 gap-y-2 text-sm">
                  <span className="text-darwin-text-secondary">Direction</span>
                  <span
                    className={cn(
                      "font-data font-medium uppercase",
                      isBullish ? "text-darwin-green" : "text-darwin-red"
                    )}
                  >
                    {signal.direction}
                  </span>

                  <span className="text-darwin-text-secondary">EV</span>
                  <span
                    className={cn(
                      "font-data font-medium",
                      isBullish ? "text-darwin-green" : "text-darwin-red"
                    )}
                  >
                    {formatEV(signal.ev)}
                  </span>

                  <span className="text-darwin-text-secondary">Confidence</span>
                  <div>
                    <SignalBadge confidence={signal.confidence} />
                  </div>

                  <span className="text-darwin-text-secondary">News events</span>
                  <span className="font-data text-darwin-text">
                    {signal.newsEvents.length}
                  </span>

                  <span className="text-darwin-text-secondary">Created</span>
                  <span className="text-darwin-text-secondary text-xs">
                    {relativeTime(signal.createdAt)}
                  </span>
                </div>
              </div>
            )}

            {!signal && (
              <div className="rounded-sm border border-darwin-border bg-darwin-card p-4 text-center">
                <p className="text-sm text-darwin-text-muted">
                  No signal for this market yet. Click Analyze to generate one.
                </p>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="space-y-4">
            <div>
              <span className="label-caps mb-2 block">Analysis Feed</span>
              <AnalysisFeed
                entries={allEntries}
                analyzing={analysis.isPending}
              />
              {allEntries.length === 0 && !analysis.isPending && (
                <div className="rounded-sm border border-darwin-border bg-darwin-card p-6 text-center">
                  <p className="text-sm text-darwin-text-muted">
                    No analysis yet. Ask Darwin a question below.
                  </p>
                </div>
              )}
            </div>

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
