# Darwin Capital — CLAUDE.md

> This is NOT a chatbot. This is a financial intelligence system.
> You are building Darwin Capital: an AI-powered prediction market analysis engine
> that finds alpha across Polymarket and Kalshi using competing strategy pods.

## Stack

- **Runtime:** Node.js + TypeScript (strict mode)
- **LLM:** Vercel AI SDK via `src/lib/model.ts` — model-agnostic, provider set by `AI_MODEL` env var
- **Agent loops:** Vercel AI SDK tool-use (`generateText` with tools, max 10 iterations)
- **Storage:** SQLite (via better-sqlite3)
- **Testing:** Vitest
- **API:** Express REST server (consumed by Next.js frontend built by teammates)

## Architecture References

- System diagram, pod types, agent/tool types, strategy math → `docs/ARCHITECTURE.md`
- External API endpoints, auth, rate limits → `docs/API_REFERENCE.md`

---

## Core Concepts

### Generic Agent

The single most important abstraction. Every pod contains an agent — an LLM with a
mandate (system prompt) and a set of tools. The agent factory takes an `AgentConfig`
(name + mandate + tools), builds a system prompt, calls Vercel AI SDK `generateText`
with tool definitions, handles the tool-call loop (max 10 iterations), collects
`TradeProposal`s, and returns an `AgentOutput`.

To create a new pod type: write a mandate + pick tools. That's it.

### Competing Pods

Three pod types run independently on filtered market batches:
- **Event Pod** — detects news-driven mispricings using Valyu research
- **Arbitrage Pod** — finds cross-platform price discrepancies
- **Time-Series Pod** — exploits time-decay anomalies near expiration

Pods propose trades. They do NOT execute. All proposals pass through the risk manager.

### Algorithmic Risk Manager

NOT an LLM. Hardcoded checks: position size, concentration, drawdown, liquidity,
correlation. Returns pass/fail with violation details.

### Virtual Trading Engine

Paper trading only (MVP). Tracks positions, fills, slippage, PnL, mark-to-market.

### Decision Log

Every cycle, every trade proposal, every risk check — logged for observability.
Past decisions are fed back to agents as context (simple RL feedback).

---

## Execution Protocol — MANDATORY

You MUST work in phases. You MUST NOT skip phases. After completing each
phase, you MUST run the gate checks listed. If a gate fails, fix the issues
before proceeding. Do not move to Phase N+1 until Phase N's gate passes.

After every gate:
1. Append to `progress.txt`: what was built, patterns discovered, decisions made
2. Append to `doc_logs.md`: timestamp, files created/modified, exported interfaces and types
3. Commit with message format: `feat: Phase N — <Phase Name>`

---

### PHASE 1 — Foundation

**Goal:** Project skeleton compiles. LLM provider works. All type files exist.

**Tasks:**
1. Initialize `package.json` with dependencies:
   - `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai` (Vercel AI SDK + providers)
   - `better-sqlite3`, `express`, `dotenv`, `zod`, `uuid`
   - Dev: `typescript`, `vitest`, `@types/node`, `@types/express`, `@types/better-sqlite3`, `@types/uuid`, `tsx`
2. Create `tsconfig.json` — strict mode, ES2022 target, NodeNext module resolution
3. Create `vitest.config.ts`
4. Create type files:
   - `src/lib/types.ts` — `Result<T>`, `Market`, `Platform`, `Direction`, `TradeStatus`
   - `src/agent/types.ts` — `AgentConfig`, `AgentContext`, `AgentOutput`, `ToolCallRecord`
   - `src/tools/types.ts` — `ToolDefinition<TInput, TOutput>` interface
   - `src/pods/types.ts` — `PodConfig`, `PodState`, `PodPerformance`
   - `src/risk/types.ts` — `RiskConfig`, `RiskCheckResult`, `RiskViolation`
   - `src/portfolio/types.ts` — `TradeProposal`, `Position`, `PortfolioSnapshot`, `Fill`
   - `src/decisions/types.ts` — `DecisionLogEntry`, `ExpectedOutcome`
5. Create `src/lib/result.ts` — helper functions: `ok(data)`, `err(error)`, `isOk(result)`
6. Create `src/lib/model.ts` — single LLM entry point using Vercel AI SDK `generateText`
7. Create `src/lib/config.ts` — env loading + risk config defaults from env vars
8. Create `src/lib/logger.ts` — structured logging utility
9. Verify `.env.example` has all required vars (including risk + orchestrator config)

#### GATE 1 — Foundation Checkpoint

Run these commands. ALL must pass before Phase 2:

```bash
npx tsc --noEmit
```

Verify manually:
- [ ] `.env.example` exists with all required vars (API keys + risk + orchestrator)
- [ ] `src/lib/model.ts` compiles and exports `callLLM`
- [ ] All type files compile and export their interfaces
- [ ] `src/lib/config.ts` loads risk config from env vars with defaults
- [ ] No `any` types anywhere

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 2 — Data Layer

**Goal:** Every external API has a typed wrapper that can be called standalone.

**Tasks:**
1. `src/data/polymarket.ts` — Polymarket CLOB + Gamma API wrapper
2. `src/data/kalshi.ts` — Kalshi API wrapper
3. `src/data/valyu.ts` — Valyu research API wrapper
4. Each wrapper must:
   - Return `Result<T>` (never throw)
   - Use typed response shapes (define per-API response types)
   - Handle rate limiting with exponential backoff
   - Normalize output to the shared `Market` type where applicable

Consult `docs/API_REFERENCE.md` for endpoints, auth, and rate limits.
Before implementing any wrapper, verify the endpoint with a test fetch.

#### GATE 2 — Data Layer Checkpoint

```bash
npx tsc --noEmit
```

Verify manually:
- [ ] Each wrapper can be imported and called standalone
- [ ] Run each wrapper with a real API call (or mock if no key), log the response shape
- [ ] All wrappers return `Result<T>`, none throw raw exceptions
- [ ] Response types are defined (no `any` in API responses)

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 3 — Tools + Intelligence

**Goal:** Calculation functions tested. All tool definitions compile and are invocable.

**Tasks:**
1. `src/intelligence/calculations.ts` — EV calculation, arbitrage spread, time decay math
2. `src/intelligence/calculations.test.ts` — unit tests for all calculation functions
3. `src/intelligence/market-matcher.ts` — cross-platform market matching (Polymarket ↔ Kalshi)
4. Tool definition files (each tool conforms to `ToolDefinition` with Zod input schemas):
   - `src/tools/shared.ts` — `fetchMarkets`, `getOrderBook`, `calculateEV`, `calculatePositionSize`, `logDecision`
   - `src/tools/event-pod.ts` — `fetchRecentNews`, `estimateEventProbability`, `calculatePriceDivergence`, `assessEventTimeline`
   - `src/tools/arbitrage-pod.ts` — `crossMarketCompare`, `calculateArbitrageSpread`, `calculateSlippage`, `validateMarketMatch`
   - `src/tools/timeseries-pod.ts` — `calculateTimeDecay`, `analyzePriceConvergence`, `detectAnomalousDecay`, `calculateExpiryEV`
5. `src/tools/tools.test.ts` — unit tests for tool execute functions with mock data

Refer to `docs/ARCHITECTURE.md` for EV formulas, arbitrage conditions, and time decay math.

#### GATE 3 — Tools + Intelligence Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] All calculation tests pass
- [ ] Each tool definition has a Zod schema for input
- [ ] Each tool can be invoked standalone with mock data and returns `Result<T>`
- [ ] Market matcher can identify related markets from sample data

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 4 — Agent Engine + Risk Manager

**Goal:** Agent factory produces runnable agents. Risk manager rejects bad proposals.

**Tasks:**
1. `src/agent/create-agent.ts` — factory: takes `AgentConfig` → returns a callable agent function
2. `src/agent/execute.ts` — tool-use loop via Vercel AI SDK:
   - Build system prompt from mandate + tool descriptions
   - Call `generateText` with tools
   - Handle up to 10 tool-call iterations
   - Collect `TradeProposal`s from tool results
   - Return `AgentOutput` (proposals + reasoning + tool call records)
3. `src/agent/agent.test.ts` — unit tests with mocked LLM responses
4. `src/risk/manager.ts` — `checkProposal()` runs all risk checks, returns `RiskCheckResult`
5. Individual risk checks:
   - `src/risk/checks/position-size.ts` — max position size as % of portfolio
   - `src/risk/checks/concentration.ts` — max pods per instrument / category
   - `src/risk/checks/drawdown.ts` — max drawdown limit
   - `src/risk/checks/liquidity.ts` — minimum liquidity requirement
   - `src/risk/checks/correlation.ts` — category-based concentration check
6. `src/risk/manager.test.ts` — unit tests: verify rejection of over-sized positions, passing valid ones

#### GATE 4 — Agent Engine + Risk Manager Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] Agent factory creates a callable agent from config
- [ ] Agent execute loop handles tool calls and returns `AgentOutput`
- [ ] Risk manager rejects over-sized positions
- [ ] Risk manager passes valid proposals
- [ ] All risk checks return `RiskCheckResult` with violation details

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 5 — Pods + Portfolio + Database

**Goal:** Pods produce proposals from markets. Virtual engine tracks PnL. SQLite stores everything.

**Tasks:**
1. `src/pods/pod-configs.ts` — predefined configs for event, arbitrage, time-series pods:
   - Each config: name, mandate (system prompt), tool set
2. `src/pods/create-pod.ts` — factory: `PodConfig` → `Pod` (wraps agent creation + execution)
3. `src/pods/pod.test.ts` — unit tests: pod creates proposals from mock market data
4. `src/portfolio/engine.ts` — virtual trading engine:
   - Submit orders (apply slippage, record fills)
   - Open/close positions
   - Mark-to-market with current prices
   - Calculate PnL (realized + unrealized)
5. `src/portfolio/slippage.ts` — slippage estimation from order book depth
6. `src/portfolio/engine.test.ts` — unit tests for position lifecycle
7. `src/decisions/logger.ts` — `logDecision()`, `getTradeLifecycle()`
8. `src/decisions/feedback.ts` — build context from past decisions for agent prompts
9. `src/db/sqlite.ts` — SQLite schema: pods, positions, trade_proposals, decisions, fills
10. `src/db/queries.ts` — typed insert/select functions for all tables

#### GATE 5 — Pods + Portfolio + Database Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] Pod creates proposals from mock market data
- [ ] Virtual trading engine opens/closes positions, tracks PnL
- [ ] SQLite tables created with correct schema
- [ ] Typed queries insert and retrieve data correctly
- [ ] Decision logger records entries and retrieves lifecycle

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 6 — Orchestrator + Integration

**Goal:** Full cycle runs end-to-end. REST API serves data. Entry point starts everything.

**Tasks:**
1. `src/orchestrator/market-filter.ts` — batch filtering:
   - 90% ending-soon markets, 10% trending
   - Filter by politics category
   - Minimum liquidity threshold
   - Batch size from `MARKET_BATCH_SIZE` env var (default 100)
2. `src/orchestrator/runner.ts` — full cycle:
   - Fetch markets from all data wrappers
   - Filter and batch markets
   - Run all pods sequentially on filtered markets
   - Collect trade proposals
   - Run each proposal through risk manager
   - Execute approved proposals in virtual trading engine
   - Log all decisions
   - Feed back results for next cycle
3. `src/orchestrator/runner.test.ts` — integration test with mocked data
4. API routes:
   - `src/api/routes/pods.ts` — `GET /api/pods`, `GET /api/pods/:id/performance`
   - `src/api/routes/portfolio.ts` — `GET /api/portfolio`, `GET /api/portfolio/pnl`
   - `src/api/routes/decisions.ts` — `GET /api/decisions`, `GET /api/decisions/:tradeId`
   - `src/api/routes/trades.ts` — `GET /api/trades`
   - `src/api/routes/health.ts` — `GET /api/health`
5. `src/api/server.ts` — Express app, wire all routes
6. `src/index.ts` — entry point: initialize DB, start server, start orchestrator cycle on interval
7. Final `doc_logs.md` update with all endpoints and types for frontend team

#### GATE 6 — Orchestrator + Integration Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] Full cycle runs end-to-end (with mocked data if no API keys)
- [ ] API server starts and responds to `GET /api/health`
- [ ] `GET /api/pods` returns pod status
- [ ] `GET /api/portfolio/pnl` returns PnL data
- [ ] `GET /api/decisions` returns decision log entries
- [ ] `doc_logs.md` has complete endpoint list for frontend team

After gate passes → update `progress.txt`, `doc_logs.md`, commit: `feat: Phase 6 — Integration`

---

## Coding Standards

### Error Handling — Single Pattern

Every function that can fail returns `Result<T>`:
```typescript
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
```
Never throw. Never use try/catch at the call site. Wrap external calls in try/catch
inside the wrapper function and return `err(message)`.

### LLM Calls — Single Entry Point

ALL LLM calls go through `src/lib/model.ts`. No direct Anthropic/OpenAI SDK imports
anywhere else. The model is determined by `AI_MODEL` env var. Teammates swap providers
by changing one env var — zero code changes.

### Agent Tool-Use Loop

Agents use Vercel AI SDK `generateText` with tool definitions. The loop:
1. Build system prompt from agent mandate + tool descriptions
2. Call `generateText` with tools array
3. If LLM returns tool calls → execute them, feed results back
4. Repeat until LLM stops calling tools or max iterations (10) reached
5. Collect `TradeProposal`s from tool outputs
6. Return `AgentOutput`

No LangGraph. No external orchestration library. Just Vercel AI SDK tool-use.

### Pod Plugins

To add a new pod type:
1. Create a `PodConfig` in `src/pods/pod-configs.ts` with name, mandate, and tool set
2. The orchestrator picks it up automatically from the configs array

### TypeScript Rules

- `strict: true` in tsconfig — no exceptions
- No `any` types — use `unknown` + type guards if needed
- No classes for data/tools — use functions + interfaces
- No hardcoded API keys — always from `process.env` via `src/lib/config.ts`
- Imports: use named exports, no default exports

---

## Environment Variables

See `.env.example` for the complete list:

| Variable | Purpose | Default |
|----------|---------|---------|
| `AI_MODEL` | Vercel AI SDK model string | `anthropic/claude-opus-4-6` |
| `ANTHROPIC_API_KEY` | Anthropic API access | — |
| `VALYU_API_KEY` | Valyu research API | — |
| `KALSHI_API_KEY` | Kalshi market data | — |
| `RISK_MAX_POSITION_SIZE_PCT` | Max single position as % of portfolio | `0.10` |
| `RISK_MAX_PODS_PER_INSTRUMENT` | Max pods trading same instrument | `2` |
| `RISK_MAX_DRAWDOWN_PCT` | Max portfolio drawdown before halt | `0.10` |
| `RISK_MIN_LIQUIDITY` | Min market liquidity in USD | `10000` |
| `RISK_MAX_OPEN_POSITIONS` | Max concurrent open positions | `10` |
| `CYCLE_INTERVAL_MS` | Orchestrator cycle interval | `300000` |
| `MARKET_BATCH_SIZE` | Markets per batch to pods | `100` |

---

## MVP Simplifications

| Decision | Rationale |
|----------|-----------|
| 1 agent per pod | Split into PM/analyst/trader later if needed |
| Sequential pod execution | Avoids shared-state complexity + rate limit coordination |
| Category-based correlation check | Not statistical correlation — just "too many positions in politics?" |
| No historical price storage | Price convergence uses current snapshot only |
| Static pod configs in code | No API-driven pod management for MVP |
| No agent self-tool-creation | Fixed tool sets. "Primitives" are v2 |
| No real execution | Virtual trading engine only |
| Simple RL feedback | Agent gets last N decisions as context, no gradient optimization |

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
│   │   ├── types.ts            # AgentConfig, AgentContext, ToolDefinition, AgentOutput
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
