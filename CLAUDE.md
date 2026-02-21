# Darwin Capital — CLAUDE.md

> HackEurope 2026. AI-powered prediction market alpha detection.
> Mission: Find markets where news has moved reality but price hasn't caught up.

---

## Stack

- **Framework:** Next.js 14+ (App Router — unified frontend + API)
- **LLM:** Vercel AI SDK + Vertex AI Anthropic provider (`@ai-sdk/google-vertex/anthropic`) — model: `claude-opus-4-5@20251101` via `src/lib/model.ts`
- **Agent orchestration:** LangGraph (`@langchain/langgraph`) StateGraph for structured, stateful agent workflows
- **Data:** Polymarket (Gamma API for discovery, CLOB for prices)
- **Research:** Valyu API (news context for agents)
- **Storage:** SQLite via Drizzle ORM (`better-sqlite3`) — persistent signals across restarts
- **Frontend:** React Query (polling), Tailwind CSS (dark theme)

**Explicitly NOT used:** Kalshi, Express, any separate backend server.

---

## Architecture at a Glance

```
Polymarket → fetchMarkets() → Agent (News-Lag) → Signals → Store → API Routes → React Query → UI
```

See `docs/ARCHITECTURE.md` for full system diagram and data flow.

---

## Core Concept: Event Pod Agent

The single most important abstraction. An agent = LLM + mandate (system prompt) + tools.

The Event Pod is implemented as a LangGraph StateGraph with four nodes:

```
START → fetchNews → estimateProbability → calculateDivergence → generateSignal → END
```

Conditional edges skip to END when there's no news or divergence is below threshold.

The agent detects news-to-price lag: markets where recent news should have
shifted probability but the market price hasn't adjusted yet. Signals are persisted
to SQLite so they survive server restarts.

See `docs/agents.md` for full mandate, tool definitions, and implementation patterns.

---

## Dev Log Protocol — MANDATORY

After every meaningful push, update `docs/dev_log.md` with a timestamped entry.
This is how session N+1 knows what session N did. Claude agents MUST do this.

Entry format:

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

**Read the latest entries in `docs/dev_log.md` before starting any work.**

---

## Sprint Protocol

Three sprints replace the old 6-phase waterfall. Each has a gate check.

### Sprint 1 — Foundation + Data + Agent (Hours 0-16)

Build the backend end-to-end: types, data wrappers, agent factory, event pod tools,
first Signal generated from a real Polymarket market.

**Gate:** Agent produces a valid `Signal` from a real market. `npx tsc --noEmit` passes.

### Sprint 2 — API Routes + UI (Hours 16-32)

API routes serving market/signal data. Market grid page with alpha bars.
Market detail page with analysis feed.

**Gate:** Grid renders real data. Detail page shows signal analysis.

### Sprint 3 — Hero Moment + Polish (Hours 32-48)

Query interface for on-demand analysis. Background scanner. Demo flow polish.
Loading states, interactions, presentation prep.

**Gate:** Full demo flow works: grid → click market → see analysis → trigger new analysis.

See `docs/backlog.md` for the full prioritized task checklist.

---

## Coding Standards

### Error Handling — Single Pattern

Every function that can fail returns `Result<T>`:

```typescript
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
```

Never throw. Never use try/catch at the call site. Wrap external calls in try/catch
inside the wrapper function and return `err(message)`.

### LLM Calls — Single Entry Point

ALL LLM calls go through `src/lib/model.ts`. No direct Anthropic/OpenAI SDK imports
anywhere else. The model uses Vertex AI (`@ai-sdk/google-vertex/anthropic`) — note the
`/anthropic` sub-module, which is required for Claude models (the main module is for Gemini).
Configured via `GOOGLE_CLOUD_PROJECT` and `VERTEX_REGION` env vars. Model: `claude-opus-4-5@20251101`.

### TypeScript Rules

- `strict: true` in tsconfig — no exceptions
- No `any` types — use `unknown` + type guards if needed
- No classes for data/tools — use functions + interfaces
- No hardcoded API keys — always from `process.env` via `src/lib/config.ts`
- Imports: use named exports, no default exports

---

## Environment Variables

See `.env.example` for the complete list:

| Variable | Purpose | Default |
|----------|---------|---------|
| `GOOGLE_CLOUD_PROJECT` | Vertex AI project ID | `gen-lang-client-0494134627` |
| `VERTEX_REGION` | Vertex AI region | `us-east5` |
| `VALYU_API_KEY` | Valyu research API | — |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | React Query polling interval | `30000` |
| `CYCLE_INTERVAL_MS` | Background scan interval | `300000` |
| `EV_THRESHOLD` | Minimum |EV| to generate a signal | `0.05` |
| `USE_MOCK_DATA` | Use mock data instead of live APIs | `false` |

---

## Doc References

| Document | What It Covers |
|----------|---------------|
| `docs/ARCHITECTURE.md` | System diagram, data flows, core types, EV formula, excluded scope |
| `docs/agents.md` | Agent architecture, event pod mandate, tool definitions, Signal type |
| `docs/apis.md` | External APIs (Polymarket, Valyu) + internal API routes |
| `docs/backlog.md` | Prioritized P0/P1/P2 checklist with sprint map |
| `docs/dev_log.md` | Team sync log — read before starting, write after every push |
| `docs/uiux.md` | Wireframes, design tokens, component specs, interactions |

---

## Target File Structure

```
poly-arb/
├── CLAUDE.md
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── drizzle.config.ts                     # Drizzle ORM config
├── darwin.db                             # SQLite database (gitignored)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── agents.md
│   ├── apis.md
│   ├── backlog.md
│   ├── dev_log.md
│   └── uiux.md
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout, dark theme, fonts
│   │   ├── page.tsx                      # Market grid page
│   │   ├── markets/
│   │   │   └── [id]/
│   │   │       └── page.tsx              # Market detail page
│   │   └── api/
│   │       ├── health/route.ts           # GET /api/health
│   │       ├── markets/
│   │       │   ├── route.ts              # GET /api/markets
│   │       │   └── [id]/route.ts         # GET /api/markets/[id]
│   │       ├── signals/route.ts          # GET /api/signals
│   │       └── analyze/route.ts          # POST /api/analyze
│   ├── lib/
│   │   ├── types.ts                      # Result<T>, Market, Signal, Direction, etc.
│   │   ├── result.ts                     # ok(), err(), isOk()
│   │   ├── model.ts                      # Vercel AI SDK + Vertex AI provider
│   │   └── config.ts                     # env loading with defaults
│   ├── db/
│   │   ├── schema.ts                     # Drizzle schema: signals, markets tables
│   │   ├── index.ts                      # Drizzle client (better-sqlite3)
│   │   └── seed.ts                       # Seed demo data for presentation
│   ├── data/
│   │   ├── polymarket.ts                 # Gamma + CLOB API wrapper
│   │   ├── valyu.ts                      # Valyu research API wrapper
│   │   └── mock.ts                       # Mock data providers
│   ├── agent/
│   │   ├── state.ts                      # LangGraph state type definition
│   │   ├── graph.ts                      # LangGraph StateGraph: Event Pod agent
│   │   ├── nodes.ts                      # Node functions (fetchNews, estimate, etc.)
│   │   └── tools.ts                      # Tool functions used by nodes
│   ├── store/
│   │   └── signals.ts                    # Signal CRUD — SQLite via Drizzle
│   ├── intelligence/
│   │   └── calculations.ts              # EV calculation, confidence mapping
│   ├── components/
│   │   ├── market-card.tsx
│   │   ├── alpha-bar.tsx
│   │   ├── analysis-feed.tsx
│   │   ├── query-interface.tsx
│   │   ├── signal-badge.tsx
│   │   └── query-provider.tsx
│   ├── hooks/
│   │   ├── use-markets.ts
│   │   ├── use-signals.ts
│   │   └── use-analysis.ts
│   └── test/
│       └── validate.ts                   # End-to-end validation script
├── scripts/
│   ├── validate.sh                       # Runner script for validation
│   └── test-agent.ts                     # Agent pipeline test (mock data + real LLM)
└── public/
```
