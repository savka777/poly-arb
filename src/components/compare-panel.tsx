"use client"

import { useMemo, useRef } from "react"
import { motion } from "framer-motion"
import { GripVertical, RefreshCw, X } from "lucide-react"
import { LightweightChart } from "@/components/lightweight-chart"
import type { ChartDataPoint } from "@/lib/chart-types"
import { SignalBadge } from "@/components/signal-badge"
import { ChartToolbar } from "@/components/chart-toolbar"
import { OhlcHeader } from "@/components/ohlc-header"
import { formatProbability, formatEV } from "@/lib/format"
import { cn } from "@/lib/utils"
import { usePrices, useOhlc } from "@/hooks/use-prices"
import { usePanelSettings } from "@/hooks/use-panel-settings"
import { useFairValue } from "@/hooks/use-fair-value"
import { useCrosshairSync } from "@/hooks/use-crosshair-sync"
import { ohlcToChartData, ohlcToVolumeData } from "@/lib/ohlc"
import type { Market, Signal } from "@/lib/types"
import type { ProbabilityPoint } from "@/lib/mock-timeseries"
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts"

interface ComparePanelProps {
  panel: {
    market: Market
    signal: Signal | null
    timeSeries: ProbabilityPoint[]
  }
  index: number
  onSwap: (index: number) => void
  onRemove: (index: number) => void
  dragging: boolean
  dragOver: boolean
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDragEnd: () => void
  onDrop: (index: number) => void
  syncCrosshair?: boolean
  hideTimeScale?: boolean
}

export function ComparePanel({
  panel,
  index,
  onSwap,
  onRemove,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  syncCrosshair = false,
  hideTimeScale = false,
}: ComparePanelProps) {
  const { market, signal, timeSeries } = panel
  const panelControls = usePanelSettings(market.id)
  const { settings } = panelControls
  const fv = useFairValue(market.id, signal?.darwinEstimate ?? undefined)

  // Chart refs for crosshair sync
  const chartApiRef = useRef<IChartApi | null>(null)
  const mainSeriesApiRef = useRef<ISeriesApi<"Area"> | null>(null)

  // Crosshair sync
  useCrosshairSync(chartApiRef, mainSeriesApiRef, market.id, syncCrosshair)

  // Fetch real price data
  const { data: priceData } = usePrices(market.clobTokenId, settings.timeFrame)
  const { data: ohlcData } = useOhlc(market.clobTokenId, settings.timeFrame)

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (priceData?.prices && priceData.prices.length > 0) {
      return priceData.prices
        .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.price))
        .map((p) => ({
          time: p.time as UTCTimestamp,
          value: p.price,
        }))
    }
    return timeSeries
      .filter((p) => p.timestamp && Number.isFinite(p.marketPrice))
      .map((p) => ({
        time: (new Date(p.timestamp).getTime() / 1000) as UTCTimestamp,
        value: p.marketPrice,
      }))
      .filter((p) => Number.isFinite(p.time))
  }, [priceData, timeSeries])

  const candleData = useMemo(() => {
    if (!ohlcData?.ohlc) return undefined
    return ohlcToChartData(ohlcData.ohlc)
  }, [ohlcData])

  const volumeData = useMemo(() => {
    if (!ohlcData?.ohlc) return undefined
    return ohlcToVolumeData(ohlcData.ohlc)
  }, [ohlcData])

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

  // OHLC header data from latest candle
  const lastOhlc = ohlcData?.ohlc?.[ohlcData.ohlc.length - 1] ?? null
  const firstOhlc = ohlcData?.ohlc?.[0] ?? null
  const change = lastOhlc && firstOhlc ? lastOhlc.close - firstOhlc.open : undefined
  const changePercent =
    change !== undefined && firstOhlc && firstOhlc.open !== 0
      ? (change / firstOhlc.open) * 100
      : undefined

  return (
    <motion.div
      className={cn(
        "flex h-full min-h-0 flex-col bg-darwin-card overflow-hidden",
        dragOver && "ring-2 ring-inset ring-darwin-blue/50 bg-darwin-blue/5"
      )}
      animate={{
        opacity: dragging ? 0.4 : 1,
        scale: dragging ? 0.97 : 1,
      }}
      transition={{ duration: 0.15 }}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e as unknown as React.DragEvent, index)}
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
            className="ml-1 p-1 text-darwin-text-muted transition-colors hover:bg-darwin-hover hover:text-darwin-text"
            title="Change market"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => onRemove(index)}
            className="p-1 text-darwin-text-muted transition-colors hover:bg-darwin-hover hover:text-darwin-red"
            title="Remove panel"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* OHLC header */}
      <OhlcHeader
        currentOhlc={lastOhlc}
        change={change}
        changePercent={changePercent}
      />

      {/* Toolbar */}
      <ChartToolbar
        settings={settings}
        controls={panelControls}
        compact
      />

      {/* Chart */}
      <div className="flex-1 min-h-0 bg-darwin-bg">
        <LightweightChart
          data={chartData}
          ohlcData={candleData}
          volumeData={volumeData}
          darwinData={darwinData}
          chartType={settings.chartType}
          showVolume={settings.showVolume}
          lineColor="#FFFFFF"
          darwinColor="#00D47E"
          showDarwinEstimate={settings.overlays.darwinEstimate}
          fairValue={fv.fairValue ?? undefined}
          showFairValue={settings.overlays.fairValue}
          hideTimeScale={hideTimeScale}
          chartRef={chartApiRef}
          mainSeriesRef={mainSeriesApiRef}
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
    </motion.div>
  )
}
