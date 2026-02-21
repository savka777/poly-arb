# Darwin Capital — API Reference

> This file is for reference only. It contains no instructions.
> Before implementing any wrapper, verify the endpoint with a test fetch.

---

## 1. Polymarket — CLOB API

**Base URL:** `https://clob.polymarket.com`
**Auth:** None required for public market data
**Rate Limit:** ~100 requests/minute (undocumented, use conservative backoff)
**Last verified:** Feb 2026

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | List active markets with pagination |
| GET | `/markets/{condition_id}` | Single market by condition ID |
| GET | `/prices` | Current YES/NO prices for markets |
| GET | `/book` | Order book for a specific market |

### Key Response Shape

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

### Notes

- Polymarket uses a CLOB (Central Limit Order Book) model
- Token prices are 0-1 representing probability
- `condition_id` is the primary key for markets
- Pagination: use `next_cursor` parameter

---

## 2. Polymarket — Gamma API

**Base URL:** `https://gamma-api.polymarket.com`
**Auth:** None required for public data
**Rate Limit:** ~60 requests/minute
**Last verified:** Feb 2026

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | Search/filter markets with metadata |
| GET | `/events` | Market events with grouping |

### Key Response Shape

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

### Notes

- Gamma provides higher-level market metadata (volume, liquidity, category)
- Use Gamma for discovery/filtering, CLOB for real-time prices
- `outcomePrices` is a JSON string that needs parsing

---

## 3. Kalshi

**Base URL:** `https://api.elections.kalshi.com/trade-api/v2`
**Auth:** API key in `Authorization` header as Bearer token
**Rate Limit:** 100 requests/minute per key
**Last verified:** Feb 2026

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/markets` | List markets with pagination |
| GET | `/markets/{ticker}` | Single market by ticker |
| GET | `/series/{series_ticker}` | Get all markets in a series |
| GET | `/events` | List events |
| GET | `/events/{event_ticker}` | Single event details |

### Key Response Shape

```typescript
interface KalshiMarket {
  ticker: string
  event_ticker: string
  series_ticker: string
  title: string
  subtitle: string
  yes_ask: number          // lowest ask for YES in cents (1-99)
  yes_bid: number          // highest bid for YES in cents
  no_ask: number
  no_bid: number
  volume: number
  open_interest: number
  close_time: string       // ISO 8601
  status: string           // "open" | "closed" | "settled"
  result: string           // "yes" | "no" | "" (if unsettled)
  category: string
}
```

### Notes

- Prices are in cents (1-99), divide by 100 to normalize to 0-1
- Auth: `Authorization: Bearer <KALSHI_API_KEY>`
- Markets are grouped by events and series
- Use `status=open` filter to get only active markets

---

## 4. Metaculus

**Base URL:** `https://www.metaculus.com/api2`
**Auth:** None required for public questions
**Rate Limit:** ~60 requests/minute
**Last verified:** Feb 2026

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/questions/` | List questions with search and filters |
| GET | `/questions/{id}/` | Single question details |
| GET | `/questions/{id}/predictions/` | Community prediction history |

### Key Response Shape

```typescript
interface MetaculusQuestion {
  id: number
  title: string
  url: string
  created_time: string
  publish_time: string
  close_time: string
  resolve_time: string
  possibilities: {
    type: string           // "binary"
  }
  community_prediction: {
    full: {
      q2: number           // median prediction (0-1 for binary)
    }
  }
  number_of_predictions: number
  status: string           // "open" | "closed" | "resolved"
}
```

### Notes

- Community prediction `q2` is the median — use as current probability
- Binary questions only for matching with prediction markets
- Filter with `?type=question&status=open` for active binary questions
- Response is paginated with `next` URL field

---

## 5. Valyu

**Base URL:** `https://api.valyu.network/v1`
**Auth:** API key via `x-api-key` header
**Rate Limit:** Check dashboard (varies by plan)
**Last verified:** Feb 2026

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/search` | Search for research content |

### Request Shape

```typescript
interface ValyuSearchRequest {
  query: string
  search_type: 'all' | 'proprietary' | 'web' | 'academic'
  max_num_results?: number    // default 10
  max_price?: number          // max cost per query in credits
}
```

### Key Response Shape

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

### Notes

- Used by the LLM estimator and news-lag strategy for research context
- POST request with JSON body
- Auth: `x-api-key: <VALYU_API_KEY>`
- Use `search_type: 'all'` for broadest coverage
- `max_num_results: 5` is usually sufficient for market research

---

## Common Patterns

### Rate Limit Backoff

All wrappers should implement exponential backoff:

```
Attempt 1: immediate
Attempt 2: wait 1s
Attempt 3: wait 2s
Attempt 4: wait 4s
Max attempts: 4
```

### Normalization to Market Type

All API responses should be normalized to the shared `Market` interface:

```typescript
interface Market {
  id: string
  platform: 'polymarket' | 'kalshi' | 'metaculus'
  question: string
  probability: number     // 0-1
  volume: number          // USD
  endDate: string         // ISO 8601
  url: string
  category?: string
  lastUpdated: string     // ISO 8601
}
```

Platform-specific normalization notes:
- **Kalshi:** `yes_bid / 100` for probability
- **Metaculus:** `community_prediction.full.q2` for probability
- **Polymarket:** YES token `price` for probability
