# Darwin Capital — Dev Log

> **Instructions:** After every meaningful push, add an entry below. Claude agents MUST append entries here.
> Read the latest entries before starting any work — this is how session N+1 knows what session N did.
> Newest entries first.

---

## Entry Template

```
## [YYYY-MM-DD HH:MM] <Dev Name / Agent ID>

### What Changed
- files created / modified / deleted

### Decisions Made
- architectural or scope decisions and why

### Now Unblocked
- what can be worked on next

### Known Issues
- bugs, gaps, or risks

### Next Up
- immediate next tasks
```

---

## [2026-02-21 19:00] Agent Pipeline Verified — LLM Brain Working

### What Changed
- **Modified:** `src/lib/model.ts` — fixed Vertex AI provider import
  - `createVertex` → `createVertexAnthropic` from `@ai-sdk/google-vertex/anthropic` (the main module is for Gemini, `/anthropic` sub-module is for Claude)
  - `location` param (not `region`) per SDK types
  - Model ID: `claude-opus-4-5@20251101` (confirmed working on project `gen-lang-client-0494134627` in `us-east5`)
  - Other model IDs tested and NOT available: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-sonnet-4@20250514`, `claude-3-5-sonnet-v2@20241022`, `claude-3-7-sonnet@20250219`
- **Updated:** `@ai-sdk/google-vertex` 0.0.43 → 4.0.61, `ai` to 6.0.97 — old version lacked `/anthropic` sub-module
- **Created:** `scripts/test-agent.ts` — standalone test script that runs LangGraph pipeline on mock data with real LLM calls
- **Updated:** `.env` and `.env.example` — `VERTEX_REGION` default changed from `global` to `us-east5`

### Decisions Made
- **`@ai-sdk/google-vertex/anthropic` is required for Claude on Vertex** — the main `@ai-sdk/google-vertex` module routes to Gemini. This was the root cause of `<!DOCTYPE` HTML errors and `Not Found` 404s.
- **Model: `claude-opus-4-5@20251101`** — only model confirmed available on this GCP project in us-east5. Sonnet 4 and newer Opus 4.6 returned 404.
- **EV threshold at 0.05 works well** — in testing, the Fed rate cut market produced EV=+0.16 (high confidence signal), while the recession market produced EV=+0.04 (correctly filtered out as below threshold).

### Now Unblocked
- Full agent pipeline is end-to-end verified: mock news → real LLM probability estimate → EV calculation → signal generation → SQLite persistence
- Can test via `scripts/test-agent.ts` or via the API (`POST /api/analyze`)
- Frontend partner can integrate knowing the API responses are correct

### Known Issues
- `npx tsx` doesn't auto-load `.env` files — must pass env vars inline or add dotenv. Next.js (`npm run dev`) loads `.env` automatically.
- Only `claude-opus-4-5@20251101` available on this GCP project — other Claude models return 404

### Next Up
- Test via `npm run dev` and the UI (Next.js loads .env automatically)
- Test with real Polymarket + Valyu APIs (set `USE_MOCK_DATA=false`, provide `VALYU_API_KEY`)
- Background scanner implementation

---

## [2026-02-21 19:00] Live API Sampling + Docs Correction (vlad)

### What Changed
- **Created:** `docs/api_response_samples.json` — full raw responses from all 3 APIs (live-captured 2026-02-21)
- **Rewritten:** `docs/apis.md` — corrected 6 inaccuracies found by comparing docs against live responses

### Decisions Made
- **`docs/api_response_samples.json`** is the source of truth for API shapes going forward.

### Corrections Made to `docs/apis.md`

| Field | Was (documented) | Is (live-verified) |
|-------|------------------|--------------------|
| Gamma `liquidity` / `volume` type | `number` | `string` — must `parseFloat()` |
| Gamma `outcomePrices` values | `"[0.65, 0.35]"` (numbers) | `"[\"0.0295\", \"0.9705\"]"` (string numbers) |
| Gamma response wrapper | unspecified | Plain array — NO `{ data: [] }` wrapper |
| CLOB `/price` endpoint | `/prices` (plural, undocumented) | `/price?token_id=...&side=BUY` |
| CLOB price value type | `number` | `string` — `{ price: "0.015" }` |
| Valyu endpoint | `/v1/search` | `/v1/deepsearch` |

---

## [2026-02-21 18:00] Full API Smoke Test — All Green (vlad)

### What Changed
- **Rotated:** Valyu API key — new key in `.env` (`val_3495...`)
- **Verified:** all three external APIs pass smoke test (`scripts/test-apis.ts`)

---

## [2026-02-21 17:00] Git History Rewrite + Branch Push (vlad)

### What Changed
- **Amended:** commit to remove `.env` (with live Valyu key) from tree
- **Created:** `.gitignore`
- **Force-pushed:** `origin/vlad` — rewrote remote history to remove sensitive key

---

## [2026-02-21 16:00] Full Rebuild — src/ Reconstructed + API Implementation

### What Changed
- **Created (35 files):** Entire `src/` directory rebuilt from scratch
  - `src/lib/` — types.ts, result.ts, model.ts (lazy Vertex AI init via proxy), config.ts
  - `src/db/` — schema.ts (Drizzle), index.ts (lazy SQLite init via proxy), seed.ts (4 demo signals)
  - `src/store/signals.ts` — full CRUD: saveSignal, getSignals, getSignalsByMarket, getRecentSignals, getSignalCount, getLatestSignalTimestamp
  - `src/intelligence/calculations.ts` — calculateEV, evToConfidence
  - `src/data/` — polymarket.ts (Gamma + CLOB), valyu.ts (news search), mock.ts (5 markets, topic-aware news)
  - `src/agent/` — state.ts (LangGraph Annotation), nodes.ts (4 nodes), graph.ts (StateGraph with conditional edges), tools.ts (re-exports)
  - `src/app/api/` — health, markets, markets/[id], signals, analyze (all force-dynamic)
  - `src/app/` — layout.tsx (Inter + JetBrains Mono, dark theme, QueryProvider), page.tsx (market grid), markets/[id]/page.tsx (detail view)
  - `src/components/` — market-card, alpha-bar, signal-badge, analysis-feed, query-interface, query-provider
  - `src/hooks/` — use-markets, use-signals, use-analysis
  - `src/test/validate.ts` — 11-check validation script
- **Created:** scripts/validate.sh, drizzle.config.ts, postcss.config.js, .gitignore, globals.css
- **Modified:** CLAUDE.md — updated stack (LangGraph, SQLite, Vertex AI), file structure, env vars
- **Modified:** docs/ARCHITECTURE.md — replaced in-memory store with SQLite, updated agent diagram to LangGraph, removed "no persistent storage" from excluded scope
- **Modified:** .env.example — replaced AI_MODEL/ANTHROPIC_API_KEY with GOOGLE_CLOUD_PROJECT/VERTEX_REGION, added USE_MOCK_DATA
- **Modified:** package.json — all dependencies (next, ai, @ai-sdk/google-vertex, @langchain/langgraph, drizzle-orm, better-sqlite3, react-query, zod, nanoid)
- **Created:** darwin.db — SQLite database with 4 seeded demo signals

### Decisions Made
- **LangGraph replaces generateText loop** — structured StateGraph with 4 nodes and conditional edges gives more control over the agent pipeline than a generic tool-use loop. Conditional edges skip to END on no-news or sub-threshold divergence.
- **SQLite + Drizzle replaces Map<string, Signal>** — signals now persist across restarts. Critical for demo: "Darwin found an edge 2 hours ago" works even after server restart. Lazy initialization via Proxy avoids build-time crashes.
- **Vertex AI via @ai-sdk/google-vertex** — replaces generic AI_MODEL env var. Model initialized lazily to avoid build-time errors when env vars aren't set.
- **Mock data layer** — USE_MOCK_DATA env var toggles between real APIs and mock data. Mock data is topic-aware (returns relevant news based on query keywords). Enables full pipeline testing without API keys.
- **All API routes force-dynamic** — prevents Next.js from trying to statically generate routes that access SQLite or Vertex AI at build time.
- **next.config.js uses `experimental.serverComponentsExternalPackages`** — Next.js 14 doesn't support top-level `serverExternalPackages`.

### Now Unblocked
- Demo flow: `npm run dev` → grid with seeded signals → click market → analysis feed → trigger on-demand analysis
- Background scanner implementation
- Polish: loading states, animations, hover tooltips
- Real API testing with VALYU_API_KEY and Vertex AI credentials

### Known Issues
- Background scanner (periodic batch analysis) not yet implemented — markets must be analyzed on-demand via POST /api/analyze or pre-seeded
- Alpha bar tooltip on hover not implemented (P1 polish)
- No error boundary components (P2)

### Next Up
- Background scanner: run LangGraph agent on market batches at CYCLE_INTERVAL_MS interval
- Polish: alpha bar hover tooltip, card hover elevation
- Test with real Polymarket + Valyu APIs (requires VALYU_API_KEY)
- Test full LLM pipeline with Vertex AI credentials
=======
## [2026-02-21 19:00] Live API Sampling + Docs Correction

### What Changed
- **Created:** `docs/api_response_samples.json` — full raw responses from all 3 APIs (live-captured 2026-02-21)
- **Rewritten:** `docs/apis.md` — corrected 6 inaccuracies found by comparing docs against live responses

### Decisions Made
- **`docs/api_response_samples.json`** is the source of truth for API shapes going forward. If a type question arises, check this file first before making assumptions.

### Corrections Made to `docs/apis.md`

| Field | Was (documented) | Is (live-verified) |
|-------|------------------|--------------------|
| Gamma `liquidity` / `volume` type | `number` | `string` — must `parseFloat()` |
| Gamma `outcomePrices` values | `"[0.65, 0.35]"` (numbers) | `"[\"0.0295\", \"0.9705\"]"` (string numbers) |
| Gamma response wrapper | unspecified | Plain array — NO `{ data: [] }` wrapper |
| CLOB `/price` endpoint | `/prices` (plural, undocumented) | `/price?token_id=...&side=BUY` |
| CLOB price value type | `number` | `string` — `{ price: "0.015" }` |
| Valyu endpoint | `/v1/search` | `/v1/deepsearch` |
| Valyu response shape | `{ results, total_results, credits_used }` | `{ success, error, tx_id, query, results, total_deduction_dollars, total_characters }` |
| Normalization fn | Used `prices[0]` as `number` directly | Must `parseFloat(prices[0])` after JSON.parse |

### Now Unblocked
- Agent layer can be built with 100% accurate type expectations
- No guessing about API shapes — `api_response_samples.json` has live examples

### Known Issues
- None

### Next Up
- Initialize Next.js project (`package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`)
- `src/lib/model.ts` — Vercel AI SDK `callLLM` wrapper
- `src/agent/` + `src/tools/` + `src/store/memory.ts`

---

## [2026-02-21 18:00] Full API Smoke Test — All Green

### What Changed
- **Rotated:** Valyu API key — new key in `.env` (`val_3495...`)
- **Verified:** all three external APIs pass smoke test (`scripts/test-apis.ts`)

### Test Output
```
── Gamma API ─────────────────────────────────
  ✓ fetchMarkets: 5 markets returned
     First market: "Will Trump deport 250,000-500,000 people?"
     probability=0.9390  liquidity=$7290  volume=$7,509,996
     conditionId=0x49686d26fb712515cd5e12c23f0a1c7e10214c7faa3cb0a730aabe0c33694082
  ✓ fetchMarketById(517311): confirmed

── CLOB API ──────────────────────────────────
  ✓ fetchTokenPrice YES: price=0.9270
  ✓ fetchOrderBook YES: 43 bids, 16 asks

── Valyu API ─────────────────────────────────
  query: "Trump deport 250,000-500,000 people"
  ✓ searchNews: 3 results
     • "Trump Administration Moves to Deport More Than 500,000..."
     • "Thanks to President Trump and Secretary Noem, More than 2.5M..."
```

### Decisions Made
- Run test with: `set -a && source .env && set +a && npx tsx scripts/test-apis.ts`
- Valyu new key format: `val_<hex>` (longer format than old key)

### Now Unblocked
- Sprint 1 agent layer: `src/lib/model.ts`, `src/agent/`, `src/tools/`, `src/store/memory.ts`
- All data inputs confirmed working — agent can be built against real live data

### Known Issues
- None — all three APIs operational

### Next Up
- Initialize Next.js project (`package.json`, `tsconfig.json`, `next.config.js`, `tailwind.config.js`)
- `src/lib/model.ts` — Vercel AI SDK `callLLM` wrapper (Anthropic key now in `.env`)
- `src/agent/types.ts` + `src/agent/create-agent.ts` + `src/agent/execute.ts`
- `src/tools/shared.ts` + `src/tools/event-pod.ts`
- `src/store/memory.ts`

---

## [2026-02-21 17:00] Git History Rewrite + Branch Push

### What Changed
- **Amended:** commit `f8cd48c` → `31ce8a5` — removed `.env` (with live Valyu key) from tree
- **Untracked:** `.DS_Store`, `.vscode/settings.json`, `__pycache__/` — removed from index
- **Created:** `.gitignore` — covers `.env`, `.env.local`, `node_modules/`, `.next/`, `__pycache__/`, `.DS_Store`
- **Committed:** `89ce4bb` — Sprint 1 data layer (all `src/`, `scripts/`, `.gitignore`, deletions of Python prototypes)
- **Force-pushed:** `origin/vlad` — rewrote remote history to remove sensitive key

### Decisions Made
- **Force push required** — history rewrite (amend) always requires `--force` on the remote
- **`.env` never re-enters index** — `.gitignore` now prevents future accidental commits of secrets
- **Valyu key should be rotated** — key `asGhqGwape5JafAyk3qDAVSQAHtso312DescfFUa` was on remote before rewrite; treat as compromised

### Now Unblocked
- All Sprint 1 data work is on `origin/vlad` and visible to teammates
- Remaining Sprint 1: Next.js init → `src/lib/model.ts` → agent + tools + store

### Known Issues
- **Valyu key needs rotation** — was publicly exposed in git history before rewrite
- **No `package.json`** — Next.js project not yet initialized; `npx tsx` works for scripts but `tsc --noEmit` cannot run

### Next Up
- `npm create next-app` / initialize `package.json` with correct deps
- `src/lib/model.ts` — Vercel AI SDK entry point
- Sprint 1 agent work: `src/agent/`, `src/tools/`, `src/store/memory.ts`

---

## [2026-02-21 16:00] API Implementation — Sprint 1 (Data Wrappers)

### What Changed
- **Created:** `src/lib/result.ts` — `ok()`, `err()`, `isOk()` with full `Result<T>` type
- **Created:** `src/lib/types.ts` — all domain types: `Market`, `Signal`, `TradeProposal`, `Direction`, `GammaMarket`, `ClobMarket`, `ClobOrderBook`, `ToolCallRecord` + API response shapes
- **Created:** `src/lib/config.ts` — env loading with typed defaults, `requireEnv` guard on `VALYU_API_KEY`
- **Created:** `src/data/polymarket.ts` — Gamma + CLOB wrappers: `fetchMarkets`, `fetchMarketById`, `fetchClobMarket`, `fetchTokenPrice`, `fetchOrderBook`, `fetchClobMarkets`, `gammaToMarket` normalizer
- **Created:** `src/data/valyu.ts` — Valyu wrapper: `searchNews`, `searchWebNews`, `buildNewsQuery`
- **Created:** `scripts/test-apis.ts` — smoke test (Gamma ✓, CLOB ✓, Valyu key exhausted)

### Decisions Made
- **`market.id` = Gamma numeric ID** (`"517310"`). `conditionId` (0x hex) stored separately for CLOB calls.
- **`tokenIds: [string, string]`** added to Market type — needed for CLOB price/book queries. Not in original spec but required.
- **Gamma returns plain array** (no `{ data: [] }` wrapper). CLOB returns `{ data: [], next_cursor }`. Handled differently.
- **`outcomePrices` is JSON string of string numbers** e.g. `"[\"0.022\", \"0.978\"]"` — must `parseFloat` after `JSON.parse`.
- **Valyu endpoint confirmed as `/v1/deepsearch`** (not `/v1/search` as documented). Verified working before key exhaustion.
- **Backoff: 4 attempts at 0/1/2/4s** on 429 or 5xx. Non-429 4xx → return error immediately.

### Now Unblocked
- Next.js project init (`package.json`, `tsconfig.json`, `next.config.js`)
- `src/lib/model.ts` — Vercel AI SDK `callLLM` entry point
- `src/agent/` — factory + tool-use loop
- `src/tools/shared.ts` + `src/tools/event-pod.ts`
- `src/store/memory.ts`

### Known Issues
- **Valyu key exhausted** — key `asGhqGwape5JafAyk3qDAVSQAHtso312DescfFUa` returns 403 after testing. Need fresh key before agent runs.
- **No `package.json`** — `npx tsx` works ad-hoc but type checking requires Next.js init.

### Next Up
- Initialize Next.js 14 app
- `src/lib/model.ts` + `src/agent/` + `src/tools/` + `src/store/memory.ts`
- Sprint 1 gate: agent produces valid `Signal` from a real market
>>>>>>> origin/main

---

## [2026-02-21 00:00] Documentation Rewrite

### What Changed
- **Deleted:** `docs/API_REFERENCE.md`, `doc_logs.md`, `progress.txt`
- **Created:** `docs/dev_log.md` (this file), `docs/ARCHITECTURE.md`, `docs/agents.md`, `docs/apis.md`, `docs/backlog.md`, `docs/uiux.md`
- **Rewritten:** `CLAUDE.md` — full hackathon pivot
- **Updated:** `.env.example` — removed Kalshi/risk vars, added `NEXT_PUBLIC_POLL_INTERVAL_MS`, `EV_THRESHOLD`

### Decisions Made
- **Polymarket only** — dropped Kalshi to reduce surface area. One platform, one data wrapper.
- **Unified Next.js** — no separate Express backend. App Router API routes serve everything.
- **Single strategy (Event Pod)** — news-to-price lag detection only. Arb and time-series pods are post-hackathon.
- **In-memory store** — no SQLite for MVP. `Map<string, Signal>` is enough for a demo.
- **No risk manager** — no position sizing, drawdown, or concentration checks for MVP.
- **No virtual trading engine** — signals only, no paper trading.
- **3 sprints replace 6 phases** — hackathon-appropriate cadence.

### Now Unblocked
- Sprint 1: Foundation + Data + Agent (all P0 items through "agent produces valid Signal")

### Known Issues
- None yet — fresh start

### Next Up
- Initialize Next.js project
- Core types (`Result<T>`, `Market`, `Signal`)
- Polymarket data wrapper
- Valyu data wrapper
- Agent factory + event pod tools
