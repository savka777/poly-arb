"use client"

import { X, TrendingUp, TrendingDown, Newspaper, Brain, Radar } from "lucide-react"
import type { StarData } from "@/hooks/use-galaxy-data"
import type { ScoutEvent } from "@/lib/types"

function scoutTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffS = Math.floor(diffMs / 1000)
  if (diffS < 60) return `${diffS}s ago`
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  return `${diffH}h ago`
}

interface StarDetailPanelProps {
  star: StarData
  onClose: () => void
  scoutEvents?: ScoutEvent[]
}

export function StarDetailPanel({ star, onClose, scoutEvents }: StarDetailPanelProps) {
  const { market, signal } = star
  const ev = signal?.ev ?? 0
  const isBullish = ev > 0
  const evPct = (Math.abs(ev) * 100).toFixed(1)

  return (
    <div className="absolute right-4 top-4 bottom-4 w-[380px] z-50 pointer-events-auto">
      <div className="h-full bg-[#181818]/95 backdrop-blur-xl border border-[#333333] rounded-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[#333333]">
          <div className="flex-1 pr-3">
            <h2 className="text-base font-medium text-[#dddde0] leading-tight">
              {market.question}
            </h2>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs uppercase tracking-wider text-[#99aabb] bg-[#222222] px-2 py-0.5 rounded">
                {market.category ?? "uncategorized"}
              </span>
              <span className="text-xs text-[#99aabb]">
                Vol: ${(market.volume / 1e6).toFixed(1)}M
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#666666] hover:text-[#cccccc] transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Price comparison */}
        <div className="p-4 border-b border-[#333333]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-[#99aabb] mb-1">
                Yes
              </div>
              <div className="text-2xl font-mono text-[#dddde0]">
                {(market.probability * 100).toFixed(1)}¢
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[#99aabb] mb-1">
                No
              </div>
              <div className="text-2xl font-mono text-[#dddde0]">
                {((1 - market.probability) * 100).toFixed(1)}¢
              </div>
            </div>
          </div>
          {signal && (
            <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
              <div className="text-xs uppercase tracking-wider text-[#99aabb] mb-1">
                Darwin Estimate
              </div>
              <div className="text-lg font-mono text-[#dddde0]">
                {(signal.darwinEstimate * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {/* EV Badge */}
        {signal && (
          <div className="p-4 border-b border-[#333333]">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded ${
                  isBullish
                    ? "bg-[#00ff88]/10 text-[#00ff88]"
                    : "bg-[#ff4466]/10 text-[#ff4466]"
                }`}
              >
                {isBullish ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                <span className="text-lg font-mono font-bold">
                  {isBullish ? "+" : "-"}{evPct}pp
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-wider text-[#99aabb]">
                  Expected Value
                </span>
                <span className="text-xs text-[#bbc0cc]">
                  {signal.confidence} confidence
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Reasoning */}
          {signal?.reasoning && (
            <div className="p-4 border-b border-[#333333]">
              <div className="flex items-center gap-1.5 mb-2">
                <Brain className="h-3.5 w-3.5 text-[#99aabb]" />
                <span className="text-xs uppercase tracking-wider text-[#99aabb]">
                  Agent Reasoning
                </span>
              </div>
              <p className="text-sm text-[#bbc0cc] leading-relaxed">
                {signal.reasoning}
              </p>
            </div>
          )}

          {/* News events */}
          {signal?.newsEvents && signal.newsEvents.length > 0 && (
            <div className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <Newspaper className="h-3.5 w-3.5 text-[#99aabb]" />
                <span className="text-xs uppercase tracking-wider text-[#99aabb]">
                  News Events ({signal.newsEvents.length})
                </span>
              </div>
              <ul className="space-y-2">
                {signal.newsEvents.map((event, i) => (
                  <li key={i} className="text-sm text-[#bbc0cc] pl-3 border-l border-[#333333]">
                    {event}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Scout alerts for this market */}
          {scoutEvents && scoutEvents.length > 0 && (
            <div className="p-4 border-b border-[#333333]">
              <div className="flex items-center gap-1.5 mb-2">
                <Radar className="h-3.5 w-3.5 text-[#44aaff]" />
                <span className="text-xs uppercase tracking-wider text-[#44aaff]">
                  Scout Alerts ({scoutEvents.length})
                </span>
              </div>
              <ul className="space-y-2">
                {scoutEvents.map((evt) => {
                  const matchedMarket = evt.matchedMarkets.find((m) => m.marketId === market.id)
                  return (
                    <li key={evt.id} className="pl-3 border-l-2 border-[#44aaff]/30">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[9px] uppercase tracking-wider text-[#556688]">{evt.article.source}</span>
                        <span className="text-[9px] text-[#444455]">{scoutTimeAgo(evt.timestamp)}</span>
                        {matchedMarket && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-[#44aaff]/15 text-[#44aaff] font-mono">
                            {(matchedMarket.keywordOverlap * 100).toFixed(0)}% match
                          </span>
                        )}
                      </div>
                      <a
                        href={evt.article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#aabbcc] hover:text-[#ccd0e0] leading-snug line-clamp-2 transition-colors"
                      >
                        {evt.article.title}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* No signal state */}
          {!signal && (
            <div className="p-4 text-center">
              <p className="text-xs text-[#99aabb]">
                No signal detected for this trade yet.
              </p>
              <p className="text-xs text-[#778899] mt-1">
                The agent hasn&apos;t analyzed this trade or found no divergence.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#333333] flex items-center justify-between">
          <a
            href={`/markets/${market.id}`}
            className="text-xs text-[#7ca8e8] hover:text-[#a8c8f0] transition-colors uppercase tracking-wider"
          >
            Full Details →
          </a>
          {signal && (
            <span className="text-xs text-[#778899]">
              {new Date(signal.createdAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
