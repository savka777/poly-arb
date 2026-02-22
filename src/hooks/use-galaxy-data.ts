"use client"

import { useMemo } from "react"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import type { Market, Signal } from "@/lib/types"
import type { CloudLayerConfig } from "@/components/galaxy/particle-cloud"

export interface StarData {
  market: Market
  signal: Signal | undefined
  localPosition: [number, number, number]
  size: number
  color: string
  emissiveIntensity: number
}

export interface ConstellationData {
  name: string
  position: [number, number, number]
  tilt: [number, number, number]  // euler angles — each galaxy tilted differently
  stars: StarData[]
  signalCount: number
  avgEv: number
  layers: CloudLayerConfig[]
  primaryColor: string
  accentColor: string
}

export interface GalaxyData {
  constellations: ConstellationData[]
  loading: boolean
}

const CATEGORY_POSITIONS: Record<string, [number, number, number]> = {
  politics: [-38, 5, -25],
  crypto: [30, -8, -20],
  sports: [12, 8, 30],
  finance: [-35, -18, 12],
  science: [35, 18, 12],
  entertainment: [-12, -22, -35],
  technology: [22, 28, -12],
  world: [-38, 8, 22],
  culture: [8, -28, 18],
  other: [0, 35, 0],
}

// Each category gets a unique color palette + disc tilt for its galaxy
const CATEGORY_COLORS: Record<string, { primary: string; accent: string }> = {
  politics: { primary: "#ff6644", accent: "#ffaa33" },
  crypto: { primary: "#00ccff", accent: "#7744ff" },
  sports: { primary: "#44ff88", accent: "#88ffcc" },
  finance: { primary: "#ffdd00", accent: "#ff8800" },
  science: { primary: "#aa66ff", accent: "#ff66aa" },
  entertainment: { primary: "#ff44aa", accent: "#ff88dd" },
  technology: { primary: "#4488ff", accent: "#44ddff" },
  world: { primary: "#44ffaa", accent: "#44aaff" },
  culture: { primary: "#ff8844", accent: "#ffcc44" },
  other: { primary: "#8888cc", accent: "#aaaaee" },
}

// Each galaxy disc tilted to a unique orientation — euler [x, y, z] in radians
const CATEGORY_TILTS: Record<string, [number, number, number]> = {
  politics:      [0.5,  0.0,   0.3],
  crypto:        [-0.4, 0.8,  -0.2],
  sports:        [1.1,  -0.3,  0.4],
  finance:       [-0.6, 0.3,   0.1],
  science:       [0.8,  0.4,  -0.5],
  entertainment: [-0.3, -0.7,  0.4],
  technology:    [0.1,  0.6,  -0.8],
  world:         [-0.7, -0.2,  0.6],
  culture:       [0.6,  -0.4, -0.3],
  other:         [0.3,  0.2,   0.5],
}

function normalizeCategory(cat: string | undefined): string {
  if (!cat) return "other"
  const lower = cat.toLowerCase()
  for (const key of Object.keys(CATEGORY_POSITIONS)) {
    if (lower.includes(key)) return key
  }
  return "other"
}

function computeStarSize(volume: number, allVolumes: number[]): number {
  if (allVolumes.length === 0) return 0.3
  const sorted = [...allVolumes].sort((a, b) => a - b)
  const rank = sorted.indexOf(volume)
  const pct = allVolumes.length > 1 ? rank / (allVolumes.length - 1) : 0.5
  return 0.15 + pct * 0.85
}

function computeFreshness(createdAt: string): number {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageMin = ageMs / 60000
  if (ageMin < 1) return 1.0
  if (ageMin < 5) return 0.85
  if (ageMin < 15) return 0.6
  if (ageMin < 60) return 0.35
  return 0.15
}

function computeBaseIntensity(absEv: number): number {
  if (absEv < 0.02) return 0.2
  if (absEv < 0.05) return 0.4
  if (absEv < 0.10) return 0.7
  return 1.0
}

function computeStarColor(signal: Signal | undefined): string {
  if (!signal) return "#888899"
  if (signal.ev > 0) return "#00ff88"
  return "#ff4466"
}

function computeEmissiveIntensity(signal: Signal | undefined): number {
  if (!signal) return 0.1
  const base = computeBaseIntensity(Math.abs(signal.ev))
  const freshness = computeFreshness(signal.createdAt)
  return base * freshness
}

// Build particle cloud layer configs based on the constellation's data
function buildCloudLayers(
  marketCount: number,
  signalCount: number,
  avgEv: number,
  primary: string,
  accent: string,
): CloudLayerConfig[] {
  // Scale particle count with market count — more markets = denser cloud
  const density = Math.min(marketCount * 350, 10000)
  const signalIntensity = signalCount > 0 ? Math.min(avgEv * 10, 1) : 0
  const baseRadius = 8 + marketCount * 0.35

  const layers: CloudLayerConfig[] = [
    // Layer 1: Primary stars — dense core, gaussian falloff
    {
      count: Math.floor(density * 1.5),
      minRadius: 0,
      maxRadius: baseRadius,
      baseSize: 0.35 + signalIntensity * 0.1,
      color: primary,
      opacity: 0.7 + signalIntensity * 0.2,
      twistAmp: 0.15,
      ySpread: baseRadius * 0.7,
    },
    // Layer 2: Warm gold/orange stars — gives that Hubble warmth
    {
      count: Math.floor(density * 0.8),
      minRadius: 0,
      maxRadius: baseRadius * 1.1,
      baseSize: 0.3,
      color: "#ffcc66",
      opacity: 0.5 + signalIntensity * 0.15,
      twistAmp: 0.12,
      ySpread: baseRadius * 0.75,
    },
    // Layer 3: Accent color stars — sparser, adds color variety
    {
      count: Math.floor(density * 0.5),
      minRadius: 0,
      maxRadius: baseRadius * 1.2,
      baseSize: 0.4,
      color: accent,
      opacity: 0.4 + signalIntensity * 0.2,
      twistAmp: 0.2,
      ySpread: baseRadius * 0.8,
    },
    // Layer 4: Hot white/blue core stars — bright center
    {
      count: Math.floor(density * 0.4),
      minRadius: 0,
      maxRadius: baseRadius * 0.5,
      baseSize: 0.4,
      color: "#ccddff",
      opacity: 0.6,
      twistAmp: 0.1,
      ySpread: baseRadius * 0.5,
    },
    // Layer 5: Faint outer halo — scattered distant stars
    {
      count: Math.floor(density * 0.3),
      minRadius: baseRadius * 0.5,
      maxRadius: baseRadius * 1.8,
      baseSize: 0.2,
      color: primary,
      opacity: 0.2,
      twistAmp: 0.05,
      ySpread: baseRadius * 1.0,
    },
  ]

  // Layer 6: Signal flare — extra bright core burst
  if (signalIntensity > 0.3) {
    layers.push({
      count: Math.floor(density * 0.3),
      minRadius: 0,
      maxRadius: baseRadius * 0.35,
      baseSize: 0.45,
      color: "#ffffff",
      opacity: 0.3 + signalIntensity * 0.4,
      twistAmp: 0.08,
      ySpread: baseRadius * 0.3,
    })
  }

  return layers
}

// Seeded PRNG for deterministic star positions within clouds
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function scatteredPosition(
  index: number,
  _total: number,
  radius: number,
  seed: number,
): [number, number, number] {
  const rng = seededRandom(seed + index * 7919)
  const theta = rng() * Math.PI * 2
  const phi = Math.acos(2 * rng() - 1)
  const r = radius * (0.3 + rng() * 0.7)
  return [
    Math.sin(phi) * Math.cos(theta) * r,
    Math.sin(phi) * Math.sin(theta) * r * 0.4,
    Math.cos(phi) * r,
  ]
}

export function useGalaxyData(): GalaxyData {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets({ limit: 200 })
  const { data: signalsData, isLoading: signalsLoading } = useSignals()

  return useMemo(() => {
    const markets = marketsData?.markets ?? []
    const signals = signalsData?.signals ?? []
    const loading = marketsLoading || signalsLoading

    if (markets.length === 0) {
      return { constellations: [], loading }
    }

    const signalMap = new Map<string, Signal>()
    for (const s of signals) {
      const existing = signalMap.get(s.marketId)
      if (!existing || Math.abs(s.ev) > Math.abs(existing.ev)) {
        signalMap.set(s.marketId, s)
      }
    }

    const groups = new Map<string, Market[]>()
    for (const m of markets) {
      const cat = normalizeCategory(m.category)
      const arr = groups.get(cat) ?? []
      arr.push(m)
      groups.set(cat, arr)
    }

    const allVolumes = markets.map((m) => m.volume)
    const constellations: ConstellationData[] = []

    for (const [name, catMarkets] of groups) {
      const center = CATEGORY_POSITIONS[name] ?? [0, 0, 0]
      const colors = CATEGORY_COLORS[name] ?? CATEGORY_COLORS.other
      const clusterRadius = Math.min(6 + catMarkets.length * 0.5, 18)
      const catSeed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31

      const stars: StarData[] = catMarkets.map((market, i) => {
        const signal = signalMap.get(market.id)
        const local = scatteredPosition(i, catMarkets.length, clusterRadius, catSeed)
        return {
          market,
          signal,
          localPosition: local,
          size: computeStarSize(market.volume, allVolumes),
          color: computeStarColor(signal),
          emissiveIntensity: computeEmissiveIntensity(signal),
        }
      })

      const marketsWithSignals = stars.filter((s) => s.signal)
      const signalCount = marketsWithSignals.length
      const avgEv =
        signalCount > 0
          ? marketsWithSignals.reduce((sum, s) => sum + Math.abs(s.signal!.ev), 0) / signalCount
          : 0

      const layers = buildCloudLayers(
        catMarkets.length,
        signalCount,
        avgEv,
        colors.primary,
        colors.accent,
      )

      const tilt = CATEGORY_TILTS[name] ?? [0.3, 0.2, 0.5]

      constellations.push({
        name,
        position: center,
        tilt,
        stars,
        signalCount,
        avgEv,
        layers,
        primaryColor: colors.primary,
        accentColor: colors.accent,
      })
    }

    return { constellations, loading }
  }, [marketsData, signalsData, marketsLoading, signalsLoading])
}
