import type { Market, Signal } from "./types"
import { MOCK_MARKETS, MOCK_SIGNALS } from "./mock-data"

export interface ProbabilityPoint {
  timestamp: string
  marketPrice: number
  darwinEstimate: number | null
}

export interface ComparePanel {
  market: Market
  signal: Signal | null
  timeSeries: ProbabilityPoint[]
}

// Deterministic PRNG — mulberry32
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}

export function generateMockTimeSeries(
  market: Market,
  signal: Signal | null
): ProbabilityPoint[] {
  const rng = mulberry32(hashString(market.id))
  const points: ProbabilityPoint[] = []
  const numPoints = 30
  const stddev = 0.015

  // Determine when darwin estimates start (last 5-7 points)
  const darwinStartIdx = signal ? numPoints - 5 - Math.floor(rng() * 3) : numPoints + 1

  let price = market.probability

  for (let i = 0; i < numPoints; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (numPoints - 1 - i))
    const timestamp = date.toISOString().split("T")[0]

    // Random walk for market price
    const noise = (rng() - 0.5) * 2 * stddev
    price = clamp(price + noise, 0.01, 0.99)

    let darwinEstimate: number | null = null
    if (signal && i >= darwinStartIdx) {
      // Gradually diverge toward signal's darwin estimate
      const progress = (i - darwinStartIdx) / (numPoints - 1 - darwinStartIdx)
      const base = price
      const target = signal.darwinEstimate
      darwinEstimate = clamp(base + (target - base) * progress, 0.01, 0.99)
    }

    points.push({ timestamp, marketPrice: price, darwinEstimate })
  }

  // Snap last point to actual values
  if (points.length > 0) {
    points[points.length - 1].marketPrice = market.probability
    if (signal) {
      points[points.length - 1].darwinEstimate = signal.darwinEstimate
    }
  }

  return points
}

export function buildPanelForMarket(market: Market, signalMap: Map<string, Signal>): ComparePanel {
  const signal = signalMap.get(market.id) ?? null
  return {
    market,
    signal,
    timeSeries: generateMockTimeSeries(market, signal),
  }
}

export function getSignalMap(): Map<string, Signal> {
  const map = new Map<string, Signal>()
  for (const s of MOCK_SIGNALS) {
    map.set(s.marketId, s)
  }
  return map
}

export function buildComparePanels(): ComparePanel[] {
  const signalMap = getSignalMap()
  return MOCK_MARKETS.slice(0, 4).map((market) => buildPanelForMarket(market, signalMap))
}
