"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import {
  createChart,
  AreaSeries,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineType,
  LineStyle,
} from "lightweight-charts"
import type {
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
  IPriceLine,
} from "lightweight-charts"
import type {
  ChartType,
  ChartDataPoint,
  OhlcDataPoint,
  VolumeDataPoint,
  OverlaySeries,
} from "@/lib/chart-types"

export type { ChartDataPoint } from "@/lib/chart-types"

interface LightweightChartProps {
  data: ChartDataPoint[]
  ohlcData?: OhlcDataPoint[]
  volumeData?: VolumeDataPoint[]
  darwinData?: ChartDataPoint[]
  overlays?: OverlaySeries[]
  chartType?: ChartType
  showVolume?: boolean
  lineColor?: string
  darwinColor?: string
  fairValue?: number
  showFairValue?: boolean
  showDarwinEstimate?: boolean
  hideTimeScale?: boolean
  height?: number
  onCrosshairMove?: (time: UTCTimestamp | null, price: number | null) => void
  chartRef?: React.MutableRefObject<IChartApi | null>
  mainSeriesRef?: React.MutableRefObject<ISeriesApi<"Area"> | null>
}

const BG_COLOR = "#0A0A0F"

function formatPercent(price: number): string {
  const pct = price * 100
  if (pct >= 10) return `${pct.toFixed(1)}%`
  if (pct >= 1) return `${pct.toFixed(2)}%`
  return `${pct.toFixed(3)}%`
}

const PRICE_FORMAT = {
  type: "custom" as const,
  formatter: formatPercent,
}

const VOLUME_FORMAT = {
  type: "custom" as const,
  formatter: (val: number) => {
    const pct = val * 100
    if (pct >= 10) return pct.toFixed(1)
    if (pct >= 1) return pct.toFixed(2)
    return pct.toFixed(3)
  },
}

export function LightweightChart({
  data,
  ohlcData,
  volumeData,
  darwinData,
  overlays,
  chartType = "line",
  showVolume = false,
  lineColor = "#FFFFFF",
  darwinColor = "#00D47E",
  fairValue,
  showFairValue = false,
  showDarwinEstimate,
  hideTimeScale = false,
  height,
  onCrosshairMove,
  chartRef: externalChartRef,
  mainSeriesRef: externalMainSeriesRef,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  // Crosshair tooltip state
  interface TooltipData {
    x: number
    y: number
    price: number | null
    ohlc: { o: number; h: number; l: number; c: number } | null
    darwin: number | null
    vol: number | null
    overlayPrices: { label: string; color: string; price: number }[]
    time: string
  }
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)

  // Series refs
  const areaSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const lineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const darwinSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
  const fairValueLineRef = useRef<{ line: IPriceLine; series: ISeriesApi<"Area"> | ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> } | null>(null)
  const lastPriceLineRef = useRef<{ line: IPriceLine; series: ISeriesApi<"Area"> | ISeriesApi<"Line"> | ISeriesApi<"Candlestick"> } | null>(null)
  const overlaySeriesRefs = useRef<Map<string, { series: ISeriesApi<"Line">; label: string; color: string }>>(new Map())
  const disposedRef = useRef(false)

  // Props refs for stable lifecycle
  const propsRef = useRef({
    lineColor,
    darwinColor,
    chartType,
    showVolume,
    fairValue,
    showFairValue,
    showDarwinEstimate,
  })
  propsRef.current = {
    lineColor,
    darwinColor,
    chartType,
    showVolume,
    fairValue,
    showFairValue,
    showDarwinEstimate,
  }

  // Mount effect — create chart and all series ONCE
  useEffect(() => {
    if (!containerRef.current) return
    disposedRef.current = false

    const container = containerRef.current

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: BG_COLOR },
        textColor: "#555566",
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(42, 42, 58, 0.3)", style: 1 },
        horzLines: { color: "rgba(42, 42, 58, 0.3)", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(136, 136, 160, 0.4)",
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: "#1A1A2E",
        },
        horzLine: {
          color: "rgba(136, 136, 160, 0.4)",
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: "#1A1A2E",
        },
      },
      rightPriceScale: {
        borderColor: "#2A2A3A",
        autoScale: true,
        scaleMargins: { top: 0.05, bottom: 0.15 },
      },
      timeScale: {
        borderColor: "#2A2A3A",
        timeVisible: !hideTimeScale,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightOffset: 2,
        barSpacing: 24,
        minBarSpacing: 12,
        visible: !hideTimeScale,
      },
    })
    chartRef.current = chart
    if (externalChartRef) externalChartRef.current = chart

    // Area series
    const area = chart.addSeries(AreaSeries, {
      lineColor: "#FFFFFF",
      topColor: "rgba(255,255,255,0.06)",
      bottomColor: "rgba(255,255,255,0)",
      lineWidth: 1,
      lineType: LineType.Curved,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBorderColor: "#FFFFFF",
      crosshairMarkerBackgroundColor: BG_COLOR,
      crosshairMarkerBorderWidth: 1,
      priceFormat: PRICE_FORMAT,
      visible: false,
    })
    areaSeriesRef.current = area
    if (externalMainSeriesRef) externalMainSeriesRef.current = area

    // Line series
    const line = chart.addSeries(LineSeries, {
      color: "#FFFFFF",
      lineWidth: 1,
      lineType: LineType.Curved,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBorderColor: "#FFFFFF",
      crosshairMarkerBackgroundColor: BG_COLOR,
      crosshairMarkerBorderWidth: 1,
      priceFormat: PRICE_FORMAT,
      visible: false,
    })
    lineSeriesRef.current = line

    // Candlestick series
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: "#00D47E",
      downColor: "#FF4444",
      borderUpColor: "#00D47E",
      borderDownColor: "#FF4444",
      wickUpColor: "#00D47E",
      wickDownColor: "#FF4444",
      priceFormat: PRICE_FORMAT,
      visible: false,
    })
    candleSeriesRef.current = candle

    // Volume histogram (shows price range / volatility per candle)
    const vol = chart.addSeries(HistogramSeries, {
      color: "#26a69a",
      base: 0,
      priceFormat: VOLUME_FORMAT,
      priceScaleId: "volume",
      visible: false,
    })
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.7, bottom: 0 },
      borderVisible: false,
    })
    volumeSeriesRef.current = vol

    // Darwin estimate overlay
    const darwin = chart.addSeries(LineSeries, {
      color: "#00D47E",
      lineWidth: 2,
      lineType: LineType.Curved,
      lineStyle: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      crosshairMarkerBorderColor: "#00D47E",
      crosshairMarkerBackgroundColor: BG_COLOR,
      crosshairMarkerBorderWidth: 2,
      priceFormat: PRICE_FORMAT,
      visible: false,
    })
    darwinSeriesRef.current = darwin

    // Crosshair move handler — tooltip + external callback
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setTooltip(null)
        if (onCrosshairMove) onCrosshairMove(null, null)
        return
      }

      const areaData = param.seriesData.get(area)
      const lineData = param.seriesData.get(line)
      const candleData = param.seriesData.get(candle)
      const volData = param.seriesData.get(vol)
      const darwinDataPt = param.seriesData.get(darwin)

      let price: number | null = null
      if (areaData && "value" in areaData) price = areaData.value
      else if (lineData && "value" in lineData) price = lineData.value
      else if (candleData && "close" in candleData) price = candleData.close

      if (onCrosshairMove) onCrosshairMove(param.time as UTCTimestamp, price)

      const t = param.time as number
      const date = new Date(t * 1000)
      const timeStr = date.toLocaleString(undefined, {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })

      // Gather overlay series data
      const overlayPrices: { label: string; color: string; price: number }[] = []
      for (const [, entry] of overlaySeriesRefs.current) {
        const d = param.seriesData.get(entry.series)
        if (d && "value" in d) {
          overlayPrices.push({ label: entry.label, color: entry.color, price: d.value })
        }
      }

      setTooltip({
        x: param.point.x,
        y: param.point.y,
        price,
        ohlc: candleData && "open" in candleData
          ? { o: candleData.open, h: candleData.high, l: candleData.low, c: candleData.close }
          : null,
        darwin: darwinDataPt && "value" in darwinDataPt ? darwinDataPt.value : null,
        vol: volData && "value" in volData ? volData.value : null,
        overlayPrices,
        time: timeStr,
      })
    })

    // Keep most recent data on right edge when container resizes
    let disposed = false
    const parentEl = container.parentElement
    const observer = new ResizeObserver(() => {
      if (disposed) return
      try { chart.timeScale().scrollToRealTime() } catch { /* chart may be disposed */ }
    })
    if (parentEl) observer.observe(parentEl)

    return () => {
      disposed = true
      disposedRef.current = true
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      if (externalChartRef) externalChartRef.current = null
      if (externalMainSeriesRef) externalMainSeriesRef.current = null
      areaSeriesRef.current = null
      lineSeriesRef.current = null
      candleSeriesRef.current = null
      volumeSeriesRef.current = null
      darwinSeriesRef.current = null
      if (fairValueLineRef.current) {
        try { fairValueLineRef.current.series.removePriceLine(fairValueLineRef.current.line) } catch { /* */ }
        fairValueLineRef.current = null
      }
      if (lastPriceLineRef.current) {
        try { lastPriceLineRef.current.series.removePriceLine(lastPriceLineRef.current.line) } catch { /* */ }
        lastPriceLineRef.current = null
      }
      overlaySeriesRefs.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height])

  // Data + visibility effect
  useEffect(() => {
    if (disposedRef.current) return
    const { chartType: ct, lineColor: lc, darwinColor: dc, showVolume: sv, showDarwinEstimate: sde } =
      propsRef.current

    const cleanData = data.filter(
      (d) => Number.isFinite(d.time) && Number.isFinite(d.value)
    )

    // Set data on the active series, hide others
    const isArea = ct === "area"
    const isLine = ct === "line"
    const isCandle = ct === "candlestick"

    // Area
    if (areaSeriesRef.current) {
      areaSeriesRef.current.applyOptions({
        visible: isArea,
        lineColor: lc,
        topColor: `${lc}15`,
        bottomColor: `${lc}00`,
        crosshairMarkerBorderColor: lc,
      })
      if (isArea && cleanData.length > 0) {
        areaSeriesRef.current.setData(cleanData)
      } else if (isArea) {
        areaSeriesRef.current.setData([])
      }
    }

    // Line
    if (lineSeriesRef.current) {
      lineSeriesRef.current.applyOptions({
        visible: isLine,
        color: lc,
        crosshairMarkerBorderColor: lc,
      })
      if (isLine && cleanData.length > 0) {
        lineSeriesRef.current.setData(cleanData)
      } else if (isLine) {
        lineSeriesRef.current.setData([])
      }
    }

    // Candlestick
    if (candleSeriesRef.current) {
      candleSeriesRef.current.applyOptions({ visible: isCandle })
      if (isCandle && ohlcData && ohlcData.length > 0) {
        candleSeriesRef.current.setData(ohlcData)
      } else if (isCandle) {
        candleSeriesRef.current.setData([])
      }
    }

    // Volume — always set data, toggle visibility
    if (volumeSeriesRef.current) {
      if (volumeData && volumeData.length > 0) {
        volumeSeriesRef.current.setData(volumeData)
      } else {
        volumeSeriesRef.current.setData([])
      }
      volumeSeriesRef.current.applyOptions({ visible: sv && !!volumeData?.length })
    }

    // Darwin
    const showDarwin = sde !== undefined ? sde : !!darwinData
    const cleanDarwin = darwinData?.filter(
      (d) => Number.isFinite(d.time) && Number.isFinite(d.value)
    )
    if (darwinSeriesRef.current) {
      darwinSeriesRef.current.applyOptions({
        visible: showDarwin && !!cleanDarwin?.length,
        color: dc,
        crosshairMarkerBorderColor: dc,
      })
      if (cleanDarwin && cleanDarwin.length > 0) {
        darwinSeriesRef.current.setData(cleanDarwin)
      }
    }

    // Fit content
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent()
    }
  }, [data, ohlcData, volumeData, darwinData, chartType, lineColor, darwinColor, showVolume, showDarwinEstimate])

  // Overlay series management
  useEffect(() => {
    if (disposedRef.current) return
    const chart = chartRef.current
    if (!chart) return

    const currentOverlays = overlays ?? []
    const currentIds = new Set(currentOverlays.map((o) => o.id))
    const existingRefs = overlaySeriesRefs.current

    // Remove series no longer in overlays
    for (const [id, entry] of existingRefs) {
      if (!currentIds.has(id)) {
        try {
          chart.removeSeries(entry.series)
        } catch {
          // series may already be removed
        }
        existingRefs.delete(id)
      }
    }

    // Add or update each overlay
    for (const overlay of currentOverlays) {
      const cleanData = overlay.data.filter(
        (d) => Number.isFinite(d.time) && Number.isFinite(d.value)
      )

      const existing = existingRefs.get(overlay.id)
      if (existing) {
        // Update existing series
        existing.series.applyOptions({ color: overlay.color })
        existing.label = overlay.label
        existing.color = overlay.color
        if (cleanData.length > 0) {
          existing.series.setData(cleanData)
        }
      } else {
        // Create new series
        const series = chart.addSeries(LineSeries, {
          color: overlay.color,
          lineWidth: 2,
          lineType: LineType.Curved,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 3,
          crosshairMarkerBorderColor: overlay.color,
          crosshairMarkerBackgroundColor: BG_COLOR,
          crosshairMarkerBorderWidth: 1,
          priceFormat: PRICE_FORMAT,
        })
        if (cleanData.length > 0) {
          series.setData(cleanData)
        }
        existingRefs.set(overlay.id, { series, label: overlay.label, color: overlay.color })
      }
    }
  }, [overlays])

  // Last-price line — persistent horizontal line + y-axis pill at current price
  useEffect(() => {
    if (disposedRef.current) return
    // Determine the active main series
    const activeSeries =
      chartType === "candlestick"
        ? candleSeriesRef.current
        : chartType === "area"
          ? areaSeriesRef.current
          : lineSeriesRef.current

    if (!activeSeries) return

    // Remove previous last-price line from whatever series it was on
    if (lastPriceLineRef.current) {
      try {
        lastPriceLineRef.current.series.removePriceLine(lastPriceLineRef.current.line)
      } catch {
        // series may have been removed
      }
      lastPriceLineRef.current = null
    }

    // Get last price
    let lastPrice: number | undefined
    if (chartType === "candlestick" && ohlcData && ohlcData.length > 0) {
      lastPrice = ohlcData[ohlcData.length - 1].close
    } else if (data.length > 0) {
      lastPrice = data[data.length - 1].value
    }

    if (lastPrice !== undefined && Number.isFinite(lastPrice)) {
      const isUp = data.length >= 2 ? lastPrice >= data[0].value : true
      const pillColor = isUp ? "#00D47E" : "#FF4444"

      const pl = activeSeries.createPriceLine({
        price: lastPrice,
        color: pillColor,
        lineWidth: 1,
        lineStyle: LineStyle.Dotted,
        axisLabelVisible: true,
        title: "",
      })
      lastPriceLineRef.current = { line: pl, series: activeSeries }
    }
  }, [data, ohlcData, chartType])

  // Fair value price line effect
  useEffect(() => {
    if (disposedRef.current) return
    // Determine which series to attach the price line to
    const series = areaSeriesRef.current ?? lineSeriesRef.current
    if (!series) return

    // Remove existing price line from whatever series it was on
    if (fairValueLineRef.current) {
      try {
        fairValueLineRef.current.series.removePriceLine(fairValueLineRef.current.line)
      } catch {
        // may have already been removed
      }
      fairValueLineRef.current = null
    }

    if (showFairValue && fairValue !== undefined && fairValue !== null) {
      const pl = series.createPriceLine({
        price: fairValue,
        color: "#FFAA00",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Fair Value",
      })
      fairValueLineRef.current = { line: pl, series }
    }
  }, [fairValue, showFairValue, chartType])

  // Toggle time scale visibility dynamically
  useEffect(() => {
    if (disposedRef.current || !chartRef.current) return
    chartRef.current.timeScale().applyOptions({
      visible: !hideTimeScale,
      timeVisible: !hideTimeScale,
    })
  }, [hideTimeScale])

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ minHeight: 0 }}>
      <div ref={containerRef} className="absolute inset-0" />
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 border border-darwin-border/60 bg-[#111118ee] backdrop-blur-sm px-2.5 py-1.5 text-[11px] font-data shadow-lg"
          style={{
            left: Math.min(tooltip.x + 16, (containerRef.current?.clientWidth ?? 400) - 200),
            top: Math.max(tooltip.y - 70, 4),
            minWidth: 140,
          }}
        >
          <div className="text-darwin-text-muted mb-1 text-[10px]">{tooltip.time}</div>
          {tooltip.ohlc ? (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-darwin-text-muted w-3">O</span>
                <span className="text-darwin-text">{formatPercent(tooltip.ohlc.o)}</span>
                <span className="text-darwin-text-muted w-3 ml-1">H</span>
                <span className="text-darwin-text">{formatPercent(tooltip.ohlc.h)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-darwin-text-muted w-3">L</span>
                <span className="text-darwin-text">{formatPercent(tooltip.ohlc.l)}</span>
                <span className="text-darwin-text-muted w-3 ml-1">C</span>
                <span className={tooltip.ohlc.c >= tooltip.ohlc.o ? "text-darwin-green" : "text-darwin-red"}>
                  {formatPercent(tooltip.ohlc.c)}
                </span>
              </div>
            </div>
          ) : tooltip.price !== null ? (
            <div className="flex items-center gap-1.5">
              <span className="text-darwin-text font-medium text-xs">{formatPercent(tooltip.price)}</span>
            </div>
          ) : null}
          {tooltip.darwin !== null && (
            <div className="mt-1 pt-1 border-t border-darwin-border/40">
              <span className="text-darwin-text-muted">Darwin </span>
              <span className="text-darwin-green">{formatPercent(tooltip.darwin)}</span>
            </div>
          )}
          {tooltip.vol !== null && (
            <div className="mt-0.5">
              <span className="text-darwin-text-muted">Range </span>
              <span className="text-darwin-text">{formatPercent(tooltip.vol)}</span>
            </div>
          )}
          {tooltip.overlayPrices.length > 0 && (
            <div className="mt-1 pt-1 border-t border-darwin-border/40 space-y-0.5">
              {tooltip.overlayPrices.map((op) => (
                <div key={op.label} className="flex items-center gap-1.5">
                  <span className="inline-block h-[2px] w-2" style={{ backgroundColor: op.color }} />
                  <span className="text-darwin-text-muted truncate max-w-[80px]">{op.label}</span>
                  <span style={{ color: op.color }}>{formatPercent(op.price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
