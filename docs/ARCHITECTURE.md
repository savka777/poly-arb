# Darwin Capital — Architecture Reference

> This file is for context only. It contains no instructions.
> For execution protocol and coding standards, see `CLAUDE.md`.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER (shared)                          │
│  ┌────────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ Polymarket │  │  Kalshi  │  │  Valyu   │                        │
│  │ CLOB+Gamma │  │   API    │  │ Research │                        │
│  └─────┬──────┘  └────┬─────┘  └────┬─────┘                        │
│        └───────────────┼─────────────┘                              │
│                        ▼                                            │
│              ┌─────────────────┐                                    │
│              │  Market Filter  │  90% ending-soon / 10% trending    │
│              │  Batch by 100   │  politics filter, min liquidity    │
│              └────────┬────────┘                                    │
│                       ▼                                             │
│  ┌──────────────────────────────────────────────────┐               │
│  │              STRATEGY PODS (competing)            │               │
│  │                                                   │               │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────┐      │               │
│  │  │ Event   │  │  Arb    │  │ Time-Series │      │               │
│  │  │  Pod    │  │  Pod    │  │    Pod      │      │               │
│  │  │         │  │         │  │             │      │               │
│  │  │ Agent:  │  │ Agent:  │  │ Agent:      │      │               │
│  │  │ mandate │  │ mandate │  │ mandate     │      │               │
│  │  │ +tools  │  │ +tools  │  │ +tools      │      │               │
│  │  └────┬────┘  └────┬────┘  └──────┬──────┘      │               │
│  │       └─────────────┼─────────────┘              │               │
│  └─────────────────────┼────────────────────────────┘               │
│                        ▼                                            │
│              ┌─────────────────┐                                    │
│              │  TradeProposals │                                    │
│              └────────┬────────┘                                    │
│                       ▼                                             │
│              ┌─────────────────┐  Hardcoded checks:                 │
│              │  RISK MANAGER   │  position size, concentration,     │
│              │  (algorithmic)  │  drawdown, liquidity, correlation  │
│              └────────┬────────┘                                    │
│                       ▼                                             │
│              ┌─────────────────┐                                    │
│              │ VIRTUAL TRADING │  Submit orders, track fills,       │
│              │     ENGINE      │  slippage, PnL, mark-to-market    │
│              └────────┬────────┘                                    │
│                       ▼                                             │
│         ┌─────────────┴─────────────┐                               │
│         ▼                           ▼                               │
│  ┌──────────────┐          ┌────────────────┐                       │
│  │  SQLite DB   │          │ Decision Log   │                       │
│  │ pods/trades/ │          │ full trace per │                       │
│  │ positions    │          │ cycle + trade  │──► RL feedback        │
│  └──────┬───────┘          └────────────────┘    to agents          │
│         ▼                                                           │
│  ┌──────────────┐                                                   │
│  │  REST API    │──► Next.js Frontend (teammates)                   │
│  │  (Express)   │                                                   │
│  └──────────────┘                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Primitive: Generic Agent

The single most important abstraction. Everything is an instance of this.

### How It Works

1. Agent factory takes `AgentConfig` (name + mandate + tools)
2. Builds system prompt from mandate + tool descriptions
3. Calls Vercel AI SDK `generateText` with tools
4. Handles tool-call loop (max 10 iterations)
5. Collects `TradeProposal`s from tool outputs
6. Returns `AgentOutput` (proposals + reasoning + tool call records)

No LangGraph. No external orchestration library. Just Vercel AI SDK tool-use.

---

## Core Types

### Agent Types (`src/agent/types.ts`)

```typescript
interface ToolDefinition<TInput, TOutput> {
  name: string
  description: string
  parameters: ZodSchema<TInput>
  execute: (input: TInput, ctx: AgentContext) => Promise<Result<TOutput>>
}

interface AgentConfig {
  name: string          // "event-analyst-politics"
  mandate: string       // system prompt: what this agent does
  tools: ToolDefinition<unknown, unknown>[]
}

interface AgentContext {
  markets: Market[]
  portfolio: PortfolioSnapshot
  pastDecisions: DecisionLogEntry[]
  cycleId: string
}

interface AgentOutput {
  proposals: TradeProposal[]
  reasoning: string
  toolCalls: ToolCallRecord[]
}

interface ToolCallRecord {
  toolName: string
  input: unknown
  output: unknown
  timestamp: string
}
```

### Market Types (`src/lib/types.ts`)

```typescript
type Platform = 'polymarket' | 'kalshi'

type Direction = 'yes' | 'no'

type TradeStatus = 'proposed' | 'approved' | 'rejected' | 'filled' | 'closed'

interface Market {
  id: string
  platform: Platform
  question: string
  probability: number          // 0-1, current market price
  volume: number               // total volume in USD
  liquidity: number            // current liquidity in USD
  endDate: string              // ISO 8601
  url: string
  category?: string
  lastUpdated: string          // ISO 8601
}
```

### Trade & Portfolio Types (`src/portfolio/types.ts`)

```typescript
interface TradeProposal {
  id: string
  podName: string
  marketId: string
  platform: Platform
  direction: Direction
  confidence: number           // 0-1
  estimatedProbability: number // agent's estimate, 0-1
  marketProbability: number    // current market price, 0-1
  ev: number                   // expected value
  suggestedSize: number        // USD notional
  reasoning: string
  timestamp: string
}

interface Position {
  id: string
  proposalId: string
  marketId: string
  platform: Platform
  direction: Direction
  size: number                 // USD notional
  entryPrice: number
  currentPrice: number
  unrealizedPnl: number
  realizedPnl: number
  status: TradeStatus
  openedAt: string
  closedAt?: string
}

interface Fill {
  id: string
  positionId: string
  price: number
  size: number
  slippage: number
  timestamp: string
}

interface PortfolioSnapshot {
  totalValue: number
  cashBalance: number
  positions: Position[]
  totalPnl: number
  drawdown: number
  timestamp: string
}
```

### Risk Types (`src/risk/types.ts`)

```typescript
interface RiskConfig {
  maxPositionSizePct: number   // e.g. 0.10 = 10% of portfolio
  maxPodsPerInstrument: number
  maxDrawdownPct: number
  minLiquidity: number         // USD
  maxOpenPositions: number
}

interface RiskViolation {
  check: string                // which check failed
  message: string
  severity: 'warning' | 'block'
}

interface RiskCheckResult {
  approved: boolean
  violations: RiskViolation[]
  adjustedSize?: number        // risk manager may reduce size
}
```

### Pod Types (`src/pods/types.ts`)

```typescript
interface PodConfig {
  name: string                 // "event-politics", "arbitrage-cross"
  type: 'event' | 'arbitrage' | 'timeseries'
  mandate: string              // system prompt for the agent
  tools: ToolDefinition<unknown, unknown>[]
}

interface PodState {
  config: PodConfig
  lastRunAt?: string
  proposalCount: number
  approvedCount: number
  rejectedCount: number
}

interface PodPerformance {
  podName: string
  totalProposals: number
  approvedProposals: number
  totalPnl: number
  winRate: number
  avgEv: number
}
```

### Decision Types (`src/decisions/types.ts`)

```typescript
interface DecisionLogEntry {
  id: string
  cycleId: string
  podName: string
  proposalId: string
  action: 'proposed' | 'approved' | 'rejected' | 'filled' | 'closed'
  reasoning: string
  riskResult?: RiskCheckResult
  marketSnapshot: {
    marketId: string
    probability: number
    volume: number
    liquidity: number
  }
  timestamp: string
}

interface ExpectedOutcome {
  proposalId: string
  predictedProbability: number
  actualProbability?: number   // filled in at resolution
  predictedPnl: number
  actualPnl?: number           // filled in at close
}
```

---

## Tools per Pod Type

### Shared (all pods)

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `fetchMarkets` | filters (platform, category, endDate range) | `Market[]` | Get normalized markets from Polymarket + Kalshi |
| `getOrderBook` | marketId, platform | order book depth | Order book for a specific market |
| `calculateEV` | estimatedProb, marketPrice | EV number | Expected value calculation |
| `calculatePositionSize` | ev, confidence, portfolioValue, riskConfig | size in USD | Kelly or fixed-fraction sizing |
| `logDecision` | proposalId, action, reasoning | void | Write to decision trace log |

### Event Pod

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `fetchRecentNews` | query, timeWindowHours | news results | Valyu API — recent news for a query |
| `estimateEventProbability` | question, newsContext | probability + reasoning | LLM-based probability estimate |
| `calculatePriceDivergence` | estimatedProb, marketPrice | divergence score | Gap between estimate and market |
| `assessEventTimeline` | endDate, currentDate | urgency score | Time until resolution, urgency |

### Arbitrage Pod

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `crossMarketCompare` | query, markets | matched pairs | Same event across platforms |
| `calculateArbitrageSpread` | priceA, priceB, feeA, feeB | spread + profit | Net profit from price diff |
| `calculateSlippage` | orderBook, size | estimated slippage | Slippage from order book depth |
| `validateMarketMatch` | marketA, marketB | boolean + confidence | LLM-assisted: same event? |

### Time-Series Pod

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `calculateTimeDecay` | endDate, currentDate, probability | decay score | Time remaining + decay factor |
| `analyzePriceConvergence` | probability, endDate | convergence score | Is price moving toward 0 or 1? |
| `detectAnomalousDecay` | probability, endDate, volume | anomaly flag | Price NOT converging when it should |
| `calculateExpiryEV` | probability, endDate, decayFactor | EV | EV given time factor |

---

## Risk Manager Checks

The risk manager is algorithmic, NOT an LLM. It runs five checks on every `TradeProposal`:

| Check | What It Does | Config Var |
|-------|-------------|------------|
| Position Size | Reject if proposed size > `maxPositionSizePct` × portfolio value | `RISK_MAX_POSITION_SIZE_PCT` |
| Concentration | Reject if > `maxPodsPerInstrument` pods already trade this instrument | `RISK_MAX_PODS_PER_INSTRUMENT` |
| Drawdown | Reject all new trades if portfolio drawdown > `maxDrawdownPct` | `RISK_MAX_DRAWDOWN_PCT` |
| Liquidity | Reject if market liquidity < `minLiquidity` | `RISK_MIN_LIQUIDITY` |
| Correlation | Warn/reject if too many positions in same category | category count threshold |

---

## Orchestrator Cycle

One full cycle of the orchestrator (`src/orchestrator/runner.ts`):

```
1. FETCH      → Pull markets from Polymarket + Kalshi data wrappers
2. FILTER     → Apply market filter (90% ending-soon, 10% trending,
                politics category, min liquidity, batch by 100)
3. RUN PODS   → Execute each pod sequentially on filtered markets
                Each pod's agent uses its tools, returns TradeProposals
4. RISK CHECK → Run each proposal through algorithmic risk manager
5. EXECUTE    → Approved proposals → virtual trading engine
                Record fills with slippage estimation
6. LOG        → Write all decisions to decision log
                Update pod performance metrics
7. FEEDBACK   → Build context from results for next cycle's agents
```

The orchestrator runs on a configurable interval (`CYCLE_INTERVAL_MS`, default 5 minutes).

---

## Strategy Math

### Expected Value (EV)

```
EV = (estimated_probability × payout_if_yes) - (cost_of_position)

For binary markets with normalized prices:
EV = (p_estimated × (1 - price_yes)) - ((1 - p_estimated) × price_yes)
   = p_estimated - price_yes
```

A trade is proposed when `|EV| > threshold` (configurable, default 0.05).

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

## Database Schema

SQLite tables in `data/darwin.db`:

```sql
-- Pod run history
CREATE TABLE pod_runs (
  id TEXT PRIMARY KEY,
  pod_name TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  proposal_count INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0
);

-- Trade proposals from pods
CREATE TABLE trade_proposals (
  id TEXT PRIMARY KEY,
  pod_name TEXT NOT NULL,
  cycle_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  direction TEXT NOT NULL,
  confidence REAL NOT NULL,
  estimated_probability REAL NOT NULL,
  market_probability REAL NOT NULL,
  ev REAL NOT NULL,
  suggested_size REAL NOT NULL,
  reasoning TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL
);

-- Open and closed positions
CREATE TABLE positions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  market_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  direction TEXT NOT NULL,
  size REAL NOT NULL,
  entry_price REAL NOT NULL,
  current_price REAL NOT NULL,
  unrealized_pnl REAL DEFAULT 0,
  realized_pnl REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'filled',
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  FOREIGN KEY (proposal_id) REFERENCES trade_proposals(id)
);

-- Order fills
CREATE TABLE fills (
  id TEXT PRIMARY KEY,
  position_id TEXT NOT NULL,
  price REAL NOT NULL,
  size REAL NOT NULL,
  slippage REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (position_id) REFERENCES positions(id)
);

-- Decision log for observability + RL feedback
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  pod_name TEXT NOT NULL,
  proposal_id TEXT,
  action TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  risk_result TEXT,            -- JSON-serialized RiskCheckResult
  market_snapshot TEXT,        -- JSON-serialized market state
  created_at TEXT NOT NULL
);
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
├── vitest.config.ts
├── docs/
│   ├── ARCHITECTURE.md
│   └── API_REFERENCE.md
├── src/
│   ├── index.ts
│   ├── lib/
│   │   ├── types.ts            # Result<T>, Market, Platform, Direction, TradeStatus
│   │   ├── result.ts           # ok(), err(), isOk()
│   │   ├── model.ts            # Vercel AI SDK callLLM
│   │   ├── config.ts           # env loading + risk config
│   │   └── logger.ts           # structured logging
│   ├── data/
│   │   ├── polymarket.ts       # CLOB + Gamma
│   │   ├── kalshi.ts
│   │   └── valyu.ts
│   ├── agent/
│   │   ├── types.ts            # AgentConfig, AgentContext, AgentOutput
│   │   ├── create-agent.ts     # factory: (config) → runnable agent
│   │   ├── execute.ts          # tool-use loop (LLM ↔ tools)
│   │   └── agent.test.ts
│   ├── tools/
│   │   ├── types.ts            # ToolDefinition interface
│   │   ├── shared.ts           # fetchMarkets, getOrderBook, calculateEV, etc.
│   │   ├── event-pod.ts        # fetchRecentNews, estimateEventProbability, etc.
│   │   ├── arbitrage-pod.ts    # crossMarketCompare, calculateArbitrageSpread, etc.
│   │   ├── timeseries-pod.ts   # calculateTimeDecay, analyzePriceConvergence, etc.
│   │   └── tools.test.ts
│   ├── pods/
│   │   ├── types.ts            # PodConfig, PodState, PodPerformance
│   │   ├── create-pod.ts       # factory: (PodConfig) → Pod
│   │   ├── pod-configs.ts      # predefined event/arb/timeseries configs
│   │   └── pod.test.ts
│   ├── risk/
│   │   ├── types.ts            # RiskConfig, RiskCheckResult, RiskViolation
│   │   ├── manager.ts          # checkProposal() — runs all checks
│   │   ├── checks/
│   │   │   ├── position-size.ts
│   │   │   ├── concentration.ts
│   │   │   ├── drawdown.ts
│   │   │   ├── liquidity.ts
│   │   │   └── correlation.ts
│   │   └── manager.test.ts
│   ├── portfolio/
│   │   ├── types.ts            # TradeProposal, Position, PortfolioSnapshot, Fill
│   │   ├── engine.ts           # virtual trading: submit, close, mark-to-market
│   │   ├── slippage.ts         # slippage estimation from order book
│   │   └── engine.test.ts
│   ├── decisions/
│   │   ├── types.ts            # DecisionLogEntry, ExpectedOutcome
│   │   ├── logger.ts           # logDecision(), getTradeLifecycle()
│   │   └── feedback.ts         # build context from past decisions for agents
│   ├── intelligence/
│   │   ├── calculations.ts     # EV, arb spread, time decay math
│   │   ├── calculations.test.ts
│   │   └── market-matcher.ts   # cross-platform market matching
│   ├── orchestrator/
│   │   ├── runner.ts           # full cycle: fetch → filter → pods → risk → execute → log
│   │   ├── market-filter.ts    # batch filtering (politics, ending-soon, liquidity)
│   │   └── runner.test.ts
│   ├── db/
│   │   ├── sqlite.ts           # schema: pods, positions, trade_proposals, decisions, fills
│   │   └── queries.ts          # typed insert/select for all tables
│   └── api/
│       ├── server.ts           # Express app, wire routes
│       └── routes/
│           ├── pods.ts         # GET /api/pods, /api/pods/:id/performance
│           ├── portfolio.ts    # GET /api/portfolio, /api/portfolio/pnl
│           ├── decisions.ts    # GET /api/decisions, /api/decisions/:tradeId
│           ├── trades.ts       # GET /api/trades
│           └── health.ts       # GET /api/health
└── data/
    └── darwin.db               # SQLite (gitignored)
```
