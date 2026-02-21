# Darwin Capital — API Reference

> External APIs (Polymarket, Valyu) and internal Next.js API routes.

---

## External APIs

### Polymarket — CLOB API

**Base URL:** `https://clob.polymarket.com`
**Auth:** None required for public market data
**Rate Limit:** ~100 requests/minute (undocumented, use conservative backoff)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | List active markets with pagination |
| GET | `/markets/{condition_id}` | Single market by condition ID |
| GET | `/prices` | Current YES/NO prices for markets |
| GET | `/book` | Order book for a specific market |

#### Response Shape

```typescript
interface PolymarketMarket {
  condition_id: string
  question_id: string
  question: string
  description: string
  market_slug: string
  end_date_iso: string
  active: boolean
  closed: boolean
  tokens: Array<{
    token_id: string
    outcome: string    // "Yes" | "No"
    price: number
    winner: boolean
  }>
}
```

#### Notes
- Token prices are 0-1 representing probability
- `condition_id` is the primary key
- Pagination via `next_cursor` parameter

---

### Polymarket — Gamma API

**Base URL:** `https://gamma-api.polymarket.com`
**Auth:** None required
**Rate Limit:** ~60 requests/minute

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | Search/filter markets with metadata |
| GET | `/events` | Market events with grouping |

#### Response Shape

```typescript
interface GammaMarket {
  id: string
  question: string
  slug: string
  endDate: string
  liquidity: number
  volume: number
  outcomePrices: string  // JSON-encoded: "[0.65, 0.35]"
  outcomes: string       // JSON-encoded: "[\"Yes\", \"No\"]"
  category: string
  active: boolean
}
```

#### Notes
- Gamma provides higher-level metadata: volume, liquidity, category
- Use Gamma for discovery/filtering, CLOB for real-time prices and order books
- `outcomePrices` is a **JSON string** that needs `JSON.parse()`

---

### Valyu — Research API

**Base URL:** `https://api.valyu.network/v1`
**Auth:** `x-api-key` header
**Rate Limit:** Varies by plan (check dashboard)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/search` | Search for research content |

#### Request Shape

```typescript
interface ValyuSearchRequest {
  query: string
  search_type: 'all' | 'proprietary' | 'web' | 'academic'
  max_num_results?: number    // default 10
  max_price?: number          // max cost per query in credits
}
```

#### Response Shape

```typescript
interface ValyuSearchResponse {
  results: Array<{
    title: string
    url: string
    content: string
    source: string
    relevance_score: number
  }>
  total_results: number
  credits_used: number
}
```

#### Notes
- POST with JSON body
- Auth: `x-api-key: <VALYU_API_KEY>`
- Use `search_type: 'all'` for broadest coverage
- `max_num_results: 5` is sufficient for market research

---

### Rate Limit Backoff Pattern

All API wrappers implement exponential backoff:

```
Attempt 1: immediate
Attempt 2: wait 1s
Attempt 3: wait 2s
Attempt 4: wait 4s
Max attempts: 4
```

On 429 or 5xx → retry with backoff. On 4xx (not 429) → return error immediately.

---

## Normalization

All Polymarket responses are normalized to the shared `Market` type:

```typescript
function gammaToMarket(gamma: GammaMarket): Market {
  const prices = JSON.parse(gamma.outcomePrices) as number[]
  return {
    id: gamma.id,
    platform: 'polymarket',
    question: gamma.question,
    probability: prices[0],           // YES price
    volume: gamma.volume,
    liquidity: gamma.liquidity,
    endDate: gamma.endDate,
    url: `https://polymarket.com/event/${gamma.slug}`,
    category: gamma.category,
    lastUpdated: new Date().toISOString(),
  }
}
```

---

## Internal API Routes (Next.js App Router)

All routes are under `src/app/api/`.

### `GET /api/health`

Health check.

```typescript
// Response
interface HealthResponse {
  status: 'ok' | 'error'
  uptime: number           // seconds
  lastScanAt: string | null // ISO 8601
  signalCount: number
}
```

```bash
curl http://localhost:3000/api/health
```

**React Query hook:** `useHealth()` — poll every 60s

---

### `GET /api/markets`

Returns cached Polymarket markets.

```typescript
// Query params
// ?category=politics&limit=50

// Response
interface MarketsResponse {
  markets: Market[]
  total: number
  lastFetchedAt: string
}
```

```bash
curl http://localhost:3000/api/markets?category=politics&limit=20
```

**React Query hook:** `useMarkets(category?, limit?)` — poll every `NEXT_PUBLIC_POLL_INTERVAL_MS`

---

### `GET /api/markets/[id]`

Single market with order book data.

```typescript
// Response
interface MarketDetailResponse {
  market: Market
  orderBook?: {
    bids: Array<{ price: number; size: number }>
    asks: Array<{ price: number; size: number }>
  }
  signals: Signal[]  // signals for this market
}
```

```bash
curl http://localhost:3000/api/markets/abc123
```

**React Query hook:** `useMarket(id)` — poll every `NEXT_PUBLIC_POLL_INTERVAL_MS`

---

### `GET /api/signals`

All active signals from the in-memory store.

```typescript
// Query params
// ?confidence=high&minEv=0.05

// Response
interface SignalsResponse {
  signals: Signal[]
  total: number
}
```

```bash
curl http://localhost:3000/api/signals?minEv=0.05
```

**React Query hook:** `useSignals(filters?)` — poll every `NEXT_PUBLIC_POLL_INTERVAL_MS`

---

### `POST /api/analyze`

On-demand analysis of a single market. Triggers the Event Pod agent.

```typescript
// Request
interface AnalyzeRequest {
  marketId: string
}

// Response
interface AnalyzeResponse {
  signal: Signal | null
  reasoning: string
  toolCalls: ToolCallRecord[]
}
```

```bash
curl -X POST http://localhost:3000/api/analyze \
  -H 'Content-Type: application/json' \
  -d '{"marketId": "abc123"}'
```

**React Query hook:** `useAnalysis()` — mutation, not polling

---

### Error Shape

All API routes return errors in this shape:

```typescript
interface ApiError {
  error: string
  status: number
}
```

Example: `{ "error": "Market not found", "status": 404 }`

---

## Removed from MVP

The following APIs are **not used** in the hackathon build:

- **Kalshi API** — dropped to reduce surface area (Polymarket only)
