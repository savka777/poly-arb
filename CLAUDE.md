# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Darwin Capital — AI-powered prediction market alpha detection for HackEurope 2026.
Finds markets where news has moved reality but price hasn't caught up.

## Commands

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run build        # Production build (runs type checking)
npm run lint         # ESLint
npx tsc --noEmit     # Type check without emitting
npm run test:pipeline  # Run agent pipeline test (npx tsx scripts/test-pipeline.ts)
```

No test framework (jest/vitest) is configured. Validation scripts live in `scripts/` and `src/test/validate.ts`.

## Architecture

```
Polymarket APIs → SQLite (markets) → Orchestrator → Event Pod Agent → Signals → SQLite → API Routes → React Query → UI
```

### Data layer

- **Polymarket Gamma API** (`src/data/polymarket.ts`): market discovery, event browsing, price history. Uses CLOB API for order book data.
- **Valyu API** (`src/data/valyu.ts`): news search via `POST /v1/deepsearch`. Auth via `x-api-key` header.
- **Market sync** (`src/data/market-sync.ts`): bulk-syncs Polymarket markets into SQLite. Full sync on startup, incremental on interval.
- **RSS feeds** (`src/data/feeds.ts`): 50+ feeds for breaking news detection.

### Agent pipeline (LangGraph)

The Event Pod is a `StateGraph` defined in `src/agent/graph.ts` with four nodes:

```
START → fetchNews → estimateProbability → calculateDivergence → generateSignal → END
```

Conditional edges exit early when there's no news or divergence isn't tradeable. State type is `EventPodStateType` from `src/agent/state.ts`. Entry point: `runEventPod(market)` returns `{ signal, reasoning, toolCalls }`.

### Orchestrator (`src/scanner/orchestrator.ts`)

Event-driven scheduler with a priority queue and worker pool. Four watchers enqueue markets for analysis:

- **Price watcher**: detects price movements above threshold
- **News watcher**: keyword-matches Valyu news to markets
- **RSS watcher**: matches RSS articles to markets using LLM (`src/intelligence/market-matcher.ts`)
- **Time watcher**: flags markets approaching expiry

Workers dequeue by priority, run `runEventPod()`, and apply cooldowns. Orchestrator starts when `/api/health` is first hit.

### EV calculation (`src/intelligence/calculations.ts`)

Logit-space probability construction: `logit(pHat) = logit(pMarket) + W_NEWS * zNews + W_TIME * zTime`. Net EV = pHat - pMarket - costs. A signal is `tradeable` when lower-bound EV (halved shift) is positive after costs.

### Storage

SQLite via Drizzle ORM (`better-sqlite3`). Database file: `darwin.db` (gitignored). Schema in `src/db/schema.ts` (tables: `signals`, `markets`, `watchlist`). DB auto-creates tables and runs migrations on first access (`src/db/index.ts`). In-memory stores for `activity-log`, `news-events`, and `watchlist` in `src/store/`.

### API routes (`src/app/api/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check + starts orchestrator on first call |
| `/api/markets` | GET | Paginated market list from SQLite |
| `/api/markets/[id]` | GET | Market detail + signals + order book |
| `/api/signals` | GET | All signals from SQLite |
| `/api/analyze` | POST | On-demand `runEventPod()` with rate limiting |
| `/api/activity` | GET | Activity log entries |
| `/api/news-events` | GET | News-market match events |
| `/api/prices` | GET | Price history from CLOB API |
| `/api/watchlist` | GET/POST/DELETE | Watchlist CRUD |

### Frontend

Next.js App Router. Pages: home (`/`), market detail (`/markets/[id]`), compare (`/compare`). React Query hooks in `src/hooks/` poll API routes. Tailwind CSS dark theme. Charts use `lightweight-charts` and `recharts`.

## Coding Standards

### Error handling

Every fallible function returns `Result<T>`:
```typescript
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
```
Use `ok()`, `err()`, `isOk()` from `src/lib/result.ts`. Never throw. Wrap external calls in try/catch inside the wrapper and return `err()`.

### LLM calls

All LLM calls go through `tracedGenerateObject()` from `src/lib/braintrust.ts` with the model from `src/lib/model.ts`. This enables optional Braintrust tracing when `BRAINTRUST_API_KEY` is set. Never import `generateObject` directly from `ai`.

The model uses Vertex AI: `@ai-sdk/google-vertex/anthropic` (the `/anthropic` sub-module is required for Claude; the main module is for Gemini).

### TypeScript

- `strict: true`, no `any` types
- Functions + interfaces only, no classes for data/tools
- Named exports only, no default exports
- Path alias: `@/*` maps to `./src/*`
- Config from `process.env` via `src/lib/config.ts`, never hardcoded

### Lazy initialization pattern

Both `model` and `db` use a Proxy-based lazy init pattern — they only initialize on first property access, not at import time. This prevents Vertex AI / SQLite connections from being created during build or in modules that don't need them.

## Environment

Copy `.env.example` to `.env`. Key variables:

- `GOOGLE_CLOUD_PROJECT` / `VERTEX_REGION`: Vertex AI for Claude access
- `VALYU_API_KEY`: news search API (required for agent pipeline)
- `BRAINTRUST_API_KEY`: optional LLM tracing
- `USE_MOCK_DATA`: set `true` to skip live APIs

See `.env.example` for full list including orchestrator tuning, market filters, EV weights, and cooldown timers.

## Dev Log Protocol

**Read `docs/dev_log.md` before starting work. Update it after every meaningful push.** This is how sessions coordinate. Format: timestamp, what changed, decisions, known issues, next up.

## Known Dead Code

- `src/scanner/index.ts`, `src/scanner/news-monitor.ts`: superseded by orchestrator, kept as reference
- `config.anthropicApiKey`, `config.evThreshold`: defined but unused
- `MOCK_SIGNALS`, `MOCK_TOOL_CALLS` in `src/lib/mock-data.ts`: not imported
