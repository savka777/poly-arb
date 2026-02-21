import type { Result } from "@/lib/types"
import type { PricePoint } from "@/data/polymarket"
import type { OhlcDataPoint, VolumeDataPoint } from "@/lib/chart-types"
import { ok, err } from "@/lib/result"
import type { UTCTimestamp } from "lightweight-charts"

export interface OhlcPoint {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number // count of raw price ticks in bucket (activity proxy)
}

function getBucketSeconds(interval: "1d" | "1w" | "1m" | "all"): number {
  switch (interval) {
    case "1d":
      return 5 * 60 // 5 min
    case "1w":
      return 60 * 60 // 1 hr
    case "1m":
      return 4 * 60 * 60 // 4 hr
    case "all":
      return 24 * 60 * 60 // 1 day
  }
}

export function aggregateToOhlc(
  points: PricePoint[],
  interval: "1d" | "1w" | "1m" | "all"
): Result<OhlcPoint[]> {
  if (points.length === 0) {
    return ok([])
  }

  const bucketSize = getBucketSeconds(interval)
  const sorted = [...points].sort((a, b) => a.time - b.time)
  const buckets = new Map<number, PricePoint[]>()

  for (const p of sorted) {
    const bucketKey = Math.floor(p.time / bucketSize) * bucketSize
    const bucket = buckets.get(bucketKey)
    if (bucket) {
      bucket.push(p)
    } else {
      buckets.set(bucketKey, [p])
    }
  }

  const result: OhlcPoint[] = []
  const keys = [...buckets.keys()].sort((a, b) => a - b)

  for (const key of keys) {
    const bucket = buckets.get(key)!
    const prices = bucket.map((p) => p.price)
    result.push({
      time: key,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
      volume: bucket.length,
    })
  }

  return ok(result)
}

export function ohlcToChartData(ohlc: OhlcPoint[]): OhlcDataPoint[] {
  return ohlc.map((p) => ({
    time: p.time as UTCTimestamp,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
  }))
}

export function ohlcToVolumeData(ohlc: OhlcPoint[]): VolumeDataPoint[] {
  return ohlc.map((p) => ({
    time: p.time as UTCTimestamp,
    value: p.volume,
    color: p.close >= p.open ? "#00D47E80" : "#FF444480",
  }))
}
