"use client"

import { useMemo } from "react"
import { formatProbability, formatEV, formatVolume, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Market, Signal } from "@/lib/types"

interface SignalFeedProps {
  markets: Market[]
  signalMap: Map<string, Signal>
}

interface FeedItem {
  market: Market
  signal: Signal
}

function directionVerb(signal: Signal): string {
  if (signal.ev > 0.1) return "Significantly underpriced"
  if (signal.ev > 0.05) return "Underpriced"
  if (signal.ev > 0) return "Slightly underpriced"
  if (signal.ev < -0.1) return "Significantly overpriced"
  if (signal.ev < -0.05) return "Overpriced"
  return "Slightly overpriced"
}

function confidenceLabel(c: "low" | "medium" | "high"): string {
  return c === "high" ? "High confidence" : c === "medium" ? "Medium confidence" : "Low confidence"
}

function FeedEntry({ market, signal }: { market: Market; signal: Signal }) {
  const absEv = Math.abs(signal.ev)
  const isBullish = signal.ev > 0
  const isHigh = absEv >= 0.1
  const isMedium = absEv >= 0.05

  return (
    <div className="group relative">
      <a
        href={`/signals/${signal.id}`}
        className="flex gap-5 px-3 py-5 -mx-3 rounded transition-colors hover:bg-darwin-card/50"
      >
        {/* Timeline dot */}
        <div className="shrink-0 pt-1.5">
          <div
            className={cn(
              "h-3 w-3 rounded-full border-2",
              isHigh
                ? isBullish
                  ? "bg-darwin-green border-darwin-green"
                  : "bg-darwin-red border-darwin-red"
                : isMedium
                  ? isBullish
                    ? "bg-darwin-green/50 border-darwin-green"
                    : "bg-darwin-red/50 border-darwin-red"
                  : "bg-transparent border-darwin-text-muted"
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-base text-darwin-text leading-snug">
            <span className="font-medium">{market.question}</span>
            {" "}
            <span className={cn("font-medium", isBullish ? "text-darwin-green" : "text-darwin-red")}>
              — {directionVerb(signal)} by {formatEV(signal.ev)}
            </span>
          </p>

          {signal.reasoning && (
            <p className="mt-2 text-sm text-darwin-text-secondary leading-relaxed line-clamp-2">
              {signal.reasoning}
            </p>
          )}

          {signal.newsEvents.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {signal.newsEvents.slice(0, 3).map((event, i) => (
                <span key={i} className="inline-block text-xs text-darwin-text-muted bg-darwin-card px-2.5 py-1 border border-darwin-border/50 leading-tight">
                  {event.length > 70 ? event.slice(0, 68) + "…" : event}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          <div className="mt-2.5 flex items-center gap-3 text-xs" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
            <span className="text-darwin-text-muted">{relativeTime(signal.createdAt)}</span>
            <span className="text-darwin-border">·</span>
            <span className="text-darwin-text-secondary">Mkt {formatProbability(signal.marketPrice)}</span>
            <span className="text-darwin-border">→</span>
            <span className="text-darwin-text">Darwin {formatProbability(signal.darwinEstimate)}</span>
            <span className="text-darwin-border">·</span>
            <span className={cn(
              "uppercase tracking-wider",
              signal.confidence === "high" ? "text-darwin-green"
                : signal.confidence === "medium" ? "text-darwin-text-secondary"
                  : "text-darwin-text-muted"
            )}>
              {confidenceLabel(signal.confidence)}
            </span>
            <span className="text-darwin-border">·</span>
            <span className="text-darwin-text-muted">{formatVolume(market.volume)}</span>
            {market.category && (
              <>
                <span className="text-darwin-border">·</span>
                <span className="text-darwin-text-muted capitalize">{market.category}</span>
              </>
            )}
          </div>
        </div>

        {/* EV badge */}
        <div className="shrink-0 flex flex-col items-end gap-1.5 pt-0.5">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums leading-none",
              isBullish ? "text-darwin-green" : "text-darwin-red"
            )}
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
          >
            {formatEV(signal.ev)}
          </span>
          <span className="text-xs text-darwin-text-muted tabular-nums" style={{ fontFamily: "var(--font-jetbrains), monospace" }}>
            {formatProbability(market.probability)}
          </span>
        </div>
      </a>
    </div>
  )
}

export function SignalFeed({ markets, signalMap }: SignalFeedProps) {
  const feedItems = useMemo(() => {
    const items: FeedItem[] = []
    for (const market of markets) {
      const signal = signalMap.get(market.id)
      if (signal) items.push({ market, signal })
    }
    items.sort((a, b) => new Date(b.signal.createdAt).getTime() - new Date(a.signal.createdAt).getTime())
    return items
  }, [markets, signalMap])

  if (feedItems.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-base text-darwin-text-muted">No signals yet. Scanning markets...</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto divide-y divide-darwin-border/30">
      {feedItems.map(({ market, signal }, idx) => (
        <div key={signal.id} className="relative">
          {idx < feedItems.length - 1 && (
            <div className="absolute left-[9px] top-[48px] bottom-0 w-px bg-darwin-border/30" />
          )}
          <FeedEntry market={market} signal={signal} />
        </div>
      ))}
    </div>
  )
}
