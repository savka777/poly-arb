# Darwin Capital — Backlog

> Prioritized implementation checklist for HackEurope 2026.
> P0 = must ship (no demo without it). P1 = should ship (compelling demo). P2 = nice to have.

---

## P0 — Must Ship

### Foundation (Sprint 1)

- [x] Initialize Next.js 14+ project with App Router
- [x] Core type files: `src/lib/types.ts` (`Result<T>`, `Market`, `Signal`, `Direction`, `TradeProposal`, raw API shapes)
- [x] `src/lib/result.ts` — `ok()`, `err()`, `isOk()` helpers
- [x] `src/lib/model.ts` — Vercel AI SDK + Vertex AI Anthropic provider (lazy init)
- [x] `src/lib/config.ts` — env loading with defaults
- [x] `.env.example` with all required vars
- [x] `tsconfig.json` — strict mode
- [x] **Gate:** `npx tsc --noEmit` passes

### Database (Sprint 1)

- [x] `src/db/schema.ts` — Drizzle schema (signals, markets tables)
- [x] `src/db/index.ts` — Drizzle client with better-sqlite3 (lazy init)
- [x] `src/store/signals.ts` — Signal CRUD (saveSignal, getSignals, getSignalsByMarket, getRecentSignals)
- [x] `src/db/seed.ts` — Demo seed data (4 signals with realistic timestamps)
- [x] **Gate:** signals persist to SQLite and survive restart

### Data Wrappers (Sprint 1)

- [x] `src/data/polymarket.ts` — Gamma API wrapper (market discovery + metadata)
- [x] `src/data/polymarket.ts` — CLOB API wrapper (real-time prices + order book)
- [x] `src/data/valyu.ts` — Valyu search API wrapper (`/v1/deepsearch`)
- [x] `src/data/mock.ts` — Mock data providers (5 markets, topic-aware news)
- [x] All wrappers return `Result<T>`, never throw
- [x] Normalization: `GammaMarket` -> `Market` mapping (`gammaToMarket`)
- [x] Exponential backoff on rate limits (4 attempts: 0/1/2/4s)
- [x] `USE_MOCK_DATA` toggle for testing without API keys
- [x] **Gate:** real data fetches return valid typed responses _(Gamma ✓ CLOB ✓ Valyu ✓ all live-verified 2026-02-21)_

### Agent (Sprint 1)

- [x] `src/agent/state.ts` — LangGraph state definition (Annotation.Root)
- [x] `src/agent/nodes.ts` — 4 node functions (fetchNews, estimateProbability, calculateDivergence, generateSignal)
- [x] `src/agent/graph.ts` — LangGraph StateGraph with conditional edges
- [x] `src/agent/tools.ts` — calculateEV, evToConfidence re-exports
- [x] `src/intelligence/calculations.ts` — EV calculation + confidence mapping
- [x] Event Pod mandate embedded in estimateProbabilityNode prompt
- [x] **Gate:** LangGraph graph compiles, mock pipeline produces valid Signal

### API Routes (Sprint 2)

- [x] `src/app/api/health/route.ts` — `GET /api/health`
- [x] `src/app/api/markets/route.ts` — `GET /api/markets`
- [x] `src/app/api/markets/[id]/route.ts` — `GET /api/markets/[id]`
- [x] `src/app/api/signals/route.ts` — `GET /api/signals`
- [x] `src/app/api/analyze/route.ts` — `POST /api/analyze`
- [x] All routes force-dynamic (no static generation issues)

### UI — Market Grid (Sprint 2)

- [x] `src/app/layout.tsx` — dark theme, Inter + JetBrains Mono fonts, QueryProvider
- [x] `src/app/page.tsx` — market grid page with stats bar
- [x] `src/components/market-card.tsx` — card with question, price, EV, alpha bar
- [x] `src/components/alpha-bar.tsx` — signature divergence visualization
- [x] `src/components/signal-badge.tsx` — confidence badge (low/medium/high)
- [x] `src/hooks/use-markets.ts` — React Query hook for markets
- [x] `src/hooks/use-signals.ts` — React Query hook for signals
- [x] Sorting by `|EV|` descending

### UI — Market Detail (Sprint 2)

- [x] `src/app/markets/[id]/page.tsx` — market detail page (two-column layout)
- [x] `src/components/analysis-feed.tsx` — signal + tool call timeline
- [x] Back button navigation
- [x] Market header (question, end date, volume, liquidity)
- [x] Signal details panel (Darwin estimate, market price, EV, reasoning)

---

## P1 — Should Ship

### Hero Moment (Sprint 3)

- [x] Demo flow: open grid -> see alpha signals -> click market -> see analysis
- [x] `src/components/query-interface.tsx` — text input to trigger on-demand analysis
- [x] `src/hooks/use-analysis.ts` — React Query mutation for POST /api/analyze
- [ ] Background scanner: run agent on interval (`CYCLE_INTERVAL_MS`)
- [x] Stats bar on grid page: active signals count, markets scanned, high-EV count
- [x] Loading states during analysis (spinner, skeleton)

### Polish (Sprint 3)

- [x] Tool call entries in analysis feed are collapsible
- [ ] Alpha bar tooltip with exact numbers on hover
- [x] Card hover elevation effect
- [x] Scan status indicator in header ("Last scan: 2 min ago")

---

## P2 — Nice to Have

- [x] Responsive layout (3 col > 2 col > 1 col breakpoints)
- [x] Loading skeleton components for cards
- [ ] Error boundary components
- [x] Signal history (persists via SQLite, shown in analysis feed)
- [ ] PnL tracker (virtual: would you have made money?)
- [ ] Export signals as JSON/CSV
- [ ] Sound/visual notification on new high-EV signal
- [ ] Dark/light theme toggle
- [ ] Market search/filter bar
- [ ] Keyboard navigation (j/k to move between cards)

---

## Validation

- [x] `src/test/validate.ts` — 11-check validation script (all passing)
- [x] `scripts/validate.sh` — runner script
- [x] `npx tsc --noEmit` passes
- [x] `npm run build` passes
- [x] Mock data pipeline verified
- [x] Signal CRUD roundtrip verified
- [x] LangGraph graph compiles
- [x] `scripts/test-agent.ts` — full agent pipeline test (mock data + real LLM)
- [x] Vertex AI provider fixed (`@ai-sdk/google-vertex/anthropic` for Claude)
- [x] LLM brain produces calibrated probability estimates with reasoning
- [x] Conditional edges verified: sub-threshold EV correctly skips signal generation
