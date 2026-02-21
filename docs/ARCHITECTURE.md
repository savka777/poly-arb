# Darwin Capital — Architecture Reference

> This file is for context only. It contains no instructions.
> For execution protocol and coding standards, see `CLAUDE.md`.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Darwin Capital Engine                       │
│                                                                 │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐                    │
│  │Polymarket│   │  Kalshi  │   │Metaculus │                    │
│  │  CLOB +  │   │   API    │   │   API    │                    │
│  │  Gamma   │   │          │   │          │                    │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘                    │
│       │              │              │                           │
│       └──────────────┴──────────────┘                           │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Market Fetcher │ ◄── LangGraph Node       │
│                    │  (normalize)    │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│              ┌──────────────┼──────────────┐                   │
│              │              │              │                    │
│     ┌────────▼──┐  ┌───────▼───┐  ┌───────▼──────┐           │
│     │ News-Lag  │  │ Arbitrage │  │  Time-Decay  │           │
│     │ Strategy  │  │ Strategy  │  │  Strategy    │           │
│     └────────┬──┘  └───────┬───┘  └───────┬──────┘           │
│              │              │              │                    │
│              └──────────────┼──────────────┘                   │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │ Signal Aggreg.  │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐    ┌─────────┐          │
│                    │  LLM Estimator │◄───│  Valyu  │          │
│                    │  (Vercel AI)   │    │Research │          │
│                    └────────┬────────┘    └─────────┘          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │   Risk Node    │                          │
│                    │  (sizing/stop) │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Executor Node │                          │
│                    │ (paper trades) │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │    SQLite DB   │                          │
│                    │ signals/trades │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  REST API      │──── GET /api/signals      │
│                    │  (Express)     │──── GET /api/trades       │
│                    │                │──── GET /api/health       │
│                    └─────────────────┘                          │
│                             │                                   │
│                    ┌────────▼────────┐                          │
│                    │  Next.js       │  (built by teammates)     │
│                    │  Frontend      │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## LangGraph Node Definitions

The orchestration graph is a linear pipeline with conditional branching on risk assessment.

| Node | Input | Output | Description |
|------|-------|--------|-------------|
| `fetch-markets` | `DarwinState` (empty markets) | `DarwinState` (populated markets) | Calls all data wrappers, normalizes to `Market[]` |
| `analyze` | `DarwinState` (markets) | `DarwinState` (raw signals) | Runs all registered strategies via `registry.strategies` |
| `estimate` | `DarwinState` (raw signals) | `DarwinState` (signals with LLM probabilities) | Calls `callLLM` for each signal to get probability estimate + reasoning |
| `risk` | `DarwinState` (estimated signals) | `DarwinState` (sized signals) | Applies position sizing, stop-loss, portfolio-level risk limits |
| `execute` | `DarwinState` (sized signals) | `DarwinState` (trades) | Records paper trades in SQLite, updates signal status |

### Graph Flow

```
START → fetch-markets → analyze → estimate → risk → execute → END
```

The graph runs as a single cycle. The scheduler in `src/scheduler.ts` invokes the graph repeatedly on a configurable interval.

---

## DarwinState Type

```typescript
interface DarwinState {
  markets: Market[]
  signals: Signal[]
  trades: Trade[]
  errors: string[]
  metadata: {
    cycleId: string
    startedAt: string
    completedAt?: string
  }
}
```

---

## Core Types

```typescript
interface Market {
  id: string
  platform: 'polymarket' | 'kalshi' | 'metaculus'
  question: string
  probability: number          // 0-1, current market price
  volume: number               // total volume in USD
  endDate: string              // ISO 8601
  url: string
  category?: string
  lastUpdated: string          // ISO 8601
}

interface Signal {
  id: string
  strategy: string             // which strategy produced this
  marketId: string
  platform: string
  direction: 'yes' | 'no'
  confidence: number           // 0-1
  estimatedProbability: number // LLM estimate, 0-1
  marketProbability: number    // current market price, 0-1
  ev: number                   // expected value
  reasoning: string
  timestamp: string
}

interface Trade {
  id: string
  signalId: string
  marketId: string
  platform: string
  direction: 'yes' | 'no'
  size: number                 // notional USD
  entryPrice: number
  timestamp: string
  status: 'open' | 'closed' | 'cancelled'
}
```

---

## Strategy Interface

```typescript
interface Strategy {
  name: string
  description: string
  scan(markets: Market[], ctx: StrategyContext): Promise<Signal[]>
}

interface StrategyContext {
  callLLM: (opts: { system: string; prompt: string; maxTokens?: number }) => Promise<Result<string>>
  fetchResearch: (query: string) => Promise<Result<string>>
  now: Date
}
```

### Registered Strategies

| # | Name | Description |
|---|------|-------------|
| 1 | News-Lag | Detects markets that haven't reacted to recent news. Uses Valyu research API to find relevant news, compares current price to LLM-estimated post-news probability. |
| 2 | Arbitrage | Finds the same event priced differently across platforms. Compares YES/NO prices on matched markets. Requires `p1 + (1 - p2) < 1` across platforms for pure arbitrage. |
| 3 | Time-Decay | Identifies markets near expiration where price hasn't converged to 0 or 1. As expiration approaches, prices should polarize — opportunities exist when they don't. |

### Adding a New Strategy

1. Create `src/strategies/<name>.ts` implementing `Strategy`
2. Import and add to the array in `src/strategies/registry.ts`
3. The orchestrator automatically iterates all registered strategies

---

## Strategy Math

### Expected Value (EV)

```
EV = (estimated_probability × payout_if_yes) - (cost_of_position)

For binary markets with normalized prices:
EV = (p_estimated × (1 - price_yes)) - ((1 - p_estimated) × price_yes)
   = p_estimated - price_yes
```

A signal is generated when `|EV| > threshold` (configurable, default 0.05).

### Arbitrage Condition

For the same event on platforms A and B:
```
Platform A: YES @ price_a
Platform B: NO  @ price_b  (equivalent to YES @ 1 - price_b)

Arbitrage exists when:
  price_a + price_b < 1   (buy YES on A, buy NO on B)
  OR
  (1 - price_a) + (1 - price_b) < 1  →  price_a + price_b > 1
  (buy NO on A, buy YES on B)

Profit = |1 - price_a - price_b| per unit (minus fees)
```

### Time Decay

```
days_remaining = (endDate - now) / (1000 × 60 × 60 × 24)
decay_factor = 1 - (1 / (1 + days_remaining))

Signal strength increases as:
  - days_remaining → 0
  - |probability - 0.5| remains small (price hasn't polarized)

time_decay_score = (1 - decay_factor) × (1 - |2 × probability - 1|)
```

---

## Target File Structure

```
poly-arb/
├── CLAUDE.md
├── .env.example
├── doc_logs.md
├── progress.txt
├── package.json
├── tsconfig.json
├── docs/
│   ├── ARCHITECTURE.md
│   └── API_REFERENCE.md
├── src/
│   ├── index.ts                  # entry point
│   ├── scheduler.ts              # interval-based graph execution
│   ├── lib/
│   │   ├── types.ts              # Result<T>, Market, Signal, Trade, DarwinState
│   │   ├── result.ts             # ok(), err(), isOk() helpers
│   │   ├── model.ts              # Vercel AI SDK LLM entry point
│   │   └── config.ts             # env loading + validation
│   ├── data/
│   │   ├── polymarket.ts         # Polymarket CLOB + Gamma
│   │   ├── kalshi.ts
│   │   ├── metaculus.ts
│   │   └── valyu.ts              # research API
│   ├── intelligence/
│   │   ├── calculations.ts       # EV, arbitrage, time-decay math
│   │   ├── calculations.test.ts
│   │   ├── llm-estimator.ts      # LLM probability estimation
│   │   └── market-matcher.ts     # cross-platform market matching
│   ├── strategies/
│   │   ├── types.ts              # Strategy interface
│   │   ├── registry.ts           # strategy array
│   │   ├── news-lag.ts
│   │   ├── arbitrage.ts
│   │   └── time-decay.ts
│   ├── graph/
│   │   ├── state.ts              # DarwinState for LangGraph
│   │   ├── graph.ts              # StateGraph wiring
│   │   └── nodes/
│   │       ├── fetch-markets.ts
│   │       ├── analyze.ts
│   │       ├── estimate.ts
│   │       ├── risk.ts
│   │       └── execute.ts
│   ├── db/
│   │   ├── sqlite.ts             # DB setup + migrations
│   │   └── queries.ts            # typed insert/select
│   └── api/
│       └── server.ts             # Express REST API
└── data/
    └── darwin.db                 # SQLite database (gitignored)
```
