# Darwin Capital — API Reference

> External APIs (Polymarket, Valyu) and internal Next.js API routes.
> **All shapes verified live on 2026-02-21.** See `docs/api_response_samples.json` for full raw responses.

---

## External APIs

### Polymarket — Gamma API

**Base URL:** `https://gamma-api.polymarket.com`
**Auth:** None required
**Rate Limit:** ~60 requests/minute

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | List active markets (plain array, no wrapper) |
| GET | `/markets/:id` | Single market by Gamma numeric ID |

#### `GET /markets` — Query Params

| Param | Type | Description |
|-------|------|-------------|
| `active` | boolean | Filter to active markets (`true`) |
| `closed` | boolean | Filter out closed markets (`false`) |
| `limit` | number | Max results to return |
| `tag` | string | Category/tag filter |

#### Response Shape

**⚠️ Returns a plain array — no `{ data: [] }` wrapper.**

```typescript
// Array item
interface GammaMarket {
  id: string               // Gamma numeric ID e.g. "517310"
  question: string
  conditionId: string      // 0x hex — used for CLOB API calls
  slug: string
  endDate: string          // ISO 8601 e.g. "2025-12-31T12:00:00Z"
  liquidity: string        // ⚠️ decimal STRING e.g. "20526.93"
  volume: string           // ⚠️ decimal STRING e.g. "1198758.20"
  outcomePrices: string    // ⚠️ JSON string of STRING numbers: "[\"0.0295\", \"0.9705\"]"
  outcomes: string         // JSON string: "[\"Yes\", \"No\"]"
  clobTokenIds: string     // JSON string of token ID strings: "[\"1016...\", \"4153...\"]"
  category?: string
  active: boolean
  closed: boolean
  updatedAt: string        // ISO 8601
}
```

**Critical parsing note:** `outcomePrices` and `clobTokenIds` are JSON-encoded strings that must
be `JSON.parse()`d. `outcomePrices` contains string numbers that then need `parseFloat()`.

```typescript
const prices = JSON.parse(market.outcomePrices) as string[]  // ["0.0295", "0.9705"]
const yesPrice = parseFloat(prices[0])                        // 0.0295
const tokenIds = JSON.parse(market.clobTokenIds) as string[]  // ["101676...", "415329..."]
```

#### Notes
- Use Gamma for market discovery, filtering, metadata, and prices (`outcomePrices`)
- `id` (numeric) is the Gamma key; `conditionId` (0x hex) is the CLOB key
- `GET /markets/:id` returns a single object (not an array)

---

### Polymarket — CLOB API

**Base URL:** `https://clob.polymarket.com`
**Auth:** None required for public market data
**Rate Limit:** ~100 requests/minute (undocumented — use conservative backoff)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | Paginated market list |
| GET | `/markets/:condition_id` | Single market by 0x condition ID |
| GET | `/price` | Current price for a single token |
| GET | `/book` | Full order book for a token |

#### `GET /markets` Response

**Returns `{ data: [...], next_cursor, limit, count }` — has a wrapper unlike Gamma.**

```typescript
interface ClobMarketsResponse {
  data: ClobMarket[]
  next_cursor?: string   // pass as ?next_cursor= for next page
  limit: number
  count: number
}
```

#### `GET /markets/:condition_id` Response

```typescript
interface ClobMarket {
  condition_id: string
  question_id: string
  question: string
  description: string
  market_slug: string
  end_date_iso: string         // ISO 8601
  active: boolean
  closed: boolean
  archived: boolean
  accepting_orders: boolean
  minimum_order_size: number   // e.g. 5
  minimum_tick_size: number    // e.g. 0.001
  neg_risk: boolean
  tokens: Array<{
    token_id: string           // large integer string
    outcome: string            // "Yes" | "No"
    price: number              // 0-1 (number, not string)
    winner: boolean
  }>
}
```

#### `GET /price?token_id=:id&side=BUY` Response

```typescript
// ⚠️ price is a STRING, not a number
{ price: "0.015" }
```

```bash
curl "https://clob.polymarket.com/price?token_id=<YES_TOKEN_ID>&side=BUY"
```

#### `GET /book?token_id=:id` Response

```typescript
interface ClobOrderBook {
  market: string          // condition_id
  asset_id: string        // token_id
  timestamp: string       // unix ms as string
  hash: string
  bids: Array<{ price: string; size: string }>   // ⚠️ both strings
  asks: Array<{ price: string; size: string }>
  min_order_size: string
  tick_size: string
  neg_risk: boolean
  last_trade_price: string
}
```

#### Notes
- `GET /markets` is paginated; `GET /markets/:condition_id` returns a single object
- `/price` endpoint uses `side=BUY` for best bid (closest to current market price)
- All prices in order book are **strings** — `parseFloat()` before use

---

### Valyu — Research API

**Base URL:** `https://api.valyu.network/v1`
**Auth:** `x-api-key` header
**Rate Limit:** Varies by plan (check dashboard)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/deepsearch` | Search for recent news and research content |

> **⚠️ Endpoint correction:** The correct path is `/deepsearch`, not `/search` as previously documented.

#### Request Shape

```typescript
interface ValyuSearchRequest {
  query: string
  search_type: 'all' | 'proprietary' | 'web' | 'academic'
  max_num_results?: number    // default 10; use 5 for agent calls
  max_price?: number          // max cost per query in credits
}
```

```bash
curl -X POST https://api.valyu.network/v1/deepsearch \
  -H "Content-Type: application/json" \
  -H "x-api-key: $VALYU_API_KEY" \
  -d '{"query": "Trump deportation 2025", "search_type": "web", "max_num_results": 5}'
```

#### Response Shape

```typescript
interface ValyuSearchResponse {
  success: boolean
  error: string              // empty string on success
  tx_id: string              // e.g. "tx_9d9b4439-..."
  query: string              // echoed back
  results: Array<{
    title: string
    url: string
    content: string          // full article text (can be long — truncate for agent context)
    source?: string
  }>
  total_deduction_dollars: number   // cost of this query
  total_characters: number
  results_by_source?: Record<string, unknown>
}
```

#### Notes
- Check `success === true` before using results; error detail is in `error` field
- `content` can be very long — truncate to ~500 chars when building agent context strings
- `search_type: 'all'` gives broadest coverage; `'web'` for fresh breaking news
- `max_num_results: 5` is sufficient for market analysis — avoids excess token usage

---

### Rate Limit Backoff Pattern

All API wrappers in `src/data/` implement exponential backoff:

```
Attempt 1: immediate
Attempt 2: wait 1s
Attempt 3: wait 2s
Attempt 4: wait 4s
Max attempts: 4
```

Retry on HTTP 429 or 5xx. Return error immediately on 4xx (except 429).

---

## Normalization

All Polymarket responses are normalized to the shared `Market` type in `src/data/polymarket.ts`:

```typescript
function gammaToMarket(gamma: GammaMarket): Market {
  // outcomePrices is a JSON string of STRING numbers — parse twice
  const prices = JSON.parse(gamma.outcomePrices) as string[]
  const tokenIds = JSON.parse(gamma.clobTokenIds) as string[]

  return {
    id: gamma.id,                                      // Gamma numeric ID
    conditionId: gamma.conditionId,                    // 0x hex for CLOB calls
    tokenIds: [tokenIds[0] ?? '', tokenIds[1] ?? ''],  // [YES, NO]
    platform: 'polymarket',
    question: gamma.question,
    probability: parseFloat(prices[0]),                // YES price, 0-1
    volume: parseFloat(gamma.volume),
    liquidity: parseFloat(gamma.liquidity),
    endDate: gamma.endDate,
    url: `https://polymarket.com/event/${gamma.slug}`,
    category: gamma.category,
    lastUpdated: gamma.updatedAt,
  }
}
```

---

## Internal API Routes (Next.js App Router)

All routes are under `src/app/api/`.

### `GET /api/health`

```typescript
interface HealthResponse {
  status: 'ok' | 'error'
  uptime: number            // seconds since server start
  lastScanAt: string | null // ISO 8601
  signalCount: number
}
```

---

### `GET /api/markets`

```typescript
// ?category=politics&limit=50
interface MarketsResponse {
  markets: Market[]
  total: number
  lastFetchedAt: string
}
```

**React Query hook:** `useMarkets(category?, limit?)` — poll every `NEXT_PUBLIC_POLL_INTERVAL_MS`

---

### `GET /api/markets/[id]`

```typescript
interface MarketDetailResponse {
  market: Market
  orderBook?: {
    bids: Array<{ price: number; size: number }>
    asks: Array<{ price: number; size: number }>
  }
  signals: Signal[]
}
```

---

### `GET /api/signals`

```typescript
// ?confidence=high&minEv=0.05
interface SignalsResponse {
  signals: Signal[]
  total: number
}
```

---

### `POST /api/analyze`

```typescript
// Request
interface AnalyzeRequest { marketId: string }

// Response
interface AnalyzeResponse {
  signal: Signal | null
  reasoning: string
  toolCalls: ToolCallRecord[]
}
```

---

### Error Shape

```typescript
interface ApiError {
  error: string
  status: number
}
```

---

## Removed from MVP

- **Kalshi API** — dropped to reduce surface area (Polymarket only)
- **`GET /events`** (Gamma) — not needed; `/markets` provides sufficient data
- **`GET /prices`** (CLOB, plural) — use `/price?token_id=...&side=BUY` instead
