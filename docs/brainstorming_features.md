# Brainstorming: Net-New Priorities for Susquehanna-Style Traders

## Scope
This list intentionally excludes items already in the current implementation plan (`docs/backlog.md`) and focuses on **new additions** that align with lessons in `docs/workshop_analysis.md`.

## Priority Order (Most Important → Least Important)

1. **Hard Kill Switch + Runtime Safety Toggles**
- Why this matters (workshop): Susquehanna emphasizes simple, reliable shutdown above all when things go wrong.
- Easiest solution: **Unleash (open source feature flags)** for `kill_switch`, `scan_enabled`, `high_confidence_only`.
- Fast implementation path:
  - Add Unleash Node SDK in API/runtime.
  - Guard every scan/analyze entrypoint with flags.
  - Add admin route to flip kill flag instantly.
- Links:
  - https://docs.getunleash.io/sdks/node

2. **Durable Background Execution (No Overlapping Cycles)**
- Why this matters (workshop): avoids race conditions and cycle overruns as market count grows.
- Easiest solution: **Inngest** instead of hand-rolled interval loops.
- Fast implementation path:
  - Move scanner to Inngest function with `concurrency`/rate controls.
  - Trigger on schedule + on-demand event.
- Links:
  - https://www.inngest.com/docs/
  - https://www.inngest.com/docs/getting-started/nextjs-quick-start

3. **Distributed Cache + Scan Lock + Request Throttling**
- Why this matters (workshop): rate-limit coordination and avoiding duplicate work from concurrent callers.
- Easiest solution: **Upstash Redis REST API**.
- Fast implementation path:
  - Cache news query results with TTL.
  - Use `SETNX`-style lock key for `scan_in_progress`.
  - Add per-provider request counters.
- Links:
  - https://upstash.com/docs/redis/features/restapi

4. **State Snapshot Recovery (without full DB migration)**
- Why this matters (workshop): current in-memory store loses state on restart; no audit trail.
- Easiest solution: **Vercel Blob** for periodic JSON snapshots of signals + cycle metadata.
- Fast implementation path:
  - After each scan, write `signals-<timestamp>.json`.
  - On boot, load latest snapshot as warm start.
- Links:
  - https://vercel.com/docs/vercel-blob

5. **Production Visibility: Errors + Profiling + Latency Breakdown**
- Why this matters (workshop): “profile before optimize” and identify bottlenecks quickly.
- Easiest solution: **Sentry Next.js + Node profiling**, optionally OpenTelemetry export later.
- Fast implementation path:
  - Install `@sentry/nextjs` via wizard.
  - Enable tracing/profiling in scanner/analyze routes.
  - Tag events with `marketId`, `cycleId`, `toolName`.
- Links:
  - https://docs.sentry.io/platforms/javascript/guides/nextjs/
  - https://docs.sentry.dev/platforms/javascript/guides/nextjs/configuration/integrations/nodeprofiling/
  - https://opentelemetry.io/docs/languages/js/getting-started/nodejs/

6. **Scheduled Scans via Platform Cron (Deploy-Friendly)**
- Why this matters (workshop): reliable cadence without process-level scheduler complexity.
- Easiest solution: **Vercel Cron Jobs** with secure secret.
- Fast implementation path:
  - Add `/api/cron/scan` route.
  - Configure cron in `vercel.json`.
  - Verify `CRON_SECRET` header before execution.
- Links:
  - https://vercel.com/docs/cron-jobs
  - https://vercel.com/docs/cron-jobs/manage-cron-jobs

7. **Trader-Grade Time Series Visuals**
- Why this matters (workshop): traders want precise market evolution, not only static snapshots.
- Easiest solution: **TradingView Lightweight Charts**.
- Fast implementation path:
  - Add candlestick/line chart to market detail.
  - Overlay Darwin estimate and divergence bands.
- Links:
  - https://tradingview.github.io/lightweight-charts/docs
  - https://github.com/tradingview/lightweight-charts

8. **High-Density Signal Grid for Fast Scanning**
- Why this matters (workshop): dense numeric display and quick prioritization are trader-critical.
- Easiest solution: **TanStack Table + TanStack Virtual**.
- Fast implementation path:
  - Replace ad-hoc cards with sortable/filterable table mode.
  - Virtualize rows for large watchlists.
- Links:
  - https://tanstack.com/table/docs
  - https://tanstack.com/virtual/v2/docs

9. **News Source Failover + Coverage Expansion**
- Why this matters (workshop): reduce single-provider fragility and improve confidence with multi-source corroboration.
- Easiest solution: keep Valyu + add **NewsAPI** and **GNews** fallback.
- Fast implementation path:
  - Provider chain: Valyu -> NewsAPI -> GNews.
  - Require >=2 independent sources for high confidence signals.
- Links:
  - https://newsapi.org/docs/endpoints/everything
  - https://docs.gnews.io/

10. **LLM Quality Guardrails (Regression Tests before Demo)**
- Why this matters (workshop): miscalibrated LLM estimates are a major risk.
- Easiest solution: **promptfoo (open source)** for deterministic eval suite; optional Langfuse later for online traces.
- Fast implementation path:
  - Add 20-30 benchmark markets + expected direction/confidence ranges.
  - Run eval matrix in CI before deployments.
- Links:
  - https://github.com/promptfoo/promptfoo
  - https://langfuse.com/

## Suggested Adoption Sequence for Hackathon
1. Kill switch + Unleash
2. Upstash lock/cache
3. Inngest or Vercel Cron (pick one path)
4. Sentry instrumentation
5. Lightweight Charts
6. News failover

## Why These Are Net-New vs Current Plan
- Current plan already includes: core agent loop, API routes, grid/detail UI, alpha bar, basic polling.
- The above items add missing trader-grade reliability and operational control highlighted by Susquehanna: **shutdown control, consistency, profiling, and execution robustness**.
