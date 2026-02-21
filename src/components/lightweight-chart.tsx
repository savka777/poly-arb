"use client"

import { useRef, useEffect } from "react"
import {
  createChart,
  AreaSeries,
  ColorType,
  CrosshairMode,
  LineType,
  LineSeries,
} from "lightweight-charts"
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts"

export interface ChartDataPoint {
  time: UTCTimestamp
  value: number
}

interface LightweightChartProps {
  data: ChartDataPoint[]
  darwinData?: ChartDataPoint[]
  lineColor?: string
  darwinColor?: string
  height?: number
}

export function LightweightChart({
  data,
  darwinData,
  lineColor = "#4488FF",
  darwinColor = "#00D47E",
  height,
}: LightweightChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const mainSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)
  const darwinSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current

    const chart = createChart(container, {
      width: container.clientWidth,
      height: height ?? container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#131722" },
        textColor: "#555566",
        fontFamily: "var(--font-jetbrains), monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: "rgba(42, 42, 58, 0.5)", style: 1 },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(136, 136, 160, 0.3)",
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: "#1C2030",
        },
        horzLine: {
          color: "rgba(136, 136, 160, 0.3)",
          width: 1,
          style: 3,
          labelVisible: true,
          labelBackgroundColor: "#1C2030",
        },
      },
      rightPriceScale: {
        borderColor: "#2A2A3A",
        scaleMargins: { top: 0.08, bottom: 0.04 },
      },
      timeScale: {
        borderColor: "#2A2A3A",
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
    })
    chartRef.current = chart

    // Market price — area chart
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: `${lineColor}25`,
      bottomColor: `${lineColor}00`,
      lineWidth: 2,
      lineType: LineType.Curved,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: lineColor,
      crosshairMarkerBackgroundColor: "#131722",
      crosshairMarkerBorderWidth: 2,
      priceFormat: {
        type: "custom",
        formatter: (price: number) => `${(price * 100).toFixed(0)}%`,
      },
    })
    mainSeriesRef.current = areaSeries

    if (data.length > 0) {
      areaSeries.setData(data)
    }

    // Darwin estimate line (optional overlay)
    if (darwinData && darwinData.length > 0) {
      const darwinSeries = chart.addSeries(LineSeries, {
        color: darwinColor,
        lineWidth: 2,
        lineType: LineType.Curved,
        lineStyle: 2, // dashed
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 3,
        crosshairMarkerBorderColor: darwinColor,
        crosshairMarkerBackgroundColor: "#131722",
        crosshairMarkerBorderWidth: 2,
        priceFormat: {
          type: "custom",
          formatter: (price: number) => `${(price * 100).toFixed(0)}%`,
        },
      })
      darwinSeriesRef.current = darwinSeries
      darwinSeries.setData(darwinData)
    }

    chart.timeScale().fitContent()

    // Responsive resize
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height: h } = entry.contentRect
        if (width > 0) {
          chart.applyOptions({
            width,
            height: height ?? h,
          })
        }
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      mainSeriesRef.current = null
      darwinSeriesRef.current = null
    }
  }, [data, darwinData, lineColor, darwinColor, height])

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ minHeight: height ?? 200 }}
    />
  )
}
