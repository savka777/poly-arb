"use client"

import { cn } from "@/lib/utils"
import type { OhlcPoint } from "@/lib/ohlc"

interface OhlcHeaderProps {
  currentOhlc?: OhlcPoint | null
  change?: number
  changePercent?: number
}

function fmt(v: number): string {
  return (v * 100).toFixed(1)
}

export function OhlcHeader({ currentOhlc, change, changePercent }: OhlcHeaderProps) {
  if (!currentOhlc) return null

  const isPositive = (change ?? 0) >= 0
  const changeColor = isPositive ? "text-darwin-green" : "text-darwin-red"

  return (
    <div className="flex items-center gap-3 px-2 py-0.5 font-data text-[11px]">
      <span className="text-darwin-text-muted">
        O:<span className="text-darwin-text">{fmt(currentOhlc.open)}</span>
      </span>
      <span className="text-darwin-text-muted">
        H:<span className="text-darwin-text">{fmt(currentOhlc.high)}</span>
      </span>
      <span className="text-darwin-text-muted">
        L:<span className="text-darwin-text">{fmt(currentOhlc.low)}</span>
      </span>
      <span className="text-darwin-text-muted">
        C:<span className="text-darwin-text">{fmt(currentOhlc.close)}</span>
      </span>
      {change !== undefined && changePercent !== undefined && (
        <span className={cn(changeColor)}>
          {isPositive ? "+" : ""}{fmt(change)} ({isPositive ? "+" : ""}{changePercent.toFixed(1)}%)
        </span>
      )}
      <span className="text-darwin-text-muted">
        Vol:<span className="text-darwin-text">{currentOhlc.volume}</span>
      </span>
    </div>
  )
}
