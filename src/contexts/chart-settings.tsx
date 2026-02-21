"use client"

import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
} from "react"
import type { ChartType, TimeFrame } from "@/lib/chart-types"

export interface OverlaySettings {
  darwinEstimate: boolean
  fairValue: boolean
  sentiment: boolean
}

export interface ChartSettings {
  chartType: ChartType
  timeFrame: TimeFrame
  showVolume: boolean
  overlays: OverlaySettings
}

const DEFAULT_SETTINGS: ChartSettings = {
  chartType: "line",
  timeFrame: "all",
  showVolume: false,
  overlays: {
    darwinEstimate: true,
    fairValue: false,
    sentiment: false,
  },
}

type Action =
  | { type: "SET_CHART_TYPE"; payload: ChartType }
  | { type: "SET_TIME_FRAME"; payload: TimeFrame }
  | { type: "SET_SHOW_VOLUME"; payload: boolean }
  | { type: "SET_OVERLAY"; payload: { key: keyof OverlaySettings; value: boolean } }
  | { type: "RESET" }

function settingsReducer(state: ChartSettings, action: Action): ChartSettings {
  switch (action.type) {
    case "SET_CHART_TYPE":
      return { ...state, chartType: action.payload }
    case "SET_TIME_FRAME":
      return { ...state, timeFrame: action.payload }
    case "SET_SHOW_VOLUME":
      return { ...state, showVolume: action.payload }
    case "SET_OVERLAY":
      return {
        ...state,
        overlays: { ...state.overlays, [action.payload.key]: action.payload.value },
      }
    case "RESET":
      return DEFAULT_SETTINGS
    default:
      return state
  }
}

interface ChartSettingsContextValue {
  settings: ChartSettings
  setChartType: (ct: ChartType) => void
  setTimeFrame: (tf: TimeFrame) => void
  setShowVolume: (v: boolean) => void
  setOverlay: (key: keyof OverlaySettings, value: boolean) => void
  resetSettings: () => void
}

const ChartSettingsContext = createContext<ChartSettingsContextValue | null>(null)

export function ChartSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, dispatch] = useReducer(settingsReducer, DEFAULT_SETTINGS)

  const value: ChartSettingsContextValue = {
    settings,
    setChartType: (ct) => dispatch({ type: "SET_CHART_TYPE", payload: ct }),
    setTimeFrame: (tf) => dispatch({ type: "SET_TIME_FRAME", payload: tf }),
    setShowVolume: (v) => dispatch({ type: "SET_SHOW_VOLUME", payload: v }),
    setOverlay: (key, v) =>
      dispatch({ type: "SET_OVERLAY", payload: { key, value: v } }),
    resetSettings: () => dispatch({ type: "RESET" }),
  }

  return (
    <ChartSettingsContext.Provider value={value}>
      {children}
    </ChartSettingsContext.Provider>
  )
}

export function useGlobalChartSettings(): ChartSettingsContextValue {
  const ctx = useContext(ChartSettingsContext)
  if (!ctx) {
    throw new Error("useGlobalChartSettings must be used within ChartSettingsProvider")
  }
  return ctx
}

export { DEFAULT_SETTINGS }
