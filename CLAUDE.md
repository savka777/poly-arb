# Darwin Capital — CLAUDE.md

> This is NOT a chatbot. This is a financial intelligence system.
> You are building Darwin Capital: an AI-powered prediction market analysis engine
> that finds alpha across Polymarket, Kalshi, and Metaculus.

## Stack

- **Runtime:** Node.js + TypeScript (strict mode)
- **LLM:** Vercel AI SDK via `src/lib/model.ts` — model-agnostic, provider set by `AI_MODEL` env var
- **Orchestration:** LangGraph (TypeScript)
- **Storage:** SQLite (via better-sqlite3)
- **Testing:** Vitest
- **API:** Express REST server (consumed by Next.js frontend built by teammates)

## Architecture References

- System diagram, LangGraph nodes, strategy math → `docs/ARCHITECTURE.md`
- External API endpoints, auth, rate limits → `docs/API_REFERENCE.md`

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

**Goal:** Project skeleton compiles. LLM provider works. Core types exist.

**Tasks:**
1. Initialize `package.json` with dependencies:
   - `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai` (Vercel AI SDK + providers)
   - `@langchain/langgraph`, `better-sqlite3`, `express`, `dotenv`, `zod`
   - Dev: `typescript`, `vitest`, `@types/node`, `@types/express`, `@types/better-sqlite3`, `tsx`
2. Create `tsconfig.json` — strict mode, ES2022 target, NodeNext module resolution
3. Create `src/lib/types.ts` — `Result<T>` type, `Market`, `Signal`, `Trade`, `DarwinState`
4. Create `src/lib/model.ts` — single LLM entry point using Vercel AI SDK `generateText`
5. Create `src/lib/result.ts` — helper functions: `ok(data)`, `err(error)`, `isOk(result)`
6. Create `.env.example` (already provided in repo root)
7. Load `.env` in a shared config module `src/lib/config.ts`

#### GATE 1 — Foundation Checkpoint

Run these commands. ALL must pass before Phase 2:

```bash
npx tsc --noEmit
```

Verify manually:
- [ ] `.env.example` exists with all required vars
- [ ] `src/lib/model.ts` compiles and exports `callLLM`
- [ ] `src/lib/types.ts` exports `Result`, `Market`, `Signal`, `Trade`, `DarwinState`
- [ ] No `any` types anywhere

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 2 — Data Layer

**Goal:** Every external API has a typed wrapper that can be called standalone.

**Tasks:**
1. `src/data/polymarket.ts` — Polymarket CLOB + Gamma API wrapper
2. `src/data/kalshi.ts` — Kalshi API wrapper
3. `src/data/metaculus.ts` — Metaculus API wrapper
4. `src/data/valyu.ts` — Valyu research API wrapper
5. Each wrapper must:
   - Return `Result<T>` (never throw)
   - Use typed response shapes (define per-API response types)
   - Handle rate limiting with backoff
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

### PHASE 3 — Intelligence

**Goal:** Calculation functions tested. LLM probability estimation works.

**Tasks:**
1. `src/intelligence/calculations.ts` — EV calculation, arbitrage detection, time decay math
2. `src/intelligence/calculations.test.ts` — unit tests for all calculation functions
3. `src/intelligence/llm-estimator.ts` — LLM-based probability estimation via `callLLM`
   - Structured prompt → JSON response with probability + reasoning
   - Parse and validate with Zod
4. `src/intelligence/market-matcher.ts` — match related markets across platforms

Refer to `docs/ARCHITECTURE.md` for EV formulas, arbitrage conditions, and time decay math.

#### GATE 3 — Intelligence Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] All calculation tests pass
- [ ] LLM estimator returns valid JSON with probability field
- [ ] Market matcher can identify related markets from sample data

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 4 — Strategies

**Goal:** Strategy plugin system works. Three strategies scan markets and return signals.

**Tasks:**
1. `src/strategies/types.ts` — `Strategy` interface, `StrategyContext` type
2. `src/strategies/registry.ts` — strategy registry array (add new strategies here)
3. `src/strategies/news-lag.ts` — News-lag strategy: detects slow-to-update markets
4. `src/strategies/arbitrage.ts` — Cross-platform arbitrage detection
5. `src/strategies/time-decay.ts` — Time decay / expiration approaching opportunities
6. Each strategy implements the `Strategy` interface:
   ```typescript
   interface Strategy {
     name: string
     description: string
     scan(markets: Market[], ctx: StrategyContext): Promise<Signal[]>
   }
   ```

#### GATE 4 — Strategies Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] Each strategy can `scan()` a mock `Market[]` and return `Signal[]`
- [ ] Registry exports all three strategies
- [ ] Adding a new strategy requires only: implement interface + add to registry array

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 5 — Orchestration

**Goal:** LangGraph state machine runs end-to-end. Signals stored in SQLite.

**Tasks:**
1. `src/graph/state.ts` — `DarwinState` definition for LangGraph
2. `src/graph/nodes/` — individual graph nodes:
   - `fetch-markets.ts` — pull from all data wrappers
   - `analyze.ts` — run strategies on fetched markets
   - `estimate.ts` — LLM probability estimation on signals
   - `risk.ts` — risk assessment and position sizing
   - `execute.ts` — paper trade execution
3. `src/graph/graph.ts` — wire nodes into LangGraph StateGraph
4. `src/db/sqlite.ts` — SQLite setup, tables for signals, trades, errors
5. `src/db/queries.ts` — typed insert/select functions

#### GATE 5 — Orchestration Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] Full graph runs end-to-end with live data (or mocked data if no API keys)
- [ ] Signals appear in SQLite after a graph run
- [ ] Trades table records paper executions
- [ ] Errors are captured, not swallowed

After gate passes → update `progress.txt`, `doc_logs.md`, commit.

---

### PHASE 6 — Integration

**Goal:** REST API serves data to frontend. Scheduler runs cycles.

**Tasks:**
1. `src/api/server.ts` — Express REST server with endpoints:
   - `GET /api/signals` — latest signals from all strategies
   - `GET /api/trades` — executed paper trades
   - `GET /api/errors` — recent errors
   - `GET /api/strategies` — registered strategy names + status
   - `GET /api/health` — system status
2. `src/scheduler.ts` — run the graph on an interval (configurable)
3. `src/index.ts` — entry point: start server + scheduler
4. Final `doc_logs.md` update with all endpoints and types for frontend team

#### GATE 6 — Integration Checkpoint

```bash
npx tsc --noEmit
npx vitest run
```

Verify manually:
- [ ] API server starts and responds to `GET /api/health`
- [ ] `GET /api/signals` returns JSON array
- [ ] Scheduler runs one full cycle without errors
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

### Strategy Plugins

To add a new strategy:
1. Create `src/strategies/my-strategy.ts` implementing `Strategy` interface
2. Add to the array in `src/strategies/registry.ts`
3. The orchestrator picks it up automatically

### TypeScript Rules

- `strict: true` in tsconfig — no exceptions
- No `any` types — use `unknown` + type guards if needed
- No classes for data/tools — use functions + interfaces
- No hardcoded API keys — always from `process.env` via `src/lib/config.ts`
- Imports: use named exports, no default exports

---

## Environment Variables

See `.env.example` for the complete list. Required:

| Variable | Purpose | Default |
|----------|---------|---------|
| `AI_MODEL` | Vercel AI SDK model string | `anthropic/claude-opus-4-6` |
| `ANTHROPIC_API_KEY` | Anthropic API access | — |
| `VALYU_API_KEY` | Valyu research API | — |
| `KALSHI_API_KEY` | Kalshi market data | — |

---

## Agent Invocation

- **typescript-pro**: invoke for all implementation code (phases 1-6)
- **code-reviewer**: invoke after each phase gate, before proceeding to the next phase
