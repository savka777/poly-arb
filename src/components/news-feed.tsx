"use client"

import type { NewsEvent } from "@/lib/types"
import { cn } from "@/lib/utils"
import { relativeTime } from "@/lib/format"
import { X, Newspaper } from "lucide-react"

interface NewsFeedProps {
  events: NewsEvent[]
  open: boolean
  onClose: () => void
}

export function NewsFeed({ events, open, onClose }: NewsFeedProps) {
  if (!open) return null

  return (
    <div className="border-b border-darwin-border bg-darwin-bg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darwin-border px-6 py-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-darwin-text-secondary" />
          <span className="text-xs font-medium text-darwin-text">
            News Feed
          </span>
          <span className="text-[11px] text-darwin-text-muted">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-darwin-text-muted hover:text-darwin-text transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Event list */}
      <div className="max-h-[400px] overflow-y-auto px-6 py-3 space-y-2">
        {events.length === 0 ? (
          <p className="py-8 text-center text-xs text-darwin-text-muted">
            No news events yet. The monitor is polling for breaking news.
          </p>
        ) : (
          events.map((event) => (
            <NewsEventCard key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  )
}

function NewsEventCard({ event }: { event: NewsEvent }) {
  const hasSignals = event.signalsGenerated.length > 0
  const hasMatches = event.matchedMarkets.length > 0

  return (
    <div
      className={cn(
        "rounded-sm border bg-darwin-card p-3 border-l-2",
        hasSignals
          ? "border-l-darwin-green border-darwin-border"
          : hasMatches
            ? "border-l-darwin-blue border-darwin-border"
            : "border-l-darwin-text-muted border-darwin-border"
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="label-caps text-darwin-text-muted">
            {event.article.source}
          </span>
          {hasSignals && (
            <span className="label-caps text-darwin-green">
              {event.signalsGenerated.length} signal{event.signalsGenerated.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-[11px] text-darwin-text-muted">
          {relativeTime(event.timestamp)}
        </span>
      </div>

      {/* Headline */}
      <p className="text-sm text-darwin-text leading-snug mb-1">
        {event.article.url ? (
          <a
            href={event.article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-darwin-blue transition-colors"
          >
            {event.article.title}
          </a>
        ) : (
          event.article.title
        )}
      </p>

      {/* Matched markets */}
      {hasMatches && (
        <div className="mt-2">
          <span className="label-caps">
            matched {event.matchedMarkets.length} market{event.matchedMarkets.length !== 1 ? "s" : ""}
          </span>
          <ul className="mt-1 space-y-0.5">
            {event.matchedMarkets.map((m) => (
              <li
                key={m.marketId}
                className="text-xs text-darwin-text-secondary flex items-start gap-1.5"
              >
                <span className="text-darwin-text-muted mt-0.5">→</span>
                <a
                  href={`/markets/${m.marketId}`}
                  className="hover:text-darwin-blue transition-colors"
                >
                  {m.question}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
