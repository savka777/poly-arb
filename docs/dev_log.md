# Darwin Capital — Dev Log

> **Instructions:** After every meaningful push, add an entry below. Claude agents MUST append entries here.
> Read the latest entries before starting any work — this is how session N+1 knows what session N did.
> Newest entries first.

## [2026-02-21 XX:XX] Claude Opus 4.6

### What Changed
- **Architecture redesign:** Replaced blind-polling scanner + news-monitor with orchestrator + 3 watchers
  - `src/scanner/orchestrator.ts` — priority queue, worker pool, adaptive cooldowns, per-market locks
  - `src/scanner/watchers/price-watcher.ts` — polls Gamma, enqueues markets with >2% price change
  - `src/scanner/watchers/news-watcher.ts` — keyword-based matching (no LLM), replaces old LLM-based matcher for initial filtering
  - `src/scanner/watchers/time-watcher.ts` — enqueues near-expiry markets (<7d)
- **Agent pipeline fixes (nodes.ts):**
  - Removed anchoring bias — market price no longer shown to LLM
  - Added system prompt with calibration rules
  - Now uses `buildNewsQuery()` to clean market questions into search queries
  - Truncates news content to 600 chars per article (was unlimited)
- **EV calculation (calculations.ts):**
  - W_NEWS lowered from 0.7 to 0.4 (configurable via env)
  - Removed dead `calculateEV()` function
  - Removed unused `odds` variable in `kellyFraction()`
- **Data flow fixes:**
  - `/api/markets` — removed silent mock fallback, now returns 502 on failure
  - `/api/analyze` — added rate limiting (max 3 concurrent, 5/min)
  - `store/signals.ts` — fixed `getSignalCount()` to use SQL COUNT instead of full table scan
  - `store/signals.ts` — added `hasRecentSignal()` (shared dedup) and `pruneExpiredSignals()`
  - `hooks/use-news-events.ts` — polling interval 10s -> 30s
- **Types cleanup:** Removed `TradeProposal`, added `OrchestratorStatus`
- **Config:** Added orchestrator, EV weight, rate limit, and cooldown env vars
- **Health endpoint:** Wired to orchestrator instead of old scanner/news-monitor

### Decisions Made
- Kept old `scanner/index.ts` and `scanner/news-monitor.ts` intact (not deleted) as reference — health endpoint no longer imports them
- Used keyword-based matching in news-watcher instead of LLM-based matching to avoid wasting LLM calls on pre-filtering
- Chose in-memory priority queue over SQLite-backed queue for simplicity and speed
- W_NEWS = 0.4 reflects that prediction markets are generally better-calibrated than individual LLM estimates

### Now Unblocked
- Full demo flow: grid -> detail -> analyze
- Signal dedup works across orchestrator + manual analysis
- Near-expiry markets get priority re-analysis

### Known Issues
- Orchestrator still starts from health endpoint (requires browser tab); should move to instrumentation file
- Old scanner/news-monitor files are orphaned (can be deleted)
- `MOCK_SIGNALS` in mock-data.ts still defined but unused

### Next Up
- Move orchestrator startup to Next.js instrumentation file
- Add CLOB live price fetching before EV calculation
- Update `docs/agents.md` to reflect new architecture
- Delete old scanner/news-monitor once orchestrator is validated in production

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

## [2026-02-22 02:30] News-First Monitor — Breaking News → Affected Markets → Signals

### What Changed

**New parallel pipeline** — the system was market-first only (scanner polls markets → fetches news → estimates → signals). This adds a news-first pipeline that runs alongside: poll Valyu for breaking news → LLM-match to active markets → trigger EV pipeline on matched markets. Catches fast-moving events where a headline drops before the market reprices.

**Types — `src/lib/types.ts`:**
- Added `NewsEvent` interface: `{ id, article: { title, url, source, content }, matchedMarkets: [{ marketId, question, relevance }], signalsGenerated: string[], timestamp }`.
- Added `NewsMonitorStatus` interface: `{ running, lastPollAt, articlesProcessed, signalsGenerated }`.
- Added `newsMonitor?: NewsMonitorStatus` to `HealthResponse`.
- Added `source?: 'scanner' | 'news-monitor'` to `Signal` for provenance tracking.

**Config — `src/lib/config.ts`:**
- Added `newsMonitor` section: `intervalMs` (30s default), `queries` (rotating list of broad search terms), `maxArticlesPerPoll` (10 default).

**Market matcher — `src/intelligence/market-matcher.ts` (new):**
- LLM-powered function using `generateObject` with zod schema. Takes a news article + list of active markets, returns high/medium matches with reasoning. Batches markets in groups of 50 to fit context window.

**News events store — `src/store/news-events.ts` (new):**
- In-memory ring buffer (last 100 events). `addNewsEvent()`, `getRecentNewsEvents(limit)`, `getNewsEventCount()`. No persistence — news events are ephemeral.

**News monitor loop — `src/scanner/news-monitor.ts` (new):**
- Mirrors `src/scanner/index.ts` pattern. Polls Valyu with rotating queries, deduplicates via `Set<string>` (title hash, capped at 500), caches active markets (60s TTL), calls `matchNewsToMarkets()` for each new article, triggers `runEventPod()` for each matched market. Exports `startNewsMonitor()`, `stopNewsMonitor()`, `getNewsMonitorStatus()`.

**API route — `src/app/api/news-events/route.ts` (new):**
- `GET /api/news-events?limit=N` — returns `{ events, total }` from ring buffer.

**Health route — `src/app/api/health/route.ts`:**
- Now calls `startNewsMonitor()` alongside `startScanner()`. Response includes `newsMonitor` status.

**React Query hook — `src/hooks/use-news-events.ts` (new):**
- `useNewsEvents(limit)` — polls `/api/news-events` every 10s. Follows `use-signals.ts` / `use-markets.ts` pattern.

**News ticker — `src/components/news-ticker.tsx` (new):**
- Horizontal bar between stats bar and filter bar. Shows latest headlines with source tags, timestamps. Color-coded dots: green (signal generated), blue (matched markets), gray (unmatched). Pulsing red "LIVE" indicator when monitor is running. Click opens feed panel.

**News feed panel — `src/components/news-feed.tsx` (new):**
- Collapsible panel toggled via "News" button in header. Reverse-chronological list of news event cards. Each card: source badge, headline (linked), timestamp, matched markets with links, signal count. Follows `analysis-feed.tsx` design: `darwin-card` bg, `darwin-border`, `border-l-2` accent (green for signals, blue for matches).

**Main page — `src/app/page.tsx`:**
- Added `useNewsEvents()` hook. Added "News" toggle button in header (next to Compare). Inserted `NewsTicker` between stats bar and filter bar. Inserted `NewsFeed` panel (collapsible) below header.

**Env — `.env.example`:**
- Documented `NEWS_MONITOR_INTERVAL_MS`, `NEWS_MONITOR_QUERIES`, `NEWS_MONITOR_MAX_ARTICLES_PER_POLL`.

### Decisions Made
- **Parallel pipeline, not replacement** — the existing market scanner continues for slow-moving divergences. The news monitor catches fast-moving events. Both write to the same signal store.
- **News monitor triggers `runEventPod()` directly** — the value of the news monitor is in *selecting which markets to analyze at the right time*, not in replacing the analysis pipeline. The existing pipeline already fetches news and generates signals.
- **In-memory ring buffer, no DB** — news events are ephemeral/real-time. No value in persisting stale articles across restarts. 100-event cap keeps memory bounded.
- **Dedup by title prefix** — `title.toLowerCase().slice(0, 100)` as key. Simple but effective for preventing re-processing the same article across polls.
- **Market cache with 60s TTL** — avoids hammering Polymarket API on every article. Markets don't change that frequently.
- **LLM-powered matching over keyword matching** — keyword matching would miss semantic connections (e.g., "Fed raises rates" affecting "Will S&P 500 reach 6000?"). The LLM can reason about causal relationships.

### Now Unblocked
- Real-time news-driven signal generation — breaking events trigger analysis within seconds
- News feed UI — users can see what the system is detecting and which markets it matched
- Signal provenance — `source` field on Signal distinguishes scanner vs news-monitor origin
- Tunable via env vars — poll frequency, search queries, articles per poll

### Known Issues
- `Signal.source` is added to the type but `generateSignalNode` doesn't set it yet — signals from both pipelines will have `source: undefined` until the node is updated to accept a source parameter.
- News monitor and scanner can both trigger `runEventPod()` on the same market simultaneously — no lock/dedup between them. In practice this is harmless (duplicate signals with slightly different timestamps) but could waste API calls.
- LLM matching cost — every new article triggers an LLM call to match against all active markets. At 10 articles/poll and 30s intervals, this is ~20 LLM calls/minute for matching alone. Monitor the Vertex AI bill.

### Next Up
- Wire `source` field through `generateSignalNode` so signals have provenance
- Add dedup between scanner and news monitor (skip `runEventPod` if signal exists for that market within TTL)
- Consider filtering news monitor results by relevance score before LLM matching
- UI: show signal source badge on market cards

---

## [2026-02-22 01:00] Math-First EV Calculation — Bayesian Logit-Space Engine

### What Changed

**Core math engine — `src/intelligence/calculations.ts` (rewritten):**
- Replaced naive `ev = llmEstimate - marketPrice` with a Bayesian logit-space framework. The market price is now treated as the **prior**, and the LLM's estimate is one **feature input** rather than ground truth.
- **Math primitives:** `logit(p) = ln(p/(1-p))`, `sigmoid(x) = 1/(1+e^(-x))`, `clamp(p)` to avoid log(0). All probability math happens in log-odds space where additive combination is statistically valid (unlike raw probability space).
- **News feature** `z_n = logit(llmEstimate) - logit(marketPrice)`: measures how far the LLM thinks the market has moved, in log-odds. A 10% shift near 50% is smaller in log-odds than a 10% shift near 90% — this correctly captures that tail movements are more informative.
- **Time feature** `z_t = -1/(1 + daysLeft/30)`: a negative feature that pulls the combined estimate back toward the market price as expiry approaches. At 30 days out z_t ≈ -0.5, at 1 day out z_t ≈ -0.97. Rationale: as resolution nears, the market has had more time to incorporate all information, so our edge shrinks.
- **Logit-space combination:** `logit(p_hat) = logit(p_market) + w_n * z_n + w_t * z_t`. Features are weighted (w_n=0.7, w_t=0.3) and summed in log-odds, then converted back via sigmoid. This is equivalent to a log-linear model and avoids the boundary problems of naive probability addition.
- **Confidence lower bound:** `p_hat_LB = sigmoid(logit(p_m) + 0.5 * shift)` — halves the total shift to get a conservative estimate. Only signals where even this conservative bound beats costs are considered tradeable.
- **Cost estimation** `estimateCosts()`: fee (2% on winnings — Polymarket standard), slippage (3%/1%/0.5% bucketed by liquidity <$10k/<$100k/else), resolution risk (10%/3%/1% bucketed by days to expiry <1d/<7d/else), latency decay (0.5% fixed). Total cost is subtracted from gross EV.
- **Net EV:** `evNet = (p_hat - p_market) - costs.total`. The EV after real trading friction.
- **Tradeability gate:** `tradeable = evNetLB > 0` — only signals where the *lower-bound* net EV is positive survive. This replaces the old `|ev| >= threshold` check, which had no cost awareness.
- **Kelly fraction** (for future use): half-Kelly sizing `f = 0.5 * max(edge / (1-p), 0)`, capped at 1.
- Legacy `calculateEV()` and `evToConfidence()` kept for backward compatibility.

**Types — `src/lib/types.ts`:**
- Added `CostBreakdown` interface: `{ fee, slippage, latencyDecay, resolutionRisk, total }`.
- Added `EVResult` interface: `{ pHat, pHatLB, evGross, evNet, evNetLB, direction, costs, features, tradeable }`.
- Extended `Signal` with optional fields: `evNet`, `costs`, `features`, `tradeable`, `pHatLB`. All optional for backward compatibility with existing signals in the DB.

**Agent pipeline — `src/agent/state.ts`, `src/agent/nodes.ts`, `src/agent/graph.ts`:**
- `divergence` annotation type changed from `{ value, direction, significant }` to `EVResult`. The full math result flows through the graph.
- `calculateDivergenceNode` now calls `calculateNetEV({ llmEstimate, marketPrice, endDate, liquidity })` — uses market endDate and liquidity for cost/time features, not just the two probabilities.
- `generateSignalNode` populates new Signal fields from EVResult. `signal.darwinEstimate` is now `pHat` (logit-combined) not the raw LLM output. `signal.ev` is `evNet` (after costs).
- `shouldContinueAfterDivergence` checks `divergence.tradeable` instead of `divergence.significant`. The graph only generates a signal if lower-bound EV survives costs.

**Database — `src/db/schema.ts`, `src/db/index.ts`, `src/store/signals.ts`:**
- Schema: 5 new nullable columns — `ev_net REAL`, `costs TEXT` (JSON), `features TEXT` (JSON), `tradeable INTEGER` (0/1), `p_hat_lb REAL`.
- Migration: `ALTER TABLE signals ADD COLUMN ...` statements with error swallowing (idempotent — safe to re-run if columns already exist).
- `signalToRow`/`rowToSignal`: serialize `costs` and `features` as JSON strings, handle null for backward-compatible reads of old signals.

**UI — `src/app/markets/[id]/page.tsx`, `src/components/market-card.tsx`:**
- Market detail: EV display uses `evNet ?? ev` (backward compatible). Shows "(net)" label when new data available. Added costs breakdown section (fee, slippage, resolution risk percentages). Added "Tradeable" / "Below threshold" badge.
- Market card: EV display uses `evNet ?? ev`. Shows "EV (net)" label. Added green "T" badge next to confidence badge for tradeable signals.

**Config — `.env.example`:**
- Added documentation note about `W_NEWS` / `W_TIME` weights (currently hardcoded, env override planned).

### Decisions Made
- **Log-odds space for combination** — adding probabilities directly (0.6 + 0.1 = 0.7) is not statistically valid. Log-odds are additive under the log-linear model, so `logit(prior) + feature_shifts` is the correct way to combine evidence with a prior. This is the same math behind logistic regression.
- **Market price as prior, not LLM as ground truth** — the old approach trusted the LLM's probability estimate at face value. The new approach starts from the market price (which reflects all public information) and only shifts it based on the *relative difference* the LLM sees. If the LLM and market agree, EV ≈ 0 regardless of price level.
- **Conservative lower bound via half-shift** — rather than building a full posterior distribution (which requires calibration data we don't have), we use a simple heuristic: the lower bound uses half the logit-space shift. This means we need roughly 2x the edge to clear the tradeability gate.
- **Costs are subtracted, not ignored** — the old EV was gross (before fees). A signal showing +5% EV with 4.5% costs is barely worth acting on. The new system surfaces this clearly.
- **Feature weights are fixed for now** — w_n=0.7, w_t=0.3. These should eventually be calibrated on historical signal accuracy, but hardcoded is fine until we have that data.
- **`tradeable` replaces `significant`** — the concept changed from "is the EV large enough" (arbitrary threshold) to "does the lower-bound EV survive real costs" (quantitative gate). The old `EV_THRESHOLD` config is no longer used for the gate — it could be repurposed for display filtering.

### Now Unblocked
- Signals now reflect real trading economics — only actionable signals survive
- Cost-adjusted backtesting (when historical resolution data available)
- Kelly-based position sizing (function exists, needs integration with execution layer)
- Weight calibration (collect signal accuracy data → fit w_n, w_t)

### Known Issues
- `EV_THRESHOLD` in config is no longer used as the tradeable gate — old code referencing it for filtering still works but is conceptually superseded by `tradeable`. Could be cleaned up.
- Feature weights (0.7 / 0.3) are not yet configurable via env vars — hardcoded in calculations.ts.
- `kellyFraction()` computes `odds` but doesn't use it (dead variable) — harmless, but should be cleaned up if the function is put into production use.
- Existing signals in the DB will have null for all new fields — `rowToSignal` handles this gracefully, but UI will show old-style EV for those signals.

### Next Up
- Verify full demo flow with the new EV engine (scanner should show net EV and filter out sub-threshold signals)
- Consider adding env var overrides for w_n / w_t
- Calibration data collection: log predicted vs actual outcomes for weight tuning

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
