# Darwin Capital — Agent System

> How the LLM agent works, what tools it has, and how to extend it.

---

## Agent Architecture

```
                    ┌─────────────────────┐
                    │    AgentConfig       │
                    │  name + mandate      │
                    │  + tools[]           │
                    └─────────┬───────────┘
                              ▼
                    ┌─────────────────────┐
                    │  Build System Prompt │
                    │  mandate + tool      │
                    │  descriptions        │
                    └─────────┬───────────┘
                              ▼
              ┌───────────────────────────────┐
              │                               │
              │   generateText(model, {       │◄──── Vercel AI SDK
              │     system: prompt,           │
              │     tools: toolDefs,          │
              │     maxSteps: 10              │
              │   })                          │
              │                               │
              └───────────┬───────────────────┘
                          │
                ┌─────────▼──────────┐
                │  Tool call?        │
                │                    │
                │  YES → execute     │──► tool function runs
                │    tool, feed      │◄── result fed back to LLM
                │    result back     │
                │                    │
                │  NO → done         │──► collect final output
                └────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    AgentOutput        │
              │  proposals[]          │
              │  reasoning            │
              │  toolCalls[]          │
              └───────────────────────┘
```

---

## AgentConfig Interface

```typescript
interface AgentConfig {
  name: string        // e.g. "event-analyst"
  mandate: string     // system prompt: what this agent does, how it thinks
  tools: ToolDefinition<unknown, unknown>[]  // tools available to this agent
}
```

| Field | Purpose |
|-------|---------|
| `name` | Identifier for logging and signal attribution |
| `mandate` | Full system prompt. Defines the agent's role, goals, and decision process |
| `tools` | Array of tool definitions the agent can invoke during its loop |

---

## Event Pod Mandate

This is the system prompt given to the Event Pod agent. It defines the agent's entire behavior.

```
You are a prediction market analyst specializing in detecting news-to-price lag.

Your goal: Find markets where recent news has moved reality but the market price
hasn't caught up yet.

Process:
1. Use fetchRecentNews to find recent news relevant to the market question
2. Use estimateEventProbability to form your own probability estimate based on the news
3. Use calculatePriceDivergence to compare your estimate against the market price
4. If the divergence exceeds the threshold, propose a trade with your reasoning

Rules:
- Always cite specific news events in your reasoning
- Be calibrated: a 70% estimate means you'd be wrong 30% of the time
- Consider the market's end date — news impact decays as resolution approaches
- If you can't find relevant recent news, do NOT propose a trade
- Prefer high-confidence signals over many low-confidence ones
```

---

## Tool Definitions

### Shared Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `fetchMarkets` | `{ category?: string, limit?: number }` | `Market[]` | Fetch normalized markets from Polymarket |
| `calculateEV` | `{ estimatedProbability: number, marketPrice: number }` | `{ ev: number, direction: Direction }` | Expected value calculation |

### Event Pod Tools

| Tool | Input | Output | Description |
|------|-------|--------|-------------|
| `fetchRecentNews` | `{ query: string, maxResults?: number }` | `{ results: NewsResult[] }` | Valyu API — recent news for a query |
| `estimateEventProbability` | `{ question: string, newsContext: string }` | `{ probability: number, reasoning: string, confidence: string, keyFactors: string[] }` | LLM sub-call to estimate probability |
| `calculatePriceDivergence` | `{ estimatedProbability: number, marketPrice: number }` | `{ divergence: number, direction: Direction, significant: boolean }` | Gap between estimate and market |
| `assessEventTimeline` | `{ endDate: string }` | `{ daysRemaining: number, urgency: string }` | Time until resolution |

---

## Tool Implementation Pattern

Every tool follows this canonical pattern:

```typescript
import { z } from 'zod'
import { type Result, ok, err } from '../lib/result'

// 1. Zod schema for input validation
const fetchRecentNewsInput = z.object({
  query: z.string().describe('Search query for recent news'),
  maxResults: z.number().optional().default(5),
})

type FetchRecentNewsInput = z.infer<typeof fetchRecentNewsInput>

// 2. Output type
interface NewsResult {
  title: string
  content: string
  source: string
  relevanceScore: number
}

// 3. Execute function returning Result<T>
async function executeFetchRecentNews(
  input: FetchRecentNewsInput
): Promise<Result<{ results: NewsResult[] }>> {
  try {
    const response = await searchValyu(input.query, input.maxResults)
    if (!response.ok) return response
    return ok({ results: response.data.results })
  } catch (e) {
    return err(`fetchRecentNews failed: ${String(e)}`)
  }
}

// 4. Tool definition for agent registration
export const fetchRecentNewsTool: ToolDefinition<FetchRecentNewsInput, { results: NewsResult[] }> = {
  name: 'fetchRecentNews',
  description: 'Search for recent news articles relevant to a prediction market question',
  parameters: fetchRecentNewsInput,
  execute: executeFetchRecentNews,
}
```

---

## `estimateEventProbability` — Deep Dive

This is the critical tool. It makes an LLM sub-call to estimate the probability of a market question resolving YES, given recent news context.

### Prompt Construction

```
Given the following prediction market question and recent news, estimate the
probability that this question resolves YES.

Question: {question}

Recent News:
{newsContext}

Respond with:
- probability: a number between 0 and 1
- reasoning: 2-3 sentences explaining your estimate
- confidence: "low", "medium", or "high"
- keyFactors: array of 2-4 key factors influencing your estimate
```

### Response Validation (Zod)

```typescript
const probabilityEstimateSchema = z.object({
  probability: z.number().min(0).max(1),
  reasoning: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  keyFactors: z.array(z.string()).min(1).max(5),
})
```

### Retry Logic

- If LLM response fails Zod validation → retry up to 2 times with stricter prompt
- If all retries fail → return `err('Failed to get valid probability estimate')`
- Uses `src/lib/model.ts` — same entry point as the agent itself

---

## Signal Type

The agent produces `TradeProposal`s, which are mapped to `Signal` objects for the store and UI:

```typescript
interface Signal {
  id: string
  marketId: string
  marketQuestion: string
  darwinEstimate: number     // agent's probability estimate
  marketPrice: number        // current market price
  ev: number                 // darwinEstimate - marketPrice
  direction: Direction       // 'yes' | 'no'
  reasoning: string          // agent's explanation
  newsEvents: string[]       // cited news sources
  confidence: 'low' | 'medium' | 'high'
  createdAt: string          // ISO 8601
  expiresAt: string          // ISO 8601
}
```

### Mapping: `TradeProposal` -> `Signal`

```typescript
function proposalToSignal(proposal: TradeProposal, market: Market): Signal {
  return {
    id: generateId(),
    marketId: market.id,
    marketQuestion: market.question,
    darwinEstimate: proposal.estimatedProbability,
    marketPrice: proposal.marketProbability,
    ev: proposal.ev,
    direction: proposal.direction,
    reasoning: proposal.reasoning,
    newsEvents: [],  // extracted from tool call records
    confidence: evToConfidence(proposal.ev),
    createdAt: new Date().toISOString(),
    expiresAt: market.endDate,
  }
}
```

---

## Future Extensions

These are NOT in scope for the hackathon but documented for future reference:

- **Arbitrage Pod** — cross-platform price discrepancy detection (needs Kalshi integration)
- **Time-Series Pod** — time-decay anomaly detection near market expiry
- **Multi-agent debate** — multiple agents analyze the same market, consensus vote
- **Persistent storage** — SQLite or Postgres for signal history and PnL tracking
- **Self-improving prompts** — agent mandates that evolve based on past accuracy
- **Risk manager** — algorithmic checks on position size, drawdown, concentration
