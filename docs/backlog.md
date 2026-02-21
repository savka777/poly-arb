# Darwin Capital — Backlog

> Prioritized implementation checklist for HackEurope 2026.
> P0 = must ship (no demo without it). P1 = should ship (compelling demo). P2 = nice to have.

---

## P0 — Must Ship

### Foundation (Sprint 1, Hours 0-4)

- [ ] Initialize Next.js 14+ project with App Router
- [x] Core type files: `src/lib/types.ts` (`Result<T>`, `Market`, `Signal`, `Direction`, `TradeProposal`, raw API shapes)
- [x] `src/lib/result.ts` — `ok()`, `err()`, `isOk()` helpers
- [ ] `src/lib/model.ts` — single LLM entry point via Vercel AI SDK `generateText`
- [x] `src/lib/config.ts` — env loading with defaults
- [x] `.env.example` with all required vars _(pre-existing)_
- [ ] `tsconfig.json` — strict mode _(blocked on Next.js init)_
- [ ] **Gate:** `npx tsc --noEmit` passes _(blocked on Next.js init)_

### Data Wrappers (Sprint 1, Hours 4-8)

- [x] `src/data/polymarket.ts` — Gamma API wrapper (market discovery + metadata)
- [x] `src/data/polymarket.ts` — CLOB API wrapper (real-time prices + order book)
- [x] `src/data/valyu.ts` — Valyu search API wrapper (`/v1/deepsearch`)
- [x] All wrappers return `Result<T>`, never throw
- [x] Normalization: `GammaMarket` -> `Market` mapping (`gammaToMarket`)
- [x] Exponential backoff on rate limits (4 attempts: 0/1/2/4s)
- [x] **Gate:** real data fetches return valid typed responses _(Gamma ✓ CLOB ✓ live-verified)_

### Agent + Tools (Sprint 1, Hours 8-16)

- [ ] `src/agent/types.ts` — `AgentConfig`, `AgentContext`, `AgentOutput`, `ToolCallRecord`
- [ ] `src/agent/create-agent.ts` — factory: `AgentConfig` -> callable agent function
- [ ] `src/agent/execute.ts` — tool-use loop via `generateText` (max 10 iters)
- [ ] `src/tools/shared.ts` — `fetchMarkets`, `calculateEV`
- [ ] `src/tools/event-pod.ts` — `fetchRecentNews`, `estimateEventProbability`, `calculatePriceDivergence`, `assessEventTimeline`
- [ ] `src/intelligence/calculations.ts` — EV calculation function
- [ ] `src/store/memory.ts` — in-memory `Map<string, Signal>` store
- [ ] Event Pod mandate (system prompt) in pod config
- [ ] **Gate:** agent produces valid `Signal` from a real Polymarket market

### API Routes (Sprint 2, Hours 16-20)

- [ ] `src/app/api/health/route.ts` — `GET /api/health`
- [ ] `src/app/api/markets/route.ts` — `GET /api/markets`
- [ ] `src/app/api/markets/[id]/route.ts` — `GET /api/markets/[id]`
- [ ] `src/app/api/signals/route.ts` — `GET /api/signals`
- [ ] `src/app/api/analyze/route.ts` — `POST /api/analyze`
- [ ] **Gate:** all routes return valid JSON, tested with curl

### UI — Market Grid (Sprint 2, Hours 20-26)

- [ ] `src/app/layout.tsx` — dark theme, Inter + JetBrains Mono fonts
- [ ] `src/app/page.tsx` — market grid page
- [ ] `src/components/market-card.tsx` — card with question, price, EV, alpha bar
- [ ] `src/components/alpha-bar.tsx` — signature divergence visualization
- [ ] `src/components/signal-badge.tsx` — confidence badge (low/medium/high)
- [ ] `src/hooks/use-markets.ts` — React Query hook for markets
- [ ] `src/hooks/use-signals.ts` — React Query hook for signals
- [ ] Sorting by `|EV|` descending
- [ ] **Gate:** grid renders real market data with alpha bars

### UI — Market Detail (Sprint 2, Hours 26-32)

- [ ] `src/app/markets/[id]/page.tsx` — market detail page
- [ ] `src/components/analysis-feed.tsx` — signal + tool call timeline
- [ ] Back button navigation
- [ ] Market header (question, end date, volume, liquidity)
- [ ] Signal details panel (Darwin estimate, market price, EV, reasoning)
- [ ] **Gate:** detail page shows signal data for a specific market

---

## P1 — Should Ship

### Hero Moment (Sprint 3, Hours 32-40)

- [ ] Demo flow: open grid -> see alpha signals -> click market -> see analysis
- [ ] `src/components/query-interface.tsx` — text input to trigger on-demand analysis
- [ ] `src/hooks/use-analysis.ts` — React Query mutation for POST /api/analyze
- [ ] Background scanner: run agent on interval (`CYCLE_INTERVAL_MS`)
- [ ] Stats bar on grid page: active signals count, markets scanned, high-EV count
- [ ] Loading states during analysis (spinner, skeleton)

### Polish (Sprint 3, Hours 40-48)

- [ ] Tool call entries in analysis feed are collapsible
- [ ] Alpha bar tooltip with exact numbers on hover
- [ ] Card hover elevation effect
- [ ] Scan status indicator in header ("Last scan: 2 min ago")

---

## P2 — Nice to Have

- [ ] Responsive layout (3 col > 2 col > 1 col breakpoints)
- [ ] Loading skeleton components for cards
- [ ] Error boundary components
- [ ] Signal history (persist across scans, show timeline)
- [ ] PnL tracker (virtual: would you have made money?)
- [ ] Export signals as JSON/CSV
- [ ] Sound/visual notification on new high-EV signal
- [ ] Dark/light theme toggle
- [ ] Market search/filter bar
- [ ] Keyboard navigation (j/k to move between cards)

---

## Sprint Map

| Hours | Sprint | Focus |
|-------|--------|-------|
| 0-4 | Sprint 1 | Foundation: Next.js init, types, config |
| 4-8 | Sprint 1 | Data: Polymarket + Valyu wrappers |
| 8-16 | Sprint 1 | Agent: factory, tools, event pod, first Signal |
| 16-20 | Sprint 2 | API: all 5 routes working |
| 20-26 | Sprint 2 | UI: market grid + cards + alpha bar |
| 26-32 | Sprint 2 | UI: market detail + analysis feed |
| 32-40 | Sprint 3 | Hero: query interface, background scanner, demo flow |
| 40-48 | Sprint 3 | Polish: states, interactions, demo prep |
