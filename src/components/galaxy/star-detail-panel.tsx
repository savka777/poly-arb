"use client"

import { X, Newspaper, Brain, Radar, ExternalLink } from "lucide-react"
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

  return (
    <div className="absolute right-4 top-4 bottom-12 w-[380px] z-50 pointer-events-auto">
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
              <a
                href={market.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-xs text-[#44aaff] hover:text-[#66bbff] transition-colors"
              >
                Trade <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#666666] hover:text-[#cccccc] transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Price + Signal */}
        <div className="p-4 border-b border-[#333333]">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[#00ff88]/10 border border-[#00ff88]/20 p-3 text-center">
              <div className="text-sm uppercase tracking-wider font-medium text-[#00ff88]/70 mb-1">
                Yes
              </div>
              <div className="text-2xl font-mono font-bold text-[#00ff88]">
                {(market.probability * 100).toFixed(1)}¢
              </div>
            </div>
            <div className="rounded-lg bg-[#ff4466]/10 border border-[#ff4466]/20 p-3 text-center">
              <div className="text-sm uppercase tracking-wider font-medium text-[#ff4466]/70 mb-1">
                No
              </div>
              <div className="text-2xl font-mono font-bold text-[#ff4466]">
                {((1 - market.probability) * 100).toFixed(1)}¢
              </div>
            </div>
          </div>
          {signal && (() => {
            const edgeCents = (signal.darwinEstimate - market.probability) * 100
            const confidenceColor =
              signal.confidence === "high" ? "#00ff88" :
              signal.confidence === "medium" ? "#ffaa00" :
              "#ff4466"
            return (
              <div className="mt-4 pt-4 border-t border-[#2a2a2a] flex flex-col items-center">
                <span className="text-xs uppercase tracking-wider text-[#99aabb] mb-2 whitespace-nowrap">
                  Polyverse Likelihood Estimate
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-mono text-[#dddde0]">
                    {(signal.darwinEstimate * 100).toFixed(1)}%
                  </span>
                  <span
                    className={`text-lg font-mono font-bold px-2 py-0.5 rounded ${
                      edgeCents >= 0
                        ? "text-[#00ff88] bg-[#00ff88]/10"
                        : "text-[#ff4466] bg-[#ff4466]/10"
                    }`}
                  >
                    {edgeCents >= 0 ? "+" : ""}{edgeCents.toFixed(1)}¢
                  </span>
                </div>
                <span
                  className="mt-2 text-[10px] uppercase tracking-wider font-bold px-2.5 py-0.5 rounded"
                  style={{
                    color: confidenceColor,
                    backgroundColor: `${confidenceColor}15`,
                  }}
                >
                  confidence: {signal.confidence}
                </span>
              </div>
            )
          })()}
        </div>

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
                <span className="text-[9px] text-[#444455] ml-auto">
                  {scoutTimeAgo(signal.createdAt)}
                </span>
              </div>
              <ul className="space-y-2">
                {signal.newsEvents.map((event, i) => {
                  // Try to extract URL from event text (format: "title — source" or contains http)
                  const urlMatch = event.match(/(https?:\/\/[^\s]+)/)
                  const url = urlMatch?.[1]
                  const text = url ? event.replace(url, "").trim() : event
                  return (
                    <li key={i} className="pl-3 border-l border-[#333333]">
                      <p className="text-sm text-[#bbc0cc] leading-snug">{text}</p>
                      {url && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[10px] text-[#44aaff] hover:text-[#66bbff] transition-colors mt-0.5"
                        >
                          Source <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
                    </li>
                  )
                })}
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

      </div>
    </div>
  )
}
