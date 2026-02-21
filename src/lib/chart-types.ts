import type { UTCTimestamp } from "lightweight-charts"

export type ChartType = "area" | "line" | "candlestick"
export type TimeFrame = "1d" | "1w" | "1m" | "all"

export interface ChartDataPoint {
  time: UTCTimestamp
  value: number
}

export interface OhlcDataPoint {
  time: UTCTimestamp
  open: number
  high: number
  low: number
  close: number
}

export interface VolumeDataPoint {
  time: UTCTimestamp
  value: number
  color: string
}

export interface OverlaySeries {
  id: string
  label: string
  color: string
  data: ChartDataPoint[]
}

export const OVERLAY_COLORS = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#A78BFA", "#F97316", "#06B6D4", "#EC4899",
] as const
