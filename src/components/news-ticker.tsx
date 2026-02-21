"use client"

import type { NewsEvent } from "@/lib/types"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/format"

interface NewsTickerProps {
  events: NewsEvent[]
  running: boolean
  onOpenFeed: () => void
}

export function NewsTicker({ events, running, onOpenFeed }: NewsTickerProps) {
  if (events.length === 0 && !running) return null

  return (
    <div className="border-b border-darwin-border px-6 py-2">
      <div className="flex items-center gap-3">
        {/* LIVE indicator */}
        {running && (
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-darwin-red animate-pulse" />
            <span className="label-caps text-darwin-red">LIVE</span>
          </div>
        )}

        {/* Scrolling headlines */}
        <div className="flex-1 overflow-x-auto">
          <div className="flex items-center gap-4">
            {events.length === 0 ? (
              <span className="text-xs text-darwin-text-muted">
                Monitoring for breaking news...
              </span>
            ) : (
              events.map((event) => (
                <button
                  key={event.id}
                  onClick={onOpenFeed}
                  className="group flex shrink-0 items-center gap-2 text-left transition-colors"
                >
                  {/* Signal indicator dot */}
                  <div
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      event.signalsGenerated.length > 0
                        ? "bg-darwin-green"
                        : event.matchedMarkets.length > 0
                          ? "bg-darwin-blue"
                          : "bg-darwin-text-muted"
                    )}
                  />

                  {/* Source tag */}
                  <span className="label-caps text-darwin-text-muted">
                    {event.article.source.slice(0, 12)}
                  </span>

                  {/* Title */}
                  <span className="font-data text-xs text-darwin-text-secondary group-hover:text-darwin-text transition-colors truncate max-w-[300px]">
                    {event.article.title}
                  </span>

                  {/* Timestamp */}
                  <span className="text-[10px] text-darwin-text-muted shrink-0">
                    {relativeTime(event.timestamp)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
