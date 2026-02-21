"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { TrendingUp, TrendingDown, Zap } from "lucide-react"
import { formatProbability, formatEV, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Signal } from "@/lib/types"

interface SignalTickerProps {
  signals: Signal[]
}

function MiniSparkline({ ev }: { ev: number }) {
  // Simple visual indicator bar
  const width = Math.min(Math.abs(ev) / 0.3 * 100, 100)
  return (
    <div className="h-[3px] w-16 bg-darwin-border/50 overflow-hidden">
      <div
        className={cn(
          "h-full transition-all duration-700",
          ev > 0 ? "bg-darwin-green" : "bg-darwin-red"
        )}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}

function TickerEntry({ signal, isNew }: { signal: Signal; isNew: boolean }) {
  const isBullish = signal.ev > 0

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b border-darwin-border/50 px-4 py-2.5 transition-all duration-500",
        isNew && "bg-darwin-blue/5 border-l-2 border-l-darwin-blue",
        !isNew && "border-l-2 border-l-transparent"
      )}
    >
      {/* Direction icon */}
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center",
        isBullish ? "bg-darwin-green/10" : "bg-darwin-red/10"
      )}>
        {isBullish
          ? <TrendingUp className="h-3.5 w-3.5 text-darwin-green" />
          : <TrendingDown className="h-3.5 w-3.5 text-darwin-red" />
        }
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-darwin-text leading-snug">
          {signal.marketQuestion}
        </p>
        <div className="mt-0.5 flex items-center gap-3">
          <span className="text-[10px] text-darwin-text-muted">
            {signal.confidence.toUpperCase()}
          </span>
          <MiniSparkline ev={signal.ev} />
        </div>
      </div>

      {/* EV + prices */}
      <div className="shrink-0 text-right">
        <span className={cn(
          "font-data text-sm font-semibold",
          isBullish ? "text-darwin-green" : "text-darwin-red"
        )}>
          {formatEV(signal.ev)}
        </span>
        <div className="mt-0.5 flex items-center gap-2 justify-end">
          <span className="font-data text-[10px] text-darwin-text-muted">
            {formatProbability(signal.marketPrice)}
          </span>
          <span className="text-[10px] text-darwin-text-muted">→</span>
          <span className="font-data text-[10px] text-darwin-text">
            {formatProbability(signal.darwinEstimate)}
          </span>
        </div>
      </div>

      {/* Timestamp */}
      <span className="shrink-0 text-[10px] text-darwin-text-muted w-16 text-right">
        {relativeTime(signal.createdAt)}
      </span>
    </div>
  )
}

export function SignalTicker({ signals }: SignalTickerProps) {
  const [prevCount, setPrevCount] = useState(0)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)

  // Sort by creation time, newest first
  const sorted = useMemo(() => {
    return [...signals].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [signals])

  // Track new signals for animation
  useEffect(() => {
    if (signals.length > prevCount && prevCount > 0) {
      const latestIds = new Set(
        sorted.slice(0, signals.length - prevCount).map((s) => s.id)
      )
      setNewIds(latestIds)
      const t = setTimeout(() => setNewIds(new Set()), 3000)
      return () => clearTimeout(t)
    }
    setPrevCount(signals.length)
  }, [signals.length, prevCount, sorted])

  if (sorted.length === 0) {
    return (
      <div className="border border-darwin-border bg-darwin-card">
        <div className="flex items-center gap-2 border-b border-darwin-border px-4 py-2.5">
          <Zap className="h-3.5 w-3.5 text-darwin-text-muted" />
          <h3 className="text-xs font-medium text-darwin-text uppercase tracking-wider">
            Live Signal Feed
          </h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-darwin-blue animate-pulse" />
            <span className="text-xs text-darwin-text-muted">Scanner running, waiting for signals...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-darwin-border bg-darwin-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darwin-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Zap className="h-3.5 w-3.5 text-darwin-yellow" />
          <h3 className="text-xs font-medium text-darwin-text uppercase tracking-wider">
            Live Signal Feed
          </h3>
          <div className="h-1.5 w-1.5 rounded-full bg-darwin-green animate-pulse" />
        </div>
        <span className="font-data text-[10px] text-darwin-text-muted">
          {sorted.length} signal{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Scrollable signal list */}
      <div ref={containerRef} className="max-h-[400px] overflow-y-auto">
        {sorted.map((signal) => (
          <TickerEntry
            key={signal.id}
            signal={signal}
            isNew={newIds.has(signal.id)}
          />
        ))}
      </div>
    </div>
  )
}
