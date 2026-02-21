/**
 * Polymarket data wrappers.
 *
 * Gamma API  — market discovery, metadata, prices (outcomePrices field)
 * CLOB API   — real-time order book, single market lookup by condition_id
 *
 * All functions return Result<T> and never throw.
 * Rate-limit backoff: 4 attempts at 0s / 1s / 2s / 4s.
 */

import { ok, err } from '../lib/result'
import type {
  Result,
  Market,
  GammaMarket,
  ClobMarket,
  ClobMarketsResponse,
  ClobOrderBook,
} from '../lib/types'
import { config } from '../lib/config'

// ─── Backoff helper ───────────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [0, 1000, 2000, 4000]

async function fetchWithBackoff(
  url: string,
  init?: RequestInit
): Promise<Response> {
  let lastError: Error = new Error('Unknown fetch error')

  for (let attempt = 0; attempt < BACKOFF_DELAYS_MS.length; attempt++) {
    if (BACKOFF_DELAYS_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[attempt]))
    }

    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          'User-Agent': 'darwin-capital/1.0',
          'Accept': 'application/json',
          ...init?.headers,
        },
      })

      // Retry on 429 or 5xx
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }

      return res
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastError
}

// ─── Normalization ────────────────────────────────────────────────────────────

function parseJsonField<T>(raw: string, fieldName: string): T {
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`Failed to parse ${fieldName}: ${raw}`)
  }
}

export function gammaToMarket(gamma: GammaMarket): Market {
  const prices = parseJsonField<string[]>(gamma.outcomePrices, 'outcomePrices')
  const tokenIds = parseJsonField<string[]>(gamma.clobTokenIds, 'clobTokenIds')

  // YES is always index 0, NO is index 1
  const yesPrice = parseFloat(prices[0] ?? '0')
  const noTokenId = tokenIds[1] ?? tokenIds[0] ?? ''

  return {
    id: gamma.id,
    conditionId: gamma.conditionId,
    tokenIds: [tokenIds[0] ?? '', noTokenId],
    platform: 'polymarket',
    question: gamma.question,
    probability: yesPrice,
    volume: parseFloat(gamma.volume),
    liquidity: parseFloat(gamma.liquidity),
    endDate: gamma.endDate,
    url: `https://polymarket.com/event/${gamma.slug}`,
    category: gamma.category,
    lastUpdated: gamma.updatedAt,
  }
}

// ─── Gamma API ────────────────────────────────────────────────────────────────

export interface FetchMarketsOptions {
  category?: string
  limit?: number
  minLiquidity?: number
}

/**
 * Fetch active, non-closed markets from the Gamma API.
 * Returns normalized Market[] sorted by volume descending.
 */
export async function fetchMarkets(
  options: FetchMarketsOptions = {}
): Promise<Result<Market[]>> {
  const { category, limit = 50, minLiquidity = 0 } = options

  const params = new URLSearchParams({
    active: 'true',
    closed: 'false',
    limit: String(limit),
  })
  if (category) params.set('tag', category)

  const url = `${config.polymarket.gammaBaseUrl}/markets?${params}`

  try {
    const res = await fetchWithBackoff(url)

    if (!res.ok) {
      return err(`Gamma /markets returned HTTP ${res.status}`)
    }

    const raw = (await res.json()) as unknown

    // Gamma returns a plain array (no data wrapper)
    if (!Array.isArray(raw)) {
      return err(`Gamma /markets: unexpected response shape — expected array`)
    }

    const markets: Market[] = []

    for (const item of raw as GammaMarket[]) {
      try {
        // Skip markets with no clobTokenIds (legacy/fpmm-only markets)
        if (!item.clobTokenIds || item.clobTokenIds === '[]') continue

        const market = gammaToMarket(item)

        if (market.liquidity < minLiquidity) continue

        markets.push(market)
      } catch {
        // Skip individual malformed markets rather than failing the whole batch
        continue
      }
    }

    // Sort by volume descending — highest activity first
    markets.sort((a, b) => b.volume - a.volume)

    return ok(markets)
  } catch (e) {
    return err(`fetchMarkets failed: ${String(e)}`)
  }
}

/**
 * Fetch a single market from the Gamma API by its Gamma ID.
 */
export async function fetchMarketById(
  gammaId: string
): Promise<Result<Market>> {
  const url = `${config.polymarket.gammaBaseUrl}/markets/${gammaId}`

  try {
    const res = await fetchWithBackoff(url)

    if (res.status === 404) return err(`Market not found: ${gammaId}`)
    if (!res.ok) return err(`Gamma /markets/${gammaId} returned HTTP ${res.status}`)

    const raw = (await res.json()) as GammaMarket

    if (!raw.clobTokenIds || raw.clobTokenIds === '[]') {
      return err(`Market ${gammaId} has no CLOB token IDs`)
    }

    return ok(gammaToMarket(raw))
  } catch (e) {
    return err(`fetchMarketById(${gammaId}) failed: ${String(e)}`)
  }
}

// ─── CLOB API ─────────────────────────────────────────────────────────────────

/**
 * Fetch a single market from the CLOB API by condition_id.
 * CLOB data provides live token prices and order-book availability.
 */
export async function fetchClobMarket(
  conditionId: string
): Promise<Result<ClobMarket>> {
  const url = `${config.polymarket.clobBaseUrl}/markets/${conditionId}`

  try {
    const res = await fetchWithBackoff(url)

    if (res.status === 404) return err(`CLOB market not found: ${conditionId}`)
    if (!res.ok) return err(`CLOB /markets/${conditionId} returned HTTP ${res.status}`)

    const raw = (await res.json()) as ClobMarket
    return ok(raw)
  } catch (e) {
    return err(`fetchClobMarket(${conditionId}) failed: ${String(e)}`)
  }
}

/**
 * Fetch the current YES-side price for a token from the CLOB API.
 * Uses the mid-price (best bid for BUY side).
 *
 * @param tokenId  YES token ID from market.tokenIds[0]
 */
export async function fetchTokenPrice(
  tokenId: string
): Promise<Result<number>> {
  const url = `${config.polymarket.clobBaseUrl}/price?token_id=${encodeURIComponent(tokenId)}&side=BUY`

  try {
    const res = await fetchWithBackoff(url)

    if (!res.ok) return err(`CLOB /price returned HTTP ${res.status}`)

    const raw = (await res.json()) as { price?: string }

    if (raw.price === undefined) return err('CLOB /price: missing price field')

    const price = parseFloat(raw.price)
    if (isNaN(price)) return err(`CLOB /price: invalid price value "${raw.price}"`)

    return ok(price)
  } catch (e) {
    return err(`fetchTokenPrice(${tokenId}) failed: ${String(e)}`)
  }
}

/**
 * Fetch the order book for a YES token from the CLOB API.
 * Returns bids and asks as numeric values.
 */
export async function fetchOrderBook(
  tokenId: string
): Promise<
  Result<{ bids: Array<{ price: number; size: number }>; asks: Array<{ price: number; size: number }> }>
> {
  const url = `${config.polymarket.clobBaseUrl}/book?token_id=${encodeURIComponent(tokenId)}`

  try {
    const res = await fetchWithBackoff(url)

    if (!res.ok) return err(`CLOB /book returned HTTP ${res.status}`)

    const raw = (await res.json()) as ClobOrderBook

    const bids = (raw.bids ?? []).map((b) => ({
      price: parseFloat(b.price),
      size: parseFloat(b.size),
    }))
    const asks = (raw.asks ?? []).map((a) => ({
      price: parseFloat(a.price),
      size: parseFloat(a.size),
    }))

    return ok({ bids, asks })
  } catch (e) {
    return err(`fetchOrderBook(${tokenId}) failed: ${String(e)}`)
  }
}

/**
 * Fetch all active CLOB markets (paginated, returns first page up to limit).
 * Primarily used to verify CLOB availability for a batch of markets.
 */
export async function fetchClobMarkets(
  limit = 20,
  cursor?: string
): Promise<Result<{ markets: ClobMarket[]; nextCursor?: string }>> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (cursor) params.set('next_cursor', cursor)

  const url = `${config.polymarket.clobBaseUrl}/markets?${params}`

  try {
    const res = await fetchWithBackoff(url)

    if (!res.ok) return err(`CLOB /markets returned HTTP ${res.status}`)

    const raw = (await res.json()) as ClobMarketsResponse

    return ok({
      markets: raw.data ?? [],
      nextCursor: raw.next_cursor,
    })
  } catch (e) {
    return err(`fetchClobMarkets failed: ${String(e)}`)
  }
}
