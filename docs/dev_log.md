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
