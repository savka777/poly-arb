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
