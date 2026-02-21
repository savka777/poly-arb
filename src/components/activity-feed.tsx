"use client"

import { useEffect, useRef } from "react"
import { X } from "lucide-react"
import type { ActivityEntry } from "@/lib/types"
import { cn } from "@/lib/utils"

const SOURCE_COLORS: Record<string, string> = {
  orchestrator: "text-darwin-blue",
  "price-watcher": "text-yellow-400",
  "news-watcher": "text-purple-400",
  "time-watcher": "text-orange-400",
  analyze: "text-cyan-400",
  sync: "text-darwin-green",
}

const LEVEL_STYLES: Record<string, string> = {
  info: "text-darwin-text-secondary",
  warn: "text-yellow-400",
  error: "text-red-400",
}

function formatTime(timestamp: string): string {
  const d = new Date(timestamp)
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function ActivityFeed({
  entries,
  open,
  onClose,
}: {
  entries: ActivityEntry[]
  open: boolean
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [entries.length, open])

  if (!open) return null

  return (
    <div className="border-b border-darwin-border bg-darwin-card">
      <div className="flex items-center justify-between px-4 py-2 border-b border-darwin-border">
        <span className="text-xs font-medium text-darwin-text-secondary uppercase tracking-wide">
          System Activity
        </span>
        <button
          onClick={onClose}
          className="text-darwin-text-muted hover:text-darwin-text transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="max-h-64 overflow-y-auto px-4 py-2 space-y-1 font-mono text-[11px]"
      >
        {entries.length === 0 ? (
          <p className="text-darwin-text-muted py-4 text-center">
            No activity yet
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
              <span className="text-darwin-text-muted shrink-0 w-[60px]">
                {formatTime(entry.timestamp)}
              </span>
              <span
                className={cn(
                  "shrink-0 w-[100px] truncate",
                  SOURCE_COLORS[entry.source] ?? "text-darwin-text-secondary"
                )}
              >
                {entry.source}
              </span>
              <span
                className={cn(
                  "flex-1",
                  LEVEL_STYLES[entry.level] ?? "text-darwin-text-secondary"
                )}
              >
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
