"use client"

import { useEffect, useRef } from "react"
import { chartEventBus, type CrosshairEvent, type VisibleRangeEvent } from "@/lib/chart-events"
import type { IChartApi, ISeriesApi, UTCTimestamp, LogicalRange } from "lightweight-charts"

export function useCrosshairSync(
  chartRef: React.RefObject<IChartApi | null>,
  seriesRef: React.RefObject<ISeriesApi<"Area"> | null>,
  panelId: string,
  enabled: boolean
): void {
  // Guard against re-entrant range updates
  const isSyncingRange = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const chart = chartRef.current
    if (!chart) return

    // --- Crosshair sync ---
    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        chartEventBus.emit("crosshair", {
          sourceId: panelId,
          time: null,
          price: null,
        })
        return
      }

      let price: number | null = null
      for (const [, data] of param.seriesData) {
        if ("value" in data) {
          price = data.value
          break
        }
        if ("close" in data) {
          price = data.close
          break
        }
      }

      chartEventBus.emit("crosshair", {
        sourceId: panelId,
        time: param.time as number,
        price,
      })
    })

    // Listen for crosshair events from other charts
    const unsubCrosshair = chartEventBus.on("crosshair", (event: CrosshairEvent) => {
      if (event.sourceId === panelId) return
      const c = chartRef.current
      const s = seriesRef.current
      if (!c || !s) return

      if (event.time === null) {
        c.clearCrosshairPosition()
      } else {
        c.setCrosshairPosition(event.price ?? 0, event.time as UTCTimestamp, s)
      }
    })

    // --- Visible range (scroll/zoom) sync ---
    const onVisibleRangeChange = (range: LogicalRange | null) => {
      if (isSyncingRange.current || !range) return
      chartEventBus.emit("visibleRange", {
        sourceId: panelId,
        from: range.from,
        to: range.to,
      })
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleRangeChange)

    const unsubRange = chartEventBus.on("visibleRange", (event: VisibleRangeEvent) => {
      if (event.sourceId === panelId) return
      const c = chartRef.current
      if (!c) return

      // Prevent re-entrant updates
      isSyncingRange.current = true
      c.timeScale().setVisibleLogicalRange({ from: event.from, to: event.to })
      // Use requestAnimationFrame to reset flag after the range change propagates
      requestAnimationFrame(() => {
        isSyncingRange.current = false
      })
    })

    return () => {
      unsubCrosshair()
      unsubRange()
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleRangeChange)
    }
  }, [chartRef, seriesRef, panelId, enabled])
}
