import type { Market, Result } from "@/lib/types"
import { ok, err } from "@/lib/result"

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
}

function gammaToMarket(gamma: GammaMarket): Market {
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
    url: `https://polymarket.com/event/${gamma.slug}`,
    category: gamma.category || undefined,
    lastUpdated: new Date().toISOString(),
    clobTokenId,
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
}): Promise<Result<Market[]>> {
  const limit = options?.limit ?? 50
  const active = options?.active ?? true

  const params = new URLSearchParams({
    limit: String(limit),
    active: String(active),
    closed: "false",
  })

  const result = await fetchWithRetry(`${GAMMA_BASE}/markets?${params}`)
  if (!result.ok) return err(result.error)

  try {
    const data = (await result.data.json()) as GammaMarket[]

    const markets = data
      .filter((m) => m.question && m.outcomePrices)
      .map(gammaToMarket)

    return ok(markets)
  } catch (e) {
    return err(`Failed to parse Gamma response: ${e instanceof Error ? e.message : String(e)}`)
  }
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
