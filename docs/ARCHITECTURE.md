# Darwin Capital — Architecture

> Simplified for HackEurope 2026. Unified Next.js app, single strategy, Polymarket only.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP (unified)                         │
│                                                                  │
│  ┌─────────────────────────────┐  ┌───────────────────────────┐ │
│  │        FRONTEND             │  │      API ROUTES           │ │
│  │                             │  │                           │ │
│  │  Market Grid (page.tsx)     │  │  GET /api/health          │ │
│  │  Market Detail ([id])       │  │  GET /api/markets         │ │
│  │  React Query (polling)      │  │  GET /api/markets/[id]    │ │
│  │  Tailwind dark theme        │  │  GET /api/signals         │ │
│  │                             │  │  POST /api/analyze        │ │
│  └──────────┬──────────────────┘  └──────────┬────────────────┘ │
│             │ fetch + poll                    │                  │
│             └─────────────┬───────────────────┘                  │
│                           ▼                                      │
│              ┌────────────────────────┐                          │
│              │   IN-MEMORY STORE      │                          │
│              │   Map<string, Signal>  │                          │
│              └───────────┬────────────┘                          │
│                          ▼                                       │
│              ┌────────────────────────┐                          │
│              │   EVENT POD AGENT      │                          │
│              │                        │                          │
│              │   mandate + tools      │                          │
│              │   generateText loop    │                          │
│              │   max 10 iterations    │                          │
│              └──┬──────────────────┬──┘                          │
│                 │                  │                              │
│                 ▼                  ▼                              │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   Polymarket     │  │   Valyu          │                     │
│  │   Gamma + CLOB   │  │   Research API   │                     │
│  │   (market data)  │  │   (news context) │                     │
│  └──────────────────┘  └──────────────────┘                     │
│         EXTERNAL              EXTERNAL                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Scan Cycle

Runs on interval (`CYCLE_INTERVAL_MS`, default 5 min):

```
1. FETCH    → Polymarket Gamma API → normalized Market[]
2. FILTER   → politics category, min liquidity, ending-soon priority
3. ANALYZE  → Event Pod agent runs tool-use loop on each market batch:
               fetchRecentNews → estimateEventProbability →
               calculatePriceDivergence → propose trade if |EV| > threshold
4. STORE    → Signal objects written to in-memory Map
5. SERVE    → API routes read from store → React Query polls → UI updates
```

## Data Flow: On-Demand Analysis

User clicks "Analyze" on a market detail page:

```
1. POST /api/analyze { marketId }
2. API route fetches single market from Polymarket
3. Event Pod agent runs full tool loop on that market
4. Signal stored in memory
5. Signal returned to client
```

---

## Core Types

### `Market` — normalized market data (`src/lib/types.ts`)

```typescript
interface Market {
  id: string
  platform: 'polymarket'
  question: string
  probability: number     // 0-1, current market price
  volume: number          // total volume in USD
  liquidity: number       // current liquidity in USD
  endDate: string         // ISO 8601
  url: string
  category?: string
  lastUpdated: string     // ISO 8601
}
```

### `Signal` — agent output stored in memory (`src/lib/types.ts`)

```typescript
interface Signal {
  id: string
  marketId: string
  marketQuestion: string
  darwinEstimate: number   // agent's probability estimate
  marketPrice: number      // current market price
  ev: number               // darwinEstimate - marketPrice
  direction: Direction     // 'yes' | 'no'
  reasoning: string
  newsEvents: string[]
  confidence: 'low' | 'medium' | 'high'
  createdAt: string
  expiresAt: string
}
```

### `AgentOutput` — what the agent returns (`src/agent/types.ts`)

```typescript
interface AgentOutput {
  proposals: TradeProposal[]
  reasoning: string
  toolCalls: ToolCallRecord[]
}
```

### `TradeProposal` — individual trade signal (`src/lib/types.ts`)

```typescript
interface TradeProposal {
  id: string
  marketId: string
  platform: 'polymarket'
  direction: Direction
  confidence: number
  estimatedProbability: number
  marketProbability: number
  ev: number
  reasoning: string
  timestamp: string
}
```

---

## EV Formula

```
EV = estimatedProbability - marketPrice
```

A trade is proposed when `|EV| > EV_THRESHOLD` (default 0.05).

- Positive EV → buy YES (market underpriced)
- Negative EV → buy NO (market overpriced)

---

## What Is NOT in MVP

Explicitly excluded to keep scope tight:

- No Kalshi — Polymarket only
- No SQLite / database — in-memory store
- No arbitrage pod — single strategy
- No time-series pod — single strategy
- No risk manager — no position sizing, drawdown, concentration checks
- No virtual trading engine — signals only, no paper trading
- No WebSocket — polling via React Query
- No authentication — public dashboard
- No persistent storage — state resets on restart
