"use client"

import { ExternalLink, X } from "lucide-react"
import type { ScoutEvent } from "@/lib/types"

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffS = Math.floor(diffMs / 1000)
  if (diffS < 60) return `${diffS}s ago`
  const diffM = Math.floor(diffS / 60)
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  return `${diffH}h ago`
}

function isNew(iso: string): boolean {
  return Date.now() - new Date(iso).getTime() < 30_000
}

interface ScoutNotificationPanelProps {
  events: ScoutEvent[]
  onDismiss?: (id: string) => void
  onMarketClick?: (marketId: string) => void
}

export function ScoutNotificationPanel({ events, onDismiss, onMarketClick }: ScoutNotificationPanelProps) {
  return (
    <div className="bg-[#0a0a10]/90 backdrop-blur border border-[#2a2a3a] rounded-lg overflow-hidden w-[340px]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#2a2a3a] bg-[#0a0a10]/60">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">🛸</span>
          <span className="text-[10px] uppercase tracking-wider text-[#44aaff]">Signal Scout</span>
        </div>
      </div>

      {/* Event list */}
      <div className="max-h-[50vh] overflow-y-auto">
        {events.length === 0 ? (
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] text-[#556688]">Scanning feeds…</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a24]">
            {events.map((event) => {
              const highValue = event.matchedMarkets.some((m) => m.keywordOverlap >= 0.6)
              const fresh = isNew(event.timestamp)

              return (
                <div
                  key={event.id}
                  className={[
                    "px-3 py-2.5 border-l-2 transition-colors",
                    highValue
                      ? "border-l-[#44aaff] bg-[#111118]/60"
                      : "border-l-[#2a2a3a]",
                    fresh ? "animate-pulse" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {/* Source + time + dismiss */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-[#556688]">
                      {event.article.source}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-[#444455]">{timeAgo(event.timestamp)}</span>
                      {onDismiss && (
                        <button
                          onClick={() => onDismiss(event.id)}
                          className="text-[#444455] hover:text-[#8899aa] transition-colors leading-none"
                          title="Dismiss"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Article headline */}
                  <p className="text-[11px] font-medium text-[#aabbcc] leading-snug line-clamp-2 mb-1">
                    {event.article.title}
                  </p>

                  {/* Snippet */}
                  {event.article.snippet && (
                    <p className="text-[10px] text-[#556666] leading-snug line-clamp-2 mb-2">
                      {event.article.snippet}
                    </p>
                  )}

                  {/* Matched markets */}
                  <div className="space-y-1.5">
                    {event.matchedMarkets.map((market, i) => (
                      <div
                        key={i}
                        className={`bg-[#08080d]/60 rounded border border-[#1a1a24] px-2 py-1.5 ${onMarketClick ? "cursor-pointer hover:border-[#44aaff]/40 transition-colors" : ""}`}
                        onClick={onMarketClick ? () => onMarketClick(market.marketId) : undefined}
                      >
                        {/* Market question */}
                        <p className="text-[10px] text-[#8899aa] leading-snug line-clamp-2 mb-1.5">
                          {market.question}
                        </p>

                        {/* Badges + CTA row */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Keyword overlap */}
                          <span
                            className={[
                              "text-[9px] px-1.5 py-0.5 rounded font-mono",
                              market.keywordOverlap >= 0.6
                                ? "bg-[#44aaff]/15 text-[#44aaff]"
                                : "bg-[#1a1a24] text-[#667788]",
                            ].join(" ")}
                          >
                            {(market.keywordOverlap * 100).toFixed(0)}% match
                          </span>

                          {/* Captured price */}
                          {market.capturedPrice !== undefined && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1a2a1a] text-[#44cc88] font-mono">
                              YES {(market.capturedPrice * 100).toFixed(0)}¢
                            </span>
                          )}

                          <span className="ml-auto flex items-center gap-2">
                            {/* View in galaxy */}
                            {onMarketClick && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onMarketClick(market.marketId) }}
                                className="flex items-center gap-0.5 text-[9px] text-[#8899aa] hover:text-[#ccd0e0] transition-colors uppercase tracking-wider"
                              >
                                View
                              </button>
                            )}

                            {/* Open trade on Polymarket */}
                            {market.url && (
                              <a
                                href={market.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-0.5 text-[9px] text-[#44aaff] hover:text-[#66bbff] transition-colors uppercase tracking-wider"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Trade
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
