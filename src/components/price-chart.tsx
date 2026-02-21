"use client"

import { useEffect, useRef } from "react"
import {
  createChart,
  createSeriesMarkers,
  AreaSeries,
  type UTCTimestamp,
  type SeriesMarkerBar,
  type SeriesMarkerBarPosition,
  type SeriesMarkerShape,
} from "lightweight-charts"

export interface PricePoint {
  time: UTCTimestamp
  value: number
}

export interface EventMarker {
  time: UTCTimestamp
  label: string
  color: string
  shape?: SeriesMarkerShape
  position?: SeriesMarkerBarPosition
}

interface PriceChartProps {
  data: PricePoint[]
  markers?: EventMarker[]
  height?: number
}

export function PriceChart({ data, markers = [], height = 320 }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
      layout: {
        background: { color: "#1C2030" },
        textColor: "#8888A0",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#2A2A3A" },
        horzLines: { color: "#2A2A3A" },
      },
      crosshair: {
        vertLine: { color: "#4488FF44", labelBackgroundColor: "#242838" },
        horzLine: { color: "#4488FF44", labelBackgroundColor: "#242838" },
      },
      rightPriceScale: {
        borderColor: "#2A2A3A",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#2A2A3A",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: UTCTimestamp) => {
          const d = new Date(time * 1000)
          return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`
        },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#4488FF",
      topColor: "#4488FF33",
      bottomColor: "#4488FF05",
      lineWidth: 2,
      priceFormat: {
        type: "percent",
        precision: 1,
        minMove: 0.1,
      },
    })

    // Convert 0-1 probabilities to percentages
    const chartData = data.map((p) => ({ time: p.time, value: p.value * 100 }))
    series.setData(chartData)

    if (markers.length > 0) {
      const seriesMarkers: SeriesMarkerBar<UTCTimestamp>[] = markers.map((m) => ({
        time: m.time,
        position: m.position ?? "belowBar",
        color: m.color,
        shape: m.shape ?? "arrowUp",
        text: m.label,
        size: 1.5,
      }))
      createSeriesMarkers(series, seriesMarkers)
    }

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    }
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      chart.remove()
    }
  }, [data, markers, height])

  return <div ref={containerRef} style={{ height }} />
}
