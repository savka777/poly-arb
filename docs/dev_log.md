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

## [2026-02-21 16:00] Full Rebuild — src/ Reconstructed

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
