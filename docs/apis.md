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

## Merge Notes — API Integration (agents ← vlad branch)

> **Status:** Pending merge. The `vlad` branch has production-ready data wrappers
> (`src/data/polymarket.ts`, `src/data/valyu.ts`) that are more complete than the
> agent branch versions. This section documents what needs to happen when merging.

### Key Differences from Agent Branch

The `vlad` branch data wrappers have richer types and more API coverage. After merge,
the agent nodes should be updated to use these instead of the current simpler versions.

**Market type gains new fields:**

```typescript
// vlad's Market type adds:
conditionId: string              // CLOB condition_id (0x hex) — for CLOB API calls
tokenIds: [string, string]      // [YES token_id, NO token_id] — for price/book queries
```

These are needed if we want to fetch live CLOB prices or order books during analysis.

**Polymarket wrapper gains new functions:**

| Function | What it does | Potential agent use |
|----------|-------------|---------------------|
| `fetchMarketById(gammaId)` | Single market by Gamma ID | Replace current `fetchMarketDetail` |
| `fetchClobMarket(conditionId)` | CLOB market by condition_id | Live price during analysis |
| `fetchTokenPrice(tokenId)` | Real-time YES price from CLOB | More accurate than Gamma price |
| `fetchOrderBook(tokenId)` | Bid/ask depth | Liquidity check before signaling |
| `fetchClobMarkets(limit, cursor)` | Paginated CLOB markets | Batch scanning |

**Valyu wrapper differences:**

| Aspect | Agent branch | Vlad branch |
|--------|-------------|-------------|
| Endpoint | `POST /v1/search` | `POST /v1/deepsearch` |
| Return type | `Result<NewsResult[]>` | `Result<NewsSearchResult>` (wraps results + query + totalFound) |
| `NewsResult` | `{ title, content, source, relevanceScore }` | Adds `url: string` |
| Extra functions | — | `searchWebNews()`, `buildNewsQuery()` |
| Config | `config.valyuApiKey` | `config.valyuApiKey` + `config.valyu.baseUrl` |

**Config structure differs:**

```typescript
// vlad's config is nested:
config.polymarket.gammaBaseUrl   // 'https://gamma-api.polymarket.com'
config.polymarket.clobBaseUrl    // 'https://clob.polymarket.com'
config.valyu.baseUrl             // 'https://api.valyu.network/v1'

// agent branch config is flat:
config.valyuApiKey
config.evThreshold
```

### Suggested Integration Steps

1. **Use vlad's `src/data/polymarket.ts` as the source of truth** — it has more API
   coverage (CLOB price, order book, paginated markets). Drop the agent branch version.

2. **Use vlad's `src/data/valyu.ts` as the source of truth** — it uses the correct
   `/deepsearch` endpoint and has `buildNewsQuery()` which strips prediction-market
   phrasing from queries for better search results.

3. **Update `src/agent/nodes.ts` fetchNewsNode** — adapt to vlad's `searchNews()`
   return type (`Result<NewsSearchResult>` instead of `Result<NewsResult[]>`). The
   results are at `result.data.results` instead of `result.data`.

4. **Update `src/lib/types.ts`** — merge vlad's richer types (add `GammaMarket`,
   `ClobMarket`, `ClobToken`, `ClobOrderBook`, `conditionId`/`tokenIds` on Market).
   The `ToolCallRecord` field name differs: vlad uses `tool` + `durationMs`, agent
   branch uses `name` + no duration. Pick one and update both sides.

5. **Update `src/lib/config.ts`** — adopt vlad's nested config structure, but keep
   the Vertex AI fields (`googleCloudProject`, `vertexRegion`) and `useMockData` toggle
   from the agent branch. Vlad's config uses `requireEnv()` for `VALYU_API_KEY` which
   will throw without it — guard this behind `useMockData` check.

6. **Consider using `fetchTokenPrice()` in the agent** — the current agent uses
   `market.probability` (from Gamma, which can be stale). Using CLOB's live price
   would give a more accurate `marketPrice` for EV calculation. This could be a new
   node or an enhancement to `fetchNewsNode`.

### Data Shape TBDs

> These will become clear once we merge and inspect real API responses together.

- **GammaMarket `outcomePrices`** — vlad confirmed it's a JSON string of string decimals
  (e.g. `"[\"0.022\", \"0.978\"]"`), not numbers. The normalization handles this.
- **Valyu `/deepsearch` vs `/search`** — vlad's branch uses `/deepsearch`, agent branch
  uses `/search`. Need to confirm which endpoint is current/correct with the Valyu team.
- **Order book depth** — unclear how deep the book goes and whether shallow markets
  should suppress signals (liquidity risk).

---

## Removed from MVP

The following APIs are **not used** in the hackathon build:

- **Kalshi API** — dropped to reduce surface area (Polymarket only)
