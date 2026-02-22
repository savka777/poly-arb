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
  politics:      [-38,   5,  -25],
  crypto:        [ 30,  -8,  -20],
  sports:        [ 12,   8,   30],
  finance:       [-35, -18,   12],
  science:       [ 35,  18,   12],
  entertainment: [-12, -22,  -35],
  technology:    [ 22,  28,  -12],
  world:         [-38,   8,   22],
  culture:       [  8, -28,   18],
  esports:       [ 40,  -5,   25],
  weather:       [-20,  30,   15],
  elections:     [-50,  -5,  -10],
  economy:       [-15, -35,  -15],
  ai:            [ 45,  30,    0],
  space:         [  0,  40,  -20],
  other:         [-10,  25,    0],
}

// Each category gets a unique color palette + disc tilt for its galaxy
// Cohesive nebula palette — cool blues, warm golds, soft violets
const CATEGORY_COLORS: Record<string, { primary: string; accent: string }> = {
  politics:      { primary: "#e8a87c", accent: "#f0c8a8" },  // warm peach
  crypto:        { primary: "#7ec8e3", accent: "#a8ddf0" },  // soft cyan
  sports:        { primary: "#8b7ec8", accent: "#b0a8e0" },  // lavender
  finance:       { primary: "#e8d07c", accent: "#f0e0a8" },  // warm gold
  science:       { primary: "#b87ce8", accent: "#d0a8f0" },  // violet
  entertainment: { primary: "#e87cb8", accent: "#f0a8d0" },  // soft magenta
  technology:    { primary: "#7ca8e8", accent: "#a8c8f0" },  // steel blue
  world:         { primary: "#7cd0d0", accent: "#a8e0e0" },  // teal
  culture:       { primary: "#d0a870", accent: "#e0c8a0" },  // warm tan
  esports:       { primary: "#70c0a8", accent: "#a0d8c8" },  // sage
  weather:       { primary: "#90b8d8", accent: "#b0d0e8" },  // pale sky
  elections:     { primary: "#d0907c", accent: "#e0b0a0" },  // dusty coral
  economy:       { primary: "#c8b870", accent: "#d8d0a0" },  // muted gold
  ai:            { primary: "#a890d8", accent: "#c0b0e8" },  // soft purple
  space:         { primary: "#80a8c8", accent: "#a0c0d8" },  // deep sky
  other:         { primary: "#a0a0b8", accent: "#c0c0d0" },  // silver
}

// Each galaxy disc tilted to a unique orientation — euler [x, y, z] in radians
const CATEGORY_TILTS: Record<string, [number, number, number]> = {
  politics:      [0.9,  0.0,   0.3],
  crypto:        [0.6,  0.8,  -0.2],
  sports:        [1.1, -0.3,   0.4],
  finance:       [0.5,  0.3,   0.1],
  science:       [0.8,  0.4,  -0.5],
  entertainment: [0.7, -0.7,   0.4],
  technology:    [0.8,  0.6,  -0.8],
  world:         [0.5, -0.2,   0.6],
  culture:       [0.9, -0.4,  -0.3],
  esports:       [0.7,  0.5,   0.2],
  weather:       [0.6, -0.6,   0.3],
  elections:     [0.8,  0.2,  -0.4],
  economy:       [0.5, -0.3,   0.6],
  ai:            [0.7,  0.7,  -0.1],
  space:         [0.9,  0.1,   0.5],
  other:         [0.7,  0.2,   0.5],
}

const CATEGORY_MAP: Record<string, string> = {
  // Politics
  politics: "politics", trump: "politics", democrats: "politics", congress: "politics",
  cabinet: "politics", senate: "politics", "gov shutdown": "politics", scotus: "politics",
  "supreme court": "politics", primaries: "politics", vance: "politics",
  // Elections
  elections: "elections", "us election": "elections", midterms: "elections",
  "world elections": "elections", "global elections": "elections",
  "nov 4 elections": "elections", referendum: "elections",
  // Crypto
  crypto: "crypto", bitcoin: "crypto", ethereum: "crypto", solana: "crypto",
  xrp: "crypto", dogecoin: "crypto", bnb: "crypto", "crypto prices": "crypto",
  ripple: "crypto", stablecoins: "crypto", hyperliquid: "crypto", airdrops: "crypto",
  "token sales": "crypto", derivatives: "crypto",
  // Sports
  sports: "sports", nba: "sports", nfl: "sports", nhl: "sports", mlb: "sports",
  soccer: "sports", tennis: "sports", ufc: "sports", mma: "sports", cricket: "sports",
  basketball: "sports", hockey: "sports", baseball: "sports", rugby: "sports",
  "formula 1": "sports", boxing: "sports", mls: "sports", "premier league": "sports",
  "champions league": "sports", "serie a": "sports", "la liga": "sports",
  ncaa: "sports", "ncaa football": "sports", "ncaa basketball": "sports",
  "nfl draft": "sports", "nfl playoffs": "sports", epl: "sports",
  // Esports
  esports: "esports", "dota 2": "esports", valorant: "esports",
  "league of legends": "esports", "counter strike 2": "esports",
  "rocket league": "esports", cod: "esports", lol: "esports",
  "honor of kings": "esports",
  // Finance
  finance: "finance", stocks: "finance", equities: "finance", earnings: "finance",
  commodities: "finance", gold: "finance", "s&p 500": "finance", ipo: "finance",
  ipos: "finance", "pre-market": "finance", "fed rates": "finance", fed: "finance",
  inflation: "finance", "macro indicators": "finance", "interest rate": "finance",
  "global rates": "finance",
  // Economy
  economy: "economy", gdp: "economy", "global gdp": "economy",
  "economic policy": "economy", tariffs: "economy", "trade war": "economy",
  housing: "economy", unemployment: "economy", taxes: "economy",
  // Entertainment
  entertainment: "entertainment", movies: "entertainment", music: "entertainment",
  netflix: "entertainment", "reality tv": "entertainment", youtube: "entertainment",
  spotify: "entertainment", "box office": "entertainment", oscars: "entertainment",
  grammys: "entertainment", awards: "entertainment", celebrities: "entertainment",
  eurovision: "entertainment", kpop: "entertainment",
  // Technology
  technology: "technology", tech: "technology", "big tech": "technology",
  spacex: "technology", apple: "technology", tesla: "technology",
  openai: "technology", tiktok: "technology",
  // AI
  ai: "ai", "claude 5": "ai", "gemini 3": "ai", chatgpt: "ai",
  // Science
  science: "science", "climate & science": "science", climate: "science",
  pandemics: "science", "natural disasters": "science",
  // Space
  space: "space", olympics: "space",
  // Weather
  weather: "weather", "daily temperature": "weather", precipitation: "weather",
  // World / Geopolitics
  world: "world", geopolitics: "world", "foreign policy": "world",
  ukraine: "world", israel: "world", gaza: "world", iran: "world",
  "middle east": "world", china: "world", india: "world", russia: "world",
  brazil: "world", japan: "world", "south korea": "world",
  // Culture
  culture: "culture", games: "culture", collectibles: "culture",
  "prediction markets": "culture", mrbeast: "culture",
}

function normalizeCategory(cat: string | undefined): string {
  if (!cat) return "other"
  const lower = cat.toLowerCase()
  // Exact match first
  if (CATEGORY_MAP[lower]) return CATEGORY_MAP[lower]
  // Substring match
  for (const [key, value] of Object.entries(CATEGORY_MAP)) {
    if (lower.includes(key)) return value
  }
  return "other"
}

function computeStarSize(volume: number, allVolumes: number[]): number {
  if (allVolumes.length === 0) return 0.3
  const sorted = [...allVolumes].sort((a, b) => a - b)
  const rank = sorted.indexOf(volume)
  const pct = allVolumes.length > 1 ? rank / (allVolumes.length - 1) : 0.5
  return 0.18 + pct * 0.8
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

// Extract meaningful keywords from a market question
export function extractKeywords(question: string): Set<string> {
  const stopWords = new Set([
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "will", "would",
    "could", "should", "do", "does", "did", "has", "have", "had", "in", "on", "at",
    "to", "for", "of", "with", "by", "from", "or", "and", "not", "no", "yes",
    "this", "that", "it", "its", "they", "their", "he", "she", "his", "her",
    "what", "which", "who", "whom", "how", "when", "where", "why", "if", "than",
    "more", "most", "any", "all", "each", "every", "both", "few", "many", "much",
    "before", "after", "above", "below", "between", "during", "about", "into",
    "through", "over", "under", "up", "down", "out", "off", "then", "so", "but",
    "just", "also", "very", "can", "may", "might", "shall", "must", "being",
    "get", "got", "make", "go", "come", "take", "give", "know", "think", "say",
    "see", "find", "here", "there", "new", "old", "first", "last", "next",
  ])
  return new Set(
    question.toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w))
  )
}

// Compute keyword overlap between two markets (0-1)
export function keywordSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let overlap = 0
  for (const w of a) {
    if (b.has(w)) overlap++
  }
  return overlap / Math.min(a.size, b.size)
}

// Position stars so keyword-similar markets cluster together
// Uses a simple force-directed approach: start with seeded random positions,
// then pull similar markets closer and push dissimilar ones apart
function computeClusterPositions(
  markets: { question: string }[],
  radius: number,
  seed: number,
): [number, number, number][] {
  const n = markets.length
  if (n === 0) return []

  // Extract keywords for all markets
  const keywords = markets.map((m) => extractKeywords(m.question))

  // Start with seeded random positions — use cube root for volume-uniform
  // distribution so stars aren't all clumped in the center
  const positions: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    const rng = seededRandom(seed + i * 7919)
    const theta = rng() * Math.PI * 2
    const phi = Math.acos(2 * rng() - 1)
    // Cube root gives uniform volume distribution; high minimum keeps stars out of center
    const r = radius * (0.45 + 0.55 * Math.cbrt(rng()))
    positions.push([
      Math.sin(phi) * Math.cos(theta) * r,
      Math.sin(phi) * Math.sin(theta) * r * 0.4,
      Math.cos(phi) * r,
    ])
  }

  // Run a few iterations of spring-like forces
  // Weaken attraction for large groups so they don't collapse to center
  const iterations = 8
  const attractStrength = n > 80 ? 0.04 : n > 40 ? 0.08 : 0.15
  const repelStrength = 0.4
  const minDist = radius * 0.12

  for (let iter = 0; iter < iterations; iter++) {
    const forces: [number, number, number][] = positions.map(() => [0, 0, 0])

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = positions[j][0] - positions[i][0]
        const dy = positions[j][1] - positions[i][1]
        const dz = positions[j][2] - positions[i][2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01
        const sim = keywordSimilarity(keywords[i], keywords[j])

        if (sim > 0.2) {
          // Attract similar markets
          const f = attractStrength * sim / Math.max(dist, 0.1)
          forces[i][0] += dx * f; forces[i][1] += dy * f; forces[i][2] += dz * f
          forces[j][0] -= dx * f; forces[j][1] -= dy * f; forces[j][2] -= dz * f
        }

        // Repel if too close
        if (dist < minDist) {
          const f = repelStrength * (minDist - dist) / dist
          forces[i][0] -= dx * f; forces[i][1] -= dy * f; forces[i][2] -= dz * f
          forces[j][0] += dx * f; forces[j][1] += dy * f; forces[j][2] += dz * f
        }
      }
    }

    // Apply forces with damping
    const damping = 0.5
    for (let i = 0; i < n; i++) {
      positions[i][0] += forces[i][0] * damping
      positions[i][1] += forces[i][1] * damping
      positions[i][2] += forces[i][2] * damping
      // Clamp to cluster radius
      const r = Math.sqrt(positions[i][0] ** 2 + positions[i][1] ** 2 + positions[i][2] ** 2)
      if (r > radius) {
        const scale = radius / r
        positions[i][0] *= scale
        positions[i][1] *= scale
        positions[i][2] *= scale
      }
    }
  }

  return positions
}

export function useGalaxyData(): GalaxyData {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets({ limit: 1000 })
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
      // sqrt scaling: radius grows proportionally but capped
      // ~10 trades → ~7, ~40 trades → ~10, ~100 trades → ~13, ~200 trades → ~16
      const clusterRadius = Math.min(4 + Math.sqrt(catMarkets.length) * 0.9, 18)
      const catSeed = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) * 31

      const clusterPositions = computeClusterPositions(catMarkets, clusterRadius, catSeed)
      const stars: StarData[] = catMarkets.map((market, i) => {
        const signal = signalMap.get(market.id)
        const local = clusterPositions[i] ?? [0, 0, 0]
        return {
          market,
          signal,
          localPosition: local,
          size: computeStarSize(market.volume, allVolumes) * (signal ? 1.0 + Math.min(Math.abs(signal.ev) * 8, 2.0) : 0.6),
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
