# Darwin Capital — Dev Log

> **Instructions:** After every meaningful push, add an entry below. Claude agents MUST append entries here.
> Read the latest entries before starting any work — this is how session N+1 knows what session N did.
> Newest entries first.

---

## [2026-02-22 14:00] Claude Sonnet 4.6

### What Changed
- **galaxy-canvas.tsx** — completely replaced GalaxyCanvas (market-clustered interactive stars) with `StarCanvas`: a lightweight cursor-reactive particle system styled as astronomical stars.
  - 220 reactive particles: randomised positions, size 1–3px diameter, opacity 0.15–0.5 at rest
  - Star rendering: sharp center circle + radial glow via `shadowBlur` 4–10px; 4-point diffraction spike (crossing lines, length 6–12px, opacity 0.3) on particles with diameter > 2px
  - Cursor proximity (~150px): particles brighten toward full white and repel via inverse-distance falloff; ease back via lerp factor 0.08
  - Connection lines between particles within 70px: `opacity = (1 - d/70) * 0.25`
  - 300 additional non-interactive background particles (0.5px, 0.08–0.15 opacity) with parallax shift `mouseOffset × 0.015`
  - Canvas now scoped to hero section only (not fixed full-page); `pointer-events-auto` so mouse tracking works through `pointer-events-none` parent
  - 60fps RAF loop, ResizeObserver for window resize, DPR-aware via `setTransform`
- **polyverse-logo.tsx** — new inline SVG component: central dot + 6 orbital dots (radius 8px, angles 0/60/120/180/240/300°) + "POLYVERSE" bold white wordmark. No external assets.
- **page.tsx** — four targeted changes:
  1. Replaced `GalaxyCanvas` (fixed full-page) with `StarCanvas` (inside hero section, absolute inset-0 z-0)
  2. Removed stats bar section (Section A), `StatColumn` component, `LiveStats` interface, `FALLBACK_STATS`, `stats` state, `setStats` call
  3. Replaced text-only POLYVERSE wordmark in navbar with `<PolyverseLogo />`
  4. Updated all landing page copy: hero label, hero subheadline, all three feature column descriptions (col 3 title also changed), concept statement

### Decisions Made
- Kept comparison panes (left/right) and all market/signal state in page.tsx — spec said "do not touch anything else"; panes simply remain closed since canvas no longer has click-to-select
- `StarCanvas` exported from same file path (`galaxy-canvas.tsx`) to minimise diff surface
- Connection line opacity capped at 0.25 (formula × 0.25) to honour "faint" description in spec while following the given formula
- `pointer-events-auto` on canvas container div overrides `pointer-events-none` on parent without restructuring flex layout

### Now Unblocked
- Hero canvas is pure decoration — can add market data back as overlaid data layer without touching the canvas
- Logo SVG can be swapped for a more polished version before presentation

### Known Issues
- Comparison panes are unreachable (no canvas click-to-select) — intentional per Change 1 spec; would need a new selection mechanism (e.g. dashboard link) to re-activate
- On window resize, particles re-initialise (jump) — acceptable for a demo context

### Next Up
- Demo flow polish: ensure grid → click market → see analysis flow still works via dashboard
- Presentation prep

---

## [2026-02-22 12:00] Claude Sonnet 4.6

### What Changed
- **REBRAND (Part 0):** Renamed "Darwin Capital" → "Polyverse" on the landing page only (navbar, hero, footer, browser tab title). Internal app retains "Darwin Capital" branding.
  - `src/app/layout.tsx` — updated `metadata.title` to `"Polyverse"` and updated `description`.
  - `src/app/page.tsx` — all visible "Darwin Capital" text replaced with "Polyverse".
- **GALAXY CANVAS (Part 1):** New component `src/components/galaxy-canvas.tsx` — full interactive canvas visualization replacing the old particle hero.
  - 83 mock markets across 6 clusters (Politics, Economics, Sport, Technology, Science, Culture)
  - Cluster layout as per spec, organically spaced at unit-square positions
  - Stars positioned with seeded Gaussian spread around cluster centers for determinism and stability
  - Volume → radius: logarithmic scale 2–14px
  - Signal color: bullish (#00D47E), bearish (#FF4444), no-signal (white) with linear intensity interpolation based on age (< 10 min = 100%, fading to white after 6h)
  - 300 static background stars with parallax (mouse offset × 0.02)
  - Per-star slow pulse animation (randomised phase + speed, ±0.5px)
  - 4-point diffraction spikes on stars with volume > $100k
  - Radial glow (shadowBlur) on stars with active signals
  - Entry/exit animations: 1.5s fade-in with glow burst, 2s fade-out
  - Hover hit detection (radius + 8px), tooltip drawn on canvas with market question, category, probability, Darwin estimate, volume, signal label
  - Click selects/deselects stars; up to 4 simultaneous; 5th click displaces oldest; empty-space click deselects all
  - Beam lines from selected star to keyword-similar stars in same cluster
  - Cluster labels (all-caps, 0.30 opacity) at cluster centers
  - DevicePixelRatio-aware rendering for retina displays
- **SIDE PANES (Part 2):**
  - Left pane (38vw, slides from left): comparison charts using existing `LightweightChart` + `AlphaBar` + `SignalBadge`. Stacked for 1–2 markets, tabbed for 3–4.
  - Right pane (28vw, slides from right): signal feed with live pulse dot, per-market tabs, signal entries (direction badge, confidence bar, news events), recent signals list.
  - Both panes: 300ms ease-out CSS transition, `backdrop-filter: blur(8px)`, `pointer-events: auto`.
  - Galaxy canvas container shifts `translateX(5vw)` when panes open to re-center star field in middle viewport area (38vw - 28vw)/2 = 5vw offset.
- **HERO OVERLAY (Part 3):** "POWERED BY AI · BUILT FOR POLYMARKET" label, headline "See Prediction Markets in a New Light.", subheadline, "Explore the Universe" CTA. Radial gradient mask behind text block. Overlay fades on scroll > 80px. Animated scroll chevron disappears on scroll.
- **BELOW-FOLD SECTIONS (Part 4):** Stats bar, three feature columns, concept statement, footer — all with solid dark backgrounds (cover fixed galaxy canvas). Live stats polled from `/api/markets` and `/api/signals`, fallback to static values.
- **NAVBAR (Part 5):** Fixed, transparent with `backdrop-filter: blur(12px)`, "POLYVERSE" wordmark left, "Enter Dashboard →" CTA right.
- **Architecture:**
  - Galaxy canvas is `position: fixed; z-index: 0` — always in background.
  - Hero section is transparent 100vh — canvas shows through.
  - Below-fold sections have solid backgrounds (`z-index: 10`) and cover the galaxy on scroll.
  - Side panes are `position: fixed; z-index: 10`.
  - All events use `getBoundingClientRect()` for accurate hit detection through CSS transforms.

### Decisions Made
- Galaxy uses CSS `translateX` for reflow on pane open, not star coordinate recomputation — smooth animation without per-frame recalculation.
- Star positions use seeded RNG on `market.id` for determinism across re-renders and data refreshes.
- `generateMockTimeSeries` reused directly (returns `ProbabilityPoint[]`), timestamps converted to `UTCTimestamp` inline.
- Mock fallback data (83 markets, 6 signals) embedded in `page.tsx` so visualization is never empty.
- Cluster keyword matching is category-first, then question-string keywords, then deterministic hash fallback — no third-party NLP needed.
- Right pane signal feed and left pane charts share a single `activeSignalTab` state for coherent tab sync.
- `AnalysisFeed` component not imported in landing page (not needed — custom `SignalFeedEntry` component is simpler and fits the pane layout).

### Now Unblocked
- Full hero demo flow: galaxy → click star → panes open → view charts + signal feed → click "Open full comparison view →" → compare page.
- On mobile (<768px): panes hidden via CSS media query, galaxy still renders with click-to-deselect.

### Known Issues
- Mobile: tooltip on tap not implemented (bottom sheet as per spec). Deferred — panes hidden on mobile so click just deselects.
- "Explore the Universe" CTA scrolls to below-fold anchor (`#below-fold`). If the galaxy has stars in the bottom viewport area, click targets near the CTA button may be ambiguous. Acceptable for hackathon demo.
- Left pane "Comparison" header shows slot count only; no per-pane Darwin vs Market ratio summary. Could be added as enhancement.

### Next Up
- Polish: add smooth entry animation for below-fold sections (intersection observer fade-in).
- Polish: mobile bottom sheet tooltip on star tap.
- Perf: pause RAF loop when scrollY > window.innerHeight (below-fold sections covering canvas).
- Dashboard: verify "← Back to Home" link still points to `/` — no changes made there.

---

## [2026-02-21 01:00] Claude Sonnet 4.6

### What Changed
- `src/app/page.tsx` — three targeted changes:
  1. **Preview section**: Replaced 3-slide carousel with a single macOS-style framed application window containing an interactive iframe pointing to `/compare?demo=true`. Window chrome: 12px border-radius, traffic light dots (red/yellow/green), centered title bar, `box-shadow: 0 0 60px rgba(255,255,255,0.06)`, mild `perspective(1200px) rotateX(2.5deg)` depth transform. Iframe is fully interactive (`pointer-events: all`), 540px tall. Graceful fallback renders a muted message if the iframe fails to load.
  2. **Hero background**: Added two CSS gradient layers behind the canvas — a green accent radial gradient at 20%/80% (0.15 opacity) and a dark radial gradient centered at 65%/40%. Section background is now pure black (#000) with layered z-index: gradients (z:0) → canvas (z:1) → content (z:10). Increased particles from 120 → 220, reduced opacity floor to 0.15, reduced connection radius from 80 → 70px.
  3. **Copy**: Updated hero subheadline, stats bar labels (3 labels), and concept statement (2 paragraphs) to sharper, more specific copy.
- `src/app/compare/page.tsx` — added demo mode support:
  - `DEMO_MARKETS` and `DEMO_SIGNALS` constants with hardcoded Italy/Sweden FIFA World Cup 2026 data (realistic divergences: Italy 63.5% market / 61.1% Darwin, Sweden 27.5% market / 29.8% Darwin)
  - `const isDemo = searchParams.get("demo") === "true"`
  - `signalMap` useMemo branch for demo data
  - `allMarkets` overridden to `DEMO_MARKETS` when isDemo
  - `slots` state initialized with two demo panels when isDemo (avoids empty-state loading)
  - `useEffect` auto-selects panel 0 and opens analysis sidebar in demo mode
  - "Back to Grid" link hidden when isDemo
  - `marketsLoading` spinner skipped when isDemo

### Decisions Made
- Used iframe with `pointer-events: all` (not scale-down preview) per spec — the demo window is the full app, interactive.
- Demo market slots initialized in `useState` initializer (not a useEffect) to avoid one render with empty state + flash.
- `Signal` type imported into compare/page.tsx was already there — no type changes needed.
- Removed `useCallback` import from page.tsx (no longer needed after carousel removal).
- Gradient layers use inline `zIndex` style rather than Tailwind `z-*` classes to avoid arbitrary value requirements.

### Now Unblocked
- Full demo flow: landing → window shows live Compare view → user can interact with charts
- Stats bar fetches live data and degrades gracefully to static fallback

### Known Issues
- `rotateX(2.5deg)` perspective transform may cause minor sub-pixel rendering artefacts on some GPUs — acceptable for demo
- Demo iframe will still make API calls in background (signals/markets routes); data is overridden in the view but queries run
- `onError` on the iframe only catches network-level failures, not React render errors inside the iframe

### Next Up
- Run end-to-end demo flow validation
- Sprint 3 gate check: grid → click market → analysis → trigger new analysis

---

## [2026-02-21 00:00] Claude Sonnet 4.6

### What Changed
- `src/app/page.tsx` — complete rewrite: 5-section landing page replacing the single-screen hero
  - Section 1: Hero with floating particle canvas (120 particles, connection lines ≤80px, cursor repel ≤150px). Canvas is `overflow-hidden` inside the hero `<section>`, strictly preventing bleed into sections below. RadialGradient overlay for text legibility.
  - Section 2: Live stats bar (`bg-darwin-card`, solid). Fetches `/api/markets` + `/api/signals` and falls back to static values (847 / 12 / 3).
  - Section 3: App preview carousel — 3 iframe slides (`/dashboard`, `/compare`, `/dashboard`) scaled to 70% via `transform: scale(0.7)`, non-interactive. Auto-advances every 6 s, pauses on hover. Prev/next arrows + dot indicators.
  - Section 4: Concept statement — centered copy, max-width 680px, no decorations.
  - Section 5: Minimal footer with `Enter App →` link.
- `src/app/dashboard/page.tsx` — added `← Home` Link to `/` at top-left of the header nav, import `Link` from `next/link`

### Decisions Made
- Landing page is `/` (default route) and dashboard stays at `/dashboard` — no route changes needed.
- Canvas scoped to hero `<section>` via `hero.offsetWidth/Height` sizing and `overflow-hidden` clipping; mouse events handled on the hero element (not `window`) so coordinates are naturally relative.
- All sections below hero use `bg-darwin-card` or `bg-darwin-bg` explicit opaque backgrounds.
- CTA buttons use `bg-darwin-text text-darwin-bg` (near-white fill, dark text) for solid high-contrast appearance, no ghost styles.
- Used `darwin-*` prefixed Tailwind classes throughout to match `@theme inline` definitions in `globals.css`.
- Non-null canvas/ctx/hero captured into `cvs`/`c`/`heroEl` consts before inner function definitions to satisfy `strict: true` TypeScript narrowing.

### Now Unblocked
- Demo flow: landing → Launch Dashboard → market grid → click market → analysis
- Can add a `/markets/[id]` carousel slide once a known seed market ID is available

### Known Issues
- Carousel slide 3 (`/dashboard`) is a duplicate of slide 1 — pending a real query-interface route or separate page
- `scrolling="no"` on `<iframe>` is deprecated HTML4 but still works; acceptable for demo

### Next Up
- Polish: add `/markets/[example-id]` as slide 2 using a seeded market ID
- Verify carousel iframe loads on all browsers (Chrome, Firefox, Safari)
- Sprint 3 gate: full demo flow end-to-end check

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
