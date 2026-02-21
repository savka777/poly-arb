"use client"

import { useMemo } from "react"
import { GripVertical, RefreshCw } from "lucide-react"
import { LightweightChart } from "@/components/lightweight-chart"
import type { ChartDataPoint } from "@/components/lightweight-chart"
import { SignalBadge } from "@/components/signal-badge"
import { formatProbability, formatEV } from "@/lib/format"
import { cn } from "@/lib/utils"
import { usePrices } from "@/hooks/use-prices"
import type { Market, Signal } from "@/lib/types"
import type { ProbabilityPoint } from "@/lib/mock-timeseries"
import type { UTCTimestamp } from "lightweight-charts"

interface ComparePanelProps {
  panel: {
    market: Market
    signal: Signal | null
    timeSeries: ProbabilityPoint[]
  }
  index: number
  onSwap: (index: number) => void
  dragging: boolean
  dragOver: boolean
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onDrop: (index: number) => void
}

export function ComparePanel({
  panel,
  index,
  onSwap,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
}: ComparePanelProps) {
  const { market, signal, timeSeries } = panel

  // Try real price data
  const { data: priceData } = usePrices(market.clobTokenId, "all")

  const chartData = useMemo<ChartDataPoint[]>(() => {
    // Use real data if available
    if (priceData?.prices && priceData.prices.length > 0) {
      return priceData.prices.map((p) => ({
        time: p.time as UTCTimestamp,
        value: p.price,
      }))
    }
    // Fallback to mock time series
    return timeSeries.map((p) => ({
      time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
      value: p.marketPrice,
    }))
  }, [priceData, timeSeries])

  const darwinData = useMemo<ChartDataPoint[] | undefined>(() => {
    if (!signal) return undefined
    const points = timeSeries
      .filter((p) => p.darwinEstimate !== null)
      .map((p) => ({
        time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
        value: p.darwinEstimate!,
      }))
    return points.length > 0 ? points : undefined
  }, [signal, timeSeries])

  const lineColor = signal
    ? signal.direction === "no"
      ? "#FF4444"
      : "#00D47E"
    : "#4488FF"

  return (
    <div
      className={cn(
        "flex flex-col bg-darwin-card transition-opacity",
        dragging && "opacity-40",
        dragOver && "ring-1 ring-inset ring-darwin-blue"
      )}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDragEnd={onDragEnd}
      onDrop={() => onDrop(index)}
    >
      {/* Header */}
      <div className="flex h-10 items-center gap-1 border-b border-darwin-border px-1">
        <div className="cursor-grab text-darwin-text-muted hover:text-darwin-text-secondary active:cursor-grabbing">
          <GripVertical className="h-3.5 w-3.5" />
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-darwin-text" title={market.question}>
          {market.question}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-data text-sm text-darwin-text">
            {formatProbability(market.probability)}
          </span>
          {signal ? (
            <SignalBadge confidence={signal.confidence} />
          ) : (
            <span className="text-[11px] text-darwin-text-muted">No signal</span>
          )}
          <button
            onClick={() => onSwap(index)}
            className="ml-1 rounded-sm p-1 text-darwin-text-muted transition-colors hover:bg-darwin-hover hover:text-darwin-text"
            title="Change market"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 bg-darwin-bg">
        <LightweightChart
          data={chartData}
          darwinData={darwinData}
          lineColor={lineColor}
        />
      </div>

      {/* Footer */}
      <div className="flex h-7 items-center gap-4 border-t border-darwin-border px-3">
        {signal ? (
          <>
            <span className="font-data text-[11px]">
              <span className="text-darwin-text-muted">EV </span>
              <span
                className={cn(
                  signal.ev >= 0 ? "text-darwin-green" : "text-darwin-red"
                )}
              >
                {formatEV(signal.ev)}
              </span>
            </span>
            <span className="font-data text-[11px]">
              <span className="text-darwin-text-muted">Darwin </span>
              <span className="text-darwin-text">
                {formatProbability(signal.darwinEstimate)}
              </span>
            </span>
            <span className="font-data text-[11px]">
              <span className="text-darwin-text-muted">Market </span>
              <span className="text-darwin-text-secondary">
                {formatProbability(signal.marketPrice)}
              </span>
            </span>
          </>
        ) : (
          <span className="font-data text-[11px] text-darwin-text-muted">
            No analysis available
          </span>
        )}
      </div>
    </div>
  )
}
