import type { Market, Result } from "@/lib/types"
import { ok, err } from "@/lib/result"
import { config } from "@/lib/config"

const GAMMA_BASE = "https://gamma-api.polymarket.com"
const CLOB_BASE = "https://clob.polymarket.com"

export interface PricePoint {
  time: number // unix timestamp in seconds
  price: number // 0-1
}

interface GammaMarket {
  id: string
  question: string
  slug: string
  endDate: string
  liquidity: number
  volume: number
  outcomePrices: string // JSON-encoded: "[0.65, 0.35]"
  outcomes: string // JSON-encoded: '["Yes", "No"]'
  clobTokenIds: string // JSON-encoded: '["tokenId1", "tokenId2"]'
  category: string
  active: boolean
  oneDayPriceChange?: number
  volume24hr?: number
  spread?: number
}

interface GammaEvent {
  id: string
  title: string
  slug: string
  description: string
  startDate: string
  endDate: string
  liquidity: number
  volume: number
  volume24hr: number
  active: boolean
  closed: boolean
  featured: boolean
  tags: Array<{ label: string; slug: string }>
  markets: GammaMarket[]
}

function gammaToMarket(gamma: GammaMarket, event?: { id: string; title: string }, eventSlug?: string): Market {
  let probability = 0.5
  try {
    const prices = JSON.parse(gamma.outcomePrices) as number[]
    probability = prices[0] ?? 0.5
  } catch {
    // fallback to 0.5
  }

  let clobTokenId: string | undefined
  try {
    const tokenIds = JSON.parse(gamma.clobTokenIds) as string[]
    clobTokenId = tokenIds[0] // YES token
  } catch {
    // no token ID
  }

  return {
    id: gamma.id,
    platform: "polymarket",
    question: gamma.question,
    probability,
    volume: gamma.volume ?? 0,
    liquidity: gamma.liquidity ?? 0,
    endDate: gamma.endDate ?? new Date().toISOString(),
    url: `https://polymarket.com/event/${eventSlug ?? gamma.slug}`,
    category: gamma.category || undefined,
    lastUpdated: new Date().toISOString(),
    clobTokenId,
    spread: gamma.spread,
    oneDayPriceChange: gamma.oneDayPriceChange,
    volume24hr: gamma.volume24hr,
    event,
  }
}

async function fetchWithRetry(
  url: string,
  maxAttempts = 4
): Promise<Result<Response>> {
  const delays = [0, 1000, 2000, 4000]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (delays[attempt] > 0) {
      await new Promise((r) => setTimeout(r, delays[attempt]))
    }

    try {
      const res = await fetch(url)

      if (res.ok) return ok(res)

      // Retry on 429 or 5xx
      if (res.status === 429 || res.status >= 500) {
        if (attempt === maxAttempts - 1) {
          return err(`HTTP ${res.status} after ${maxAttempts} attempts`)
        }
        continue
      }

      // 4xx (not 429) — fail immediately
      return err(`HTTP ${res.status}: ${res.statusText}`)
    } catch (e) {
      if (attempt === maxAttempts - 1) {
        return err(`Network error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
  }

  return err("Max retries exceeded")
}

export async function fetchMarkets(options?: {
  limit?: number
  active?: boolean
  minLiquidity?: number
}): Promise<Result<Market[]>> {
  const limit = options?.limit ?? 50
  const active = options?.active ?? true

  const params = new URLSearchParams({
    limit: String(limit),
    active: String(active),
    closed: "false",
    end_date_min: new Date().toISOString(),
  })

  const result = await fetchWithRetry(`${GAMMA_BASE}/markets?${params}`)
  if (!result.ok) return err(result.error)

  try {
    const data = (await result.data.json()) as GammaMarket[]

    const effectiveMinLiquidity = Math.max(
      options?.minLiquidity ?? 0,
      config.marketFilters.minLiquidity,
    )
    const now = Date.now()

    const markets = data
      .filter((m) => m.question && m.outcomePrices)
      .map((m) => gammaToMarket(m))
      .filter((m) => {
        // Skip expired markets (safety net — end_date_min should handle this server-side)
        if (new Date(m.endDate).getTime() <= now) return false
        if (m.liquidity < effectiveMinLiquidity) return false
        if (m.volume < config.marketFilters.minVolume) return false
        if (m.probability < config.marketFilters.minProbability) return false
        if (m.probability > config.marketFilters.maxProbability) return false
        return true
      })
      .sort((a, b) => b.volume - a.volume)

    return ok(markets)
  } catch (e) {
    return err(`Failed to parse Gamma response: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function fetchEvents(options?: {
  limit?: number
  offset?: number
}): Promise<Result<GammaEvent[]>> {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  const params = new URLSearchParams({
    active: "true",
    closed: "false",
    order: "volume24hr",
    ascending: "false",
    limit: String(limit),
    offset: String(offset),
  })

  const result = await fetchWithRetry(`${GAMMA_BASE}/events?${params}`)
  if (!result.ok) return err(result.error)

  try {
    const data = (await result.data.json()) as GammaEvent[]
    return ok(data)
  } catch (e) {
    return err(`Failed to parse Gamma events response: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function fetchTrendingMarkets(options?: {
  limit?: number
  pages?: number
}): Promise<Result<Market[]>> {
  const limit = options?.limit ?? 50
  const pages = options?.pages ?? 2
  const perPage = 50

  const excludeTags = new Set(
    config.marketFilters.excludeTags.map(t => t.toLowerCase())
  )

  // Fetch multiple pages of events
  const allEvents: GammaEvent[] = []
  for (let page = 0; page < pages; page++) {
    const result = await fetchEvents({ limit: perPage, offset: page * perPage })
    if (!result.ok) {
      if (page === 0) return err(result.error)
      break // partial results are fine for subsequent pages
    }
    allEvents.push(...result.data)
    if (result.data.length < perPage) break // no more pages
  }

  const now = Date.now()
  const markets: Market[] = []

  for (const event of allEvents) {
    // Filter out events with excluded tags
    const eventTags = (event.tags ?? []).map(t => t.label.toLowerCase())
    if (eventTags.some(tag => excludeTags.has(tag))) continue

    // Pick the best market from this event: active, not closed, probability closest to 0.5
    const candidates = (event.markets ?? [])
      .filter(m => m.question && m.outcomePrices && m.active)

    if (candidates.length === 0) continue

    const scored = candidates.map(m => {
      let probability = 0.5
      try {
        const prices = JSON.parse(m.outcomePrices) as number[]
        probability = prices[0] ?? 0.5
      } catch {
        // fallback
      }
      // Distance from 0.5 — lower is more interesting
      const uncertainty = Math.abs(probability - 0.5)
      return { market: m, probability, uncertainty }
    })

    // Sort by uncertainty ascending (closest to 0.5 first), then by volume24hr descending as tiebreaker
    scored.sort((a, b) => {
      const diff = a.uncertainty - b.uncertainty
      if (Math.abs(diff) > 0.01) return diff
      return (b.market.volume24hr ?? 0) - (a.market.volume24hr ?? 0)
    })

    const best = scored[0]
    const eventInfo = { id: event.id, title: event.title }
    const market = gammaToMarket(best.market, eventInfo, event.slug)

    // Apply standard filters
    if (new Date(market.endDate).getTime() <= now) continue
    if (market.liquidity < config.marketFilters.minLiquidity) continue
    if (market.volume < config.marketFilters.minVolume) continue
    if (market.probability < config.marketFilters.minProbability) continue
    if (market.probability > config.marketFilters.maxProbability) continue

    markets.push(market)
  }

  // Sort by volume24hr descending
  markets.sort((a, b) => (b.volume24hr ?? 0) - (a.volume24hr ?? 0))

  return ok(markets.slice(0, limit))
}

export async function fetchMarketById(id: string): Promise<Result<Market>> {
  const result = await fetchWithRetry(`${GAMMA_BASE}/markets/${id}`)
  if (!result.ok) return err(result.error)

  try {
    const data = (await result.data.json()) as GammaMarket
    if (!data.question) return err("Market not found or invalid")
    return ok(gammaToMarket(data))
  } catch (e) {
    return err(`Failed to parse market: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export interface OrderBookEntry {
  price: number
  size: number
}

export interface OrderBook {
  bids: OrderBookEntry[]
  asks: OrderBookEntry[]
}

export async function fetchOrderBook(
  clobTokenId: string
): Promise<Result<OrderBook>> {
  const params = new URLSearchParams({ token_id: clobTokenId })
  const result = await fetchWithRetry(`${CLOB_BASE}/book?${params}`)
  if (!result.ok) return err(result.error)

  try {
    const data = (await result.data.json()) as {
      bids?: Array<{ price: string; size: string }>
      asks?: Array<{ price: string; size: string }>
    }
    const bids = (data.bids ?? []).map((b) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }))
    const asks = (data.asks ?? []).map((a) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }))
    return ok({ bids, asks })
  } catch (e) {
    return err(`Failed to parse order book: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function fetchPriceHistory(
  clobTokenId: string,
  interval: "1d" | "1w" | "1m" | "all" = "all",
  fidelity = 60
): Promise<Result<PricePoint[]>> {
  const params = new URLSearchParams({
    market: clobTokenId,
    interval: interval === "1d" ? "1d" : interval === "1w" ? "1w" : interval === "1m" ? "1m" : "max",
    fidelity: String(fidelity),
  })

  const result = await fetchWithRetry(`${CLOB_BASE}/prices-history?${params}`)
  if (!result.ok) return err(result.error)

  try {
    const data = (await result.data.json()) as { history: Array<{ t: number; p: number }> }
    const points: PricePoint[] = (data.history ?? []).map((h) => ({
      time: h.t,
      price: h.p,
    }))
    return ok(points)
  } catch (e) {
    return err(`Failed to parse price history: ${e instanceof Error ? e.message : String(e)}`)
  }
}
