# Darwin Capital — CLAUDE.md

> HackEurope 2026. AI-powered prediction market alpha detection.
> Mission: Find markets where news has moved reality but price hasn't caught up.

---

## Stack

- **Framework:** Next.js 14+ (App Router — unified frontend + API)
- **LLM:** Vercel AI SDK via `src/lib/model.ts` — model-agnostic, provider set by `AI_MODEL` env var
- **Agent loops:** Vercel AI SDK tool-use (`generateText` with tools, max 10 iterations)
- **Data:** Polymarket (Gamma API for discovery, CLOB for prices)
- **Research:** Valyu API (news context for agents)
- **Storage:** In-memory (`Map<string, Signal>`)
- **Frontend:** React Query (polling), Tailwind CSS (dark theme)

**Explicitly NOT used:** Kalshi, SQLite, Express, LangGraph, any external orchestration library.

---

## Architecture at a Glance

```
Polymarket → fetchMarkets() → Agent (News-Lag) → Signals → Store → API Routes → React Query → UI
```

See `docs/ARCHITECTURE.md` for full system diagram and data flow.

---

## Core Concept: Event Pod Agent

The single most important abstraction. An agent = LLM + mandate (system prompt) + tools.

The agent factory takes an `AgentConfig`, builds a system prompt, calls Vercel AI SDK
`generateText` with tool definitions, handles the tool-call loop (max 10 iterations),
and returns an `AgentOutput` containing trade proposals.

```typescript
interface AgentConfig {
  name: string        // "event-analyst"
  mandate: string     // system prompt defining agent behavior
  tools: ToolDefinition<unknown, unknown>[]
}
```

The Event Pod agent detects news-to-price lag: markets where recent news should have
shifted probability but the market price hasn't adjusted yet.

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
anywhere else. The model is determined by `AI_MODEL` env var. Swap providers by
changing one env var — zero code changes.

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
| `AI_MODEL` | Vercel AI SDK model string | `anthropic/claude-opus-4-6` |
| `ANTHROPIC_API_KEY` | Anthropic API access | — |
| `VALYU_API_KEY` | Valyu research API | — |
| `NEXT_PUBLIC_POLL_INTERVAL_MS` | React Query polling interval | `30000` |
| `CYCLE_INTERVAL_MS` | Background scan interval | `300000` |
| `EV_THRESHOLD` | Minimum |EV| to generate a signal | `0.05` |

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
├── tailwind.config.js
├── docs/
│   ├── ARCHITECTURE.md
│   ├── agents.md
│   ├── apis.md
│   ├── backlog.md
│   ├── dev_log.md
│   └── uiux.md
├── src/
│   ├── app/                              # Next.js App Router
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
│   │   ├── types.ts                      # Result<T>, Market, Signal, Direction, TradeProposal
│   │   ├── result.ts                     # ok(), err(), isOk()
│   │   ├── model.ts                      # Vercel AI SDK callLLM
│   │   └── config.ts                     # env loading with defaults
│   ├── data/
│   │   ├── polymarket.ts                 # Gamma + CLOB API wrapper
│   │   └── valyu.ts                      # Valyu research API wrapper
│   ├── agent/
│   │   ├── types.ts                      # AgentConfig, AgentContext, AgentOutput
│   │   ├── create-agent.ts               # factory: AgentConfig → callable agent
│   │   └── execute.ts                    # tool-use loop (generateText)
│   ├── tools/
│   │   ├── shared.ts                     # fetchMarkets, calculateEV
│   │   └── event-pod.ts                  # fetchRecentNews, estimateEventProbability, etc.
│   ├── store/
│   │   └── memory.ts                     # In-memory Map<string, Signal>
│   ├── intelligence/
│   │   └── calculations.ts              # EV calculation
│   ├── components/
│   │   ├── market-card.tsx               # Market card for grid
│   │   ├── alpha-bar.tsx                 # Divergence visualization
│   │   ├── analysis-feed.tsx             # Signal + tool call timeline
│   │   ├── query-interface.tsx           # On-demand analysis input
│   │   └── signal-badge.tsx              # Confidence badge
│   └── hooks/
│       ├── use-markets.ts                # React Query: markets polling
│       ├── use-signals.ts                # React Query: signals polling
│       └── use-analysis.ts               # React Query: analyze mutation
└── public/
```
