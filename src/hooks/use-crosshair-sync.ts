"use client"

import { useEffect, useRef } from "react"
import { chartEventBus, type CrosshairEvent } from "@/lib/chart-events"
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts"

export function useCrosshairSync(
  chartRef: React.RefObject<IChartApi | null>,
  seriesRef: React.RefObject<ISeriesApi<"Area"> | null>,
  panelId: string,
  enabled: boolean
): void {
  const subscribedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return

    const chart = chartRef.current
    if (!chart) return

    // Emit crosshair moves from this chart
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
    const unsubscribe = chartEventBus.on("crosshair", (event: CrosshairEvent) => {
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

    subscribedRef.current = true

    return () => {
      unsubscribe()
      subscribedRef.current = false
    }
  }, [chartRef, seriesRef, panelId, enabled])
}
