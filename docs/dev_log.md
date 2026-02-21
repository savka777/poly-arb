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

## [2026-02-22 00:00] Integrate Pulled UI Changes + Re-add Watchlist Toggle

### What Changed
- **Pulled:** 9 files from remote main — compare page overhaul (drag-and-drop slots, search modal, grid layout modes), lightweight-chart tooltip + crosshair improvements, resizable-grid layout modes (horizontal/vertical/auto), crosshair sync with visible range sync, ohlc volume-as-volatility-proxy.
- **Re-integrated:** `src/app/markets/[id]/page.tsx` — the pull overwrote our watchlist toggle button. Re-added `useWatchlist`/`useToggleWatchlist` hooks, `Star` icon import, and the Watch/Watching button in the header bar (next to Analysis toggle). Yellow fill + border when active.

### Decisions Made
- **Watchlist button placement** — positioned left of the Analysis toggle in the header, matching the same border/pill button style for visual consistency.

### Now Unblocked
- All UI features from both branches are now integrated: compare page with drag-and-drop + search modal, chart improvements, AND watchlist toggle on market detail.

### Known Issues
- None — `npx tsc --noEmit` passes with zero errors.

### Next Up
- Verify full demo flow end-to-end

---

## [2026-02-21 23:30] Full Build Fix — Zero TypeScript Errors + Dev Server Running

### What Changed

**API Routes — Wired to Real Agent Pipeline:**
- **Rewritten:** `src/app/api/analyze/route.ts` — replaced 100% mock analyze endpoint with real `runEventPod()` pipeline. Fetches market via `fetchMarketById()`, runs full LangGraph pipeline (news → LLM → divergence → signal), returns real `{ signal, reasoning, toolCalls }`.
- **Rewritten:** `src/app/api/signals/route.ts` — reads from SQLite via `getSignals()` instead of `MOCK_SIGNALS`. Supports `?confidence=high` and `?minEv=0.05` query params.
- **Rewritten:** `src/app/api/markets/[id]/route.ts` — uses `getSignalsByMarket(id)` from SQLite instead of `MOCK_SIGNALS`.
- **Rewritten:** `src/app/api/health/route.ts` — triggers `startScanner()` on first request. Returns real signal count from SQLite + scanner status.

**Background Scanner:**
- **Created:** `src/scanner/index.ts` — singleton scanner that runs inside Next.js server process. Fetches top 20 markets + watchlist each cycle, runs `runEventPod()` sequentially. Lazy-starts on first `/api/health` hit. Configurable via `config.cycleIntervalMs` (default 5 min).

**Watchlist System:**
- **Modified:** `src/db/schema.ts` — added `watchlist` table (marketId TEXT PK, addedAt TEXT).
- **Modified:** `src/db/index.ts` — added `CREATE TABLE IF NOT EXISTS watchlist` to init SQL.
- **Created:** `src/store/watchlist.ts` — CRUD: `addToWatchlist`, `removeFromWatchlist`, `getWatchlist`, `isWatchlisted`.
- **Created:** `src/app/api/watchlist/route.ts` — `GET` (list), `POST` (add), `DELETE` (remove) endpoints.
- **Created:** `src/hooks/use-watchlist.ts` — React Query hooks: `useWatchlist()` for list, `useToggleWatchlist()` mutation.
- **Modified:** `src/app/markets/[id]/page.tsx` — added star/bookmark button in header to toggle watchlist. Yellow fill when active.
- **Modified:** `src/app/page.tsx` — passes `watchlisted` prop to MarketCard for badge display.
- **Modified:** `src/components/market-card.tsx` — shows yellow star icon on watchlisted market cards.

**Type System Fixes (got `npx tsc --noEmit` to ZERO errors):**
- **Modified:** `src/lib/types.ts` — added `NewsResult` interface (was imported but never declared), added `ScannerStatus` interface, added `scanner` field to `HealthResponse`, fixed `ToolCallRecord` (renamed `toolName` → `name`, made `id`/`durationMs` optional, kept `toolName` as optional alias).
- **Modified:** `src/components/analysis-feed.tsx` — handles both `name` and `toolName` via `toolCall.name ?? toolCall.toolName`, conditionally renders `durationMs`.
- **Modified:** `src/lib/mock-data.ts` — changed `toolName:` → `name:` in MOCK_TOOL_CALLS to match updated interface.
- **Modified:** `src/data/mock.ts` — removed `conditionId`/`tokenIds` from mock Market objects (fields don't exist on `Market` interface).
- **Modified:** `src/data/valyu.ts` — removed `config.useMockData` check and `getMockNewsResults` import (neither exist), hardcoded Valyu API URL instead of `config.valyu.baseUrl`.
- **Modified:** `scripts/test-apis.ts` — removed references to deleted exports `fetchTokenPrice`/`fetchOrderBook` and deleted properties `conditionId`/`tokenIds`.

**Dependency Installs (were imported but missing from package.json):**
- `drizzle-orm`, `better-sqlite3`, `@types/better-sqlite3` — SQLite/Drizzle ORM
- `@langchain/langgraph` — LangGraph agent orchestration
- `@ai-sdk/google-vertex` — Vertex AI provider for LLM
- `drizzle-kit` — Drizzle migrations/introspect tooling

**Build Fixes:**
- **Deleted:** `postcss.config.js` — conflicted with correct `postcss.config.mjs` (old file used `tailwindcss` directly as plugin; correct file uses `@tailwindcss/postcss`).
- **Modified:** `.gitignore` — added `darwin.db`, `darwin.db-shm`, `darwin.db-wal` to prevent committing SQLite files.

### Decisions Made
- **Sequential scanning** — `runEventPod()` calls run one at a time to avoid exhausting Valyu + LLM API rate limits. Concurrency can be added later.
- **Lazy scanner start** — Scanner starts on first `/api/health` hit rather than on module import, so it doesn't interfere with builds or cold starts.
- **No mock data imports in API routes** — All API routes now use only real data sources (Gamma API + SQLite). Mock data files remain for development/testing only.
- **Watchlist priority** — Watchlisted markets are fetched and analyzed first in each scanner cycle, before top-volume markets.

### Now Unblocked
- Full demo flow: grid → click market → Analyze → see real AI signals with real news
- Background intelligence: scanner populates signals automatically
- Watchlist: users can track specific markets for priority scanning
- `npx tsc --noEmit` passes with zero errors — clean build

### Known Issues
- Scanner requires `VALYU_API_KEY` + LLM credentials to produce signals. Without these, pipeline will error gracefully but produce no signals.
- `next.config.js` warns about `experimental.serverComponentsExternalPackages` → should migrate to `serverExternalPackages` (non-breaking, just a deprecation warning).

### Next Up
- Verify full demo flow end-to-end with live API keys
- Demo flow polish and error state handling
- Scanner concurrency controls (semaphore-based)

---

## [2026-02-21 20:00] Pipeline Config System + Expired Market Fix

### What Changed
- **Modified:** `src/lib/config.ts` — added `marketFilters` (minLiquidity, minVolume, minProbability, maxProbability) and `strategies` (enabled list parsed from comma-separated env var) config sections
- **Modified:** `src/lib/types.ts` — added `oneDayPriceChange?: number`, `volume24hr?: number`, `spread?: number` to `Market` interface (Gamma API already returns these fields)
- **Modified:** `src/data/polymarket.ts` — `gammaToMarket()` passes through new volatility fields; `fetchMarkets()` applies config-based filters (liquidity, volume, probability range); added `end_date_min` param to Gamma API query + client-side expired-market filter to exclude resolved/past-endDate markets; added volume sort
- **Modified:** `src/agent/nodes.ts` — `calculateDivergenceNode` checks `config.strategies.enabled` includes `'ev'` before running EV calculation; skips to END if strategy not enabled
- **Created:** `scripts/test-pipeline.ts` — end-to-end pipeline test script with active config display
- **Modified:** `package.json` — added `test:pipeline` script
- **Modified:** `.env.example` — added `MARKET_MIN_LIQUIDITY`, `MARKET_MIN_VOLUME`, `MARKET_MIN_PROBABILITY`, `MARKET_MAX_PROBABILITY`, `ENABLED_STRATEGIES`

### Decisions Made
- **Expired market filtering** — Gamma API returns markets with `active: true, closed: false` even after their `endDate` has passed (e.g. 2025 Trump deportation markets still showing in Feb 2026). Fixed by passing `end_date_min` to the API and adding a client-side safety net.
- **Probability filters as volatility proxy** — markets at 95%+ or 5%- are nearly resolved and won't produce useful signals. Markets closer to 50% have more uncertainty and are more likely to show news-to-price lag.
- **Config filters apply in addition to caller options** — `FetchMarketsOptions` passed by the caller override config defaults if more restrictive (uses `Math.max` for liquidity).
- **Strategy check is minimal** — only EV exists now, but the pattern (`config.strategies.enabled.includes('ev')`) makes it trivial to add future strategies.

### Now Unblocked
- Pipeline now surfaces live 2026 markets with real volume (GTA VI, NHL, Netherlands PM, etc.)
- Custom market targeting via env vars (e.g., `MARKET_MIN_LIQUIDITY=5000 MARKET_MIN_PROBABILITY=0.10 MARKET_MAX_PROBABILITY=0.90`)
- Future strategies can be added by extending the `ENABLED_STRATEGIES` env var
- UI settings panel can read from the same config structure

### Known Issues
- None

### Next Up
- UI settings panel for runtime config changes
- Additional strategies beyond EV divergence

---

## [2026-02-21 15:30] Compare Flow Rework + Toggleable Analysis Panel

### What Changed

**Modified files:**
- `src/app/compare/page.tsx` — Reworked flow: starts empty instead of auto-loading 4 markets. Users add markets one at a time via "Add Market" button. Supports `?add=marketId` URL param for adding from detail page. Removed fixed layout selector — grid auto-sizes based on number of panels (1→2→4→6→8). Added remove button per panel.
- `src/components/resizable-grid.tsx` — Now derives layout automatically from `children.length` instead of requiring explicit `panelCount` prop. Simpler API.
- `src/components/compare-panel.tsx` — Added `onRemove` prop and X button in panel header to remove individual panels.
- `src/components/compare-link.tsx` — Accepts optional `marketId` prop. Shows "Add to Compare" on detail page (navigates to `/compare?add=id`), plain "Compare" on grid page.
- `src/app/markets/[id]/page.tsx` — Darwin Analysis right panel is now toggleable via "Analysis" button in header. Panel collapses to give chart full width. CompareLink now passes market ID.

### Decisions Made
- **Incremental add flow** — Users build their compare view market by market instead of getting 4 random ones. More intentional, matches how TradingView watchlists work.
- **Auto-layout** — Grid auto-determines cols/rows from panel count: 1→1x1, 2→2x1, 3-4→2x2, 5-6→3x2, 7-8→4x2. No manual layout picker needed.
- **Toggleable analysis** — Right panel takes 380px, hiding it gives the chart full width for price action focus.

### Now Unblocked
- URL-based compare state (share compare views)
- Persistent compare lists (localStorage)

### Known Issues
- Compare state is lost on page refresh (in-memory only)
- Max 8 panels hardcoded

### Next Up
- Demo flow polish

---

## [2026-02-21 14:00] TradingView-Grade Chart Platform + Filters

### What Changed

**New files created:**
- `src/lib/chart-types.ts` — Shared chart type defs (ChartType, TimeFrame, ChartDataPoint, OhlcDataPoint, VolumeDataPoint)
- `src/lib/ohlc.ts` — Server-side OHLC aggregation from raw `{t,p}` points, adaptive bucket sizes per interval
- `src/lib/fair-value.ts` — localStorage CRUD for per-market fair value with Result<T>
- `src/lib/chart-events.ts` — Lightweight pub/sub event bus for crosshair sync across panels
- `src/contexts/chart-settings.tsx` — Global chart settings context (chartType, timeFrame, showVolume, overlays)
- `src/hooks/use-panel-settings.ts` — Per-panel local override logic with override indicators
- `src/hooks/use-fair-value.ts` — React hook wrapping localStorage fair value
- `src/hooks/use-crosshair-sync.ts` — Hook connecting charts to crosshair event bus
- `src/components/resizable-grid.tsx` — CSS Grid + mouse drag resizable panels, double-click reset
- `src/components/chart-toolbar.tsx` — [Line][Candle][Area] | [1D][1W][1M][ALL] | [Vol] | [Darwin][FV] + reset
- `src/components/ohlc-header.tsx` — TradingView-style O:H:L:C:Vol data line
- `src/components/fair-value-editor.tsx` — Inline probability editor with pencil/save/reset

**Modified files:**
- `src/components/lightweight-chart.tsx` — Full refactor: stable lifecycle (mount once), line/area/candlestick series toggle via `applyOptions({ visible })`, volume histogram on overlay price scale, crosshair sync support, fair value price line overlay
- `src/components/compare-panel.tsx` — Added chart toolbar, OHLC header, panel settings, fair value, framer-motion drag animations, crosshair sync refs
- `src/app/compare/page.tsx` — Replaced fixed 2x2 CSS grid with ResizableGrid, layout selector (1/2/4/6), crosshair sync toggle
- `src/app/markets/[id]/page.tsx` — Added chart toolbar, OHLC header, fair value editor in signal summary, panel settings
- `src/app/providers.tsx` — Added ChartSettingsProvider wrapper
- `src/app/globals.css` — True black background (#0A0A0F), darker card (#111118)
- `src/app/api/prices/route.ts` — Added `?mode=ohlc` query param for OHLC aggregation
- `src/hooks/use-prices.ts` — Added `useOhlc()` hook alongside existing `usePrices`
- `src/app/page.tsx` — Polymarket-style filter bar: search, category pills, sort (Alpha/Volume/Newest/Probability), signal filter (All/Has Signal/High EV/Bullish/Bearish), clear all

### Decisions Made
- **True black (#0A0A0F)** — User requested TradingView-like high contrast. Changed from #131722.
- **White line by default** — Market price is white (#FFFFFF), overlays use colors (green/red/blue/yellow). Line width 1px for clean look.
- **Stable chart lifecycle** — Create chart + all series types once on mount. Toggle visibility via `applyOptions({ visible })`. Avoids flicker on settings changes.
- **OHLC from raw prices** — Polymarket CLOB only returns `{t,p}`. Aggregate server-side with adaptive buckets: 1d→5min, 1w→1hr, 1m→4hr, all→1day. Volume = tick count (activity proxy).
- **Resizable grid via CSS Grid + mouse events** — No external library. colSplits/rowSplits state as fractions. Reset on panelCount change.
- **Global + local settings** — ChartSettings context for global defaults, per-panel overrides with blue dot indicators and reset button.
- **Fair value in localStorage** — Key `darwin_fv_${marketId}`. Falls back to Darwin AI estimate if no custom value.
- **Category pills from API data** — Categories extracted dynamically from market data, not hardcoded.

### Now Unblocked
- Demo polish: loading states, error handling
- Background scanner integration with new chart components
- Sentiment overlay (placeholder in settings, needs data source)

### Known Issues
- Crosshair sync works via event bus but `subscribeCrosshairMove` doesn't return an unsubscribe function in lightweight-charts v5 — cleanup relies on chart removal
- Volume data is tick-count proxy, not actual trade volume (Polymarket CLOB limitation)
- Fair value editor doesn't validate against negative or >100% values on paste

### Next Up
- Wire sentiment overlay when data source available
- Add keyboard shortcuts for chart type toggle
- Demo flow polish

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
