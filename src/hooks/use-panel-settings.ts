"use client"

import { useState, useMemo, useCallback } from "react"
import {
  useGlobalChartSettings,
  type ChartSettings,
  type OverlaySettings,
} from "@/contexts/chart-settings"
import type { ChartType, TimeFrame } from "@/lib/chart-types"

type SettingsKey = keyof Omit<ChartSettings, "overlays"> | `overlay.${keyof OverlaySettings}`

type LocalOverrides = Partial<{
  chartType: ChartType
  timeFrame: TimeFrame
  showVolume: boolean
  overlays: Partial<OverlaySettings>
}>

export interface PanelSettingsControls {
  settings: ChartSettings
  isOverridden: (key: SettingsKey) => boolean
  hasAnyOverride: boolean
  setLocal: (key: SettingsKey, value: unknown) => void
  resetLocal: (key: SettingsKey) => void
  resetAll: () => void
}

export function usePanelSettings(_panelId: string): PanelSettingsControls {
  const { settings: global } = useGlobalChartSettings()
  const [overrides, setOverrides] = useState<LocalOverrides>({})

  const settings = useMemo<ChartSettings>(() => {
    return {
      chartType: overrides.chartType ?? global.chartType,
      timeFrame: overrides.timeFrame ?? global.timeFrame,
      showVolume: overrides.showVolume ?? global.showVolume,
      overlays: {
        darwinEstimate:
          overrides.overlays?.darwinEstimate ?? global.overlays.darwinEstimate,
        fairValue:
          overrides.overlays?.fairValue ?? global.overlays.fairValue,
        sentiment:
          overrides.overlays?.sentiment ?? global.overlays.sentiment,
      },
    }
  }, [global, overrides])

  const isOverridden = useCallback(
    (key: SettingsKey): boolean => {
      if (key.startsWith("overlay.")) {
        const overlayKey = key.replace("overlay.", "") as keyof OverlaySettings
        return overrides.overlays?.[overlayKey] !== undefined
      }
      return (overrides as Record<string, unknown>)[key] !== undefined
    },
    [overrides]
  )

  const hasAnyOverride = useMemo(() => {
    if (overrides.chartType !== undefined) return true
    if (overrides.timeFrame !== undefined) return true
    if (overrides.showVolume !== undefined) return true
    if (overrides.overlays) {
      return Object.values(overrides.overlays).some((v) => v !== undefined)
    }
    return false
  }, [overrides])

  const setLocal = useCallback((key: SettingsKey, value: unknown) => {
    if (key.startsWith("overlay.")) {
      const overlayKey = key.replace("overlay.", "") as keyof OverlaySettings
      setOverrides((prev) => ({
        ...prev,
        overlays: { ...prev.overlays, [overlayKey]: value as boolean },
      }))
    } else {
      setOverrides((prev) => ({ ...prev, [key]: value }))
    }
  }, [])

  const resetLocal = useCallback((key: SettingsKey) => {
    if (key.startsWith("overlay.")) {
      const overlayKey = key.replace("overlay.", "") as keyof OverlaySettings
      setOverrides((prev) => {
        const newOverlays = { ...prev.overlays }
        delete newOverlays[overlayKey]
        return { ...prev, overlays: newOverlays }
      })
    } else {
      setOverrides((prev) => {
        const next = { ...prev }
        delete (next as Record<string, unknown>)[key]
        return next
      })
    }
  }, [])

  const resetAll = useCallback(() => {
    setOverrides({})
  }, [])

  return {
    settings,
    isOverridden,
    hasAnyOverride,
    setLocal,
    resetLocal,
    resetAll,
  }
}
