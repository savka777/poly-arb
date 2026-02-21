# Darwin Capital × Susquehanna Workshop — Strategic Analysis

> **Context:** A Susquehanna SIG engineer delivered a workshop on high-performance trading system design,
> covering speed/reliability tradeoffs, data pipeline optimization, and human-machine interaction.
> This document maps those lessons directly to Darwin Capital's architecture and surfaces
> actionable precautions.

---

## TL;DR — Top 5 Alerts

| Priority | Issue | Darwin Component Affected |
|----------|-------|--------------------------|
| 🔴 CRITICAL | No kill switch / circuit breaker | Scan scheduler + agent loop |
| 🔴 CRITICAL | State resets on restart — no audit trail | In-memory store |
| 🟡 HIGH | LLM probability miscalibration — no human checkpoint | Event Pod agent |
| 🟡 HIGH | No rate-limit coordination across concurrent callers | Polymarket + Valyu wrappers |
| 🟢 MEDIUM | Full payload polling — no delta encoding | React Query + `/api/signals` |

---

## Part I — The Core Framework: Speed · Reliability · Simplicity

Susquehanna's central thesis: **you can optimise for at most two of the three attributes simultaneously.**

```
         SPEED
          /\
         /  \
        /    \
       /  ??? \
      /──────────\
SIMPLICITY    RELIABILITY
```

### How Darwin Capital's Components Map

| Component | Speed | Reliability | Simplicity | Sacrifice |
|-----------|-------|-------------|------------|-----------|
| Scan cycle (background scheduler) | Medium | High (Result<T> everywhere) | Low | Simplicity — multi-step pipeline is inherently complex |
| LLM agent loop (max 10 steps) | Low | High (Zod validation, retries) | Medium | Speed — LLM is the bottleneck |
| React Query polling | Medium | High | High | Speed — WebSocket dropped for simplicity |
| In-memory signal store | High | Low (resets on restart) | High | Reliability — explicit trade-off in ARCHITECTURE.md |
| `/api/analyze` on-demand | Low | Medium | High | Speed + Reliability — single LLM call, no fallback |

**Key insight from the workshop:** Susquehanna's kill switch prioritises **simplicity + reliability** above all else.
Darwin has no equivalent. This is the highest priority gap.

---

## Part II — Lesson-by-Lesson Breakdown

---

### Lesson 1 — The Kill Switch Problem

> *"Something that's gone wrong and we want to shut down all trading. What are we going to want here?
> Simple and very fast. We also need it to be reliable — we want to make sure it actually shuts it down."*

**What Susquehanna does:** A dedicated, dead-simple kill switch that bypasses all automation
and ensures positions are closed. Simplicity + reliability. No complexity.

**What Darwin Capital has:** Nothing. If the LLM agent enters a loop, starts producing
nonsensical signals, or the Polymarket API starts returning garbage data, there is
no way to halt the system short of killing the Node process.

**Precaution / Action:**
- Add a `KILL_SWITCH=false` env var checked at the top of every scan cycle and agent invocation
- Expose `POST /api/admin/stop` and `POST /api/admin/start` routes (no auth needed for MVP)
- Check the flag before each LangGraph node execution — if `true`, short-circuit immediately
- This takes 30 minutes to implement and could save the demo if something goes wrong

---

### Lesson 2 — The Snapshot Problem (State Consistency)

> *"Trying to process the snapshot is almost like trying to catch a train that's already left
> the station. By the time you fully process the snapshot, you then need to update your view
> with the live data happening in between."*

Susquehanna solves this with dual A/B feeds + client-side gap detection.

**What Darwin Capital has:** A single in-memory `Map<string, Signal>` with no versioning,
no sequence numbers, and state that **resets to zero on every server restart**.

**Specific risks:**

1. **Scan cycle race condition:** While the agent is running a full batch analysis (potentially
   minutes for many markets), the React Query UI is reading a partially-updated store.
   Some signals are stale, some are new, some belong to the current cycle, some to the last.
   The consumer has no way to distinguish.

2. **No restart recovery:** Every server restart wipes the signal history. There is no
   snapshot to restore from. The first scan cycle after restart is blind — the UI will
   show zero signals until the first cycle completes.

3. **No `lastUpdated` signal version on the store level** — only per-signal `createdAt`.

**Precautions:**
- Add a `scanCycleId` (UUID per cycle) to every `Signal` so the UI can tell which
  cycle a signal came from and detect when a new cycle begins
- Add `GET /api/health` to return `{ lastScanAt, currentScanCycleId, isScanning }` —
  already partially designed in the API reference
- For production: even a simple JSON file dump of signals on each cycle completion
  would allow restart recovery (a 10-minute addition)

---

### Lesson 3 — Profile Before You Optimise

> *"The first step was to identify the source of the lag. Profiling the application is
> invaluable to figure out exactly where the bottlenecks are."*

Susquehanna used flame graphs (HotSpot profiler) and found two bottlenecks:
1. The true price calculation
2. The broadcasting / publishing step

Darwin Capital's likely bottlenecks (predicted, not yet profiled):

| Bottleneck | Estimated Impact | Root Cause |
|-----------|-----------------|------------|
| LLM agent iteration (per market) | Very high — 3-15s per market | Network round-trip to Anthropic API |
| Polymarket Gamma API fetch | Medium — rate limited at 60 req/min | External API constraint |
| Valyu news fetch per signal | Medium — paid per query | Compound latency with LLM |
| React Query full-payload poll | Low currently, degrades at scale | No delta encoding |

**Precaution:** Before the hackathon demo, run a timing instrumentation pass:
```typescript
// Wrap every tool invocation in the agent loop
const start = performance.now()
const result = await tool.execute(input)
const elapsed = performance.now() - start
console.log(`[TOOL] ${tool.name} took ${elapsed.toFixed(0)}ms`)
```
This will immediately surface where the demo might freeze.

---

### Lesson 4 — Data Optimisation Cascade

Susquehanna's modelling app went from 120MB to 36MB payloads through three steps:
1. **Payload audit** — removed 80% of fields consumers didn't need
2. **Delta encoding** — only transmit changed values
3. **Binary serialisation** — Protocol Buffers instead of JSON

**Darwin Capital's equivalent analysis:**

#### Step 1: Payload Audit

The `Signal` type has 12 fields. The market grid card only needs:
`{ id, marketQuestion, ev, direction, confidence, marketPrice, darwinEstimate }` (7 fields).

The full `Signal` (including `reasoning`, `newsEvents[]`, `toolCalls[]`) is only needed
on the detail page. Currently `/api/signals` returns everything to everyone.

**Action:** Return a `SignalSummary` type from `GET /api/signals` and the full `Signal`
only from `GET /api/markets/[id]`. This halves grid page payload size.

#### Step 2: Delta Signals

React Query polls `/api/signals` every `NEXT_PUBLIC_POLL_INTERVAL_MS`. On each poll,
it downloads the full signal list even if nothing changed.

**Action:** Add `?since=<ISO8601>` query param support to `/api/signals`:
```
GET /api/signals?since=2026-02-21T10:00:00Z
→ returns only signals created or updated after that timestamp
```
The client tracks `lastFetched` and sends it on each poll. Empty arrays are tiny.

#### Step 3: Serialisation

JSON over HTTP is fine for a hackathon. Not a concern for MVP scale.

---

### Lesson 5 — Scaling from 10 to 3000

> *"The application was initially designed to process about 10 stocks. Over time, we decided
> to process 3,000 stocks. The application became very slow and lagging."*

**Darwin Capital's scaling exposure:**

The current design runs the Event Pod agent **serially per market** (implied by the
`generateText` loop + max 10 steps per market). If the category filter returns 50 markets:

```
50 markets × (avg 3 LLM steps × avg 2s per step) = ~300 seconds = 5 minutes per cycle
```

This matches the default `CYCLE_INTERVAL_MS = 5 min` — but just barely, and with no
room for API latency spikes.

**Specific alert:** If Polymarket returns more markets than expected (no explicit cap
visible in the backlog), the scan cycle will overrun its own interval, creating a
compounding lag problem.

**Precautions:**
1. Hard cap the market batch size: `MARKETS_PER_CYCLE=20` env var with a default
2. Process markets in parallel batches (Promise.allSettled with concurrency limit)
3. Skip markets already analyzed in the last N minutes (simple deduplication in the store)

---

### Lesson 6 — Human-in-the-Loop for Black Swan Events

> *"There are scenarios when we can't rely on automated trading strategies at all.
> For example, when there's a big news event or something unexpected happens.
> This can cause huge market moves, but it's not something we can clearly define in code."*

Susquehanna keeps human traders in the loop specifically for edge cases that code can't handle.

**Darwin Capital's exposure:** The Event Pod agent is fully autonomous. It:
1. Fetches news
2. Estimates probability (LLM sub-call)
3. Calculates divergence
4. Proposes a trade signal

There is **no human verification step** before a signal is surfaced to users.

**Specific risks:**
- LLM probability estimates are not calibrated. The mandate says *"a 70% estimate means
  you'd be wrong 30% of the time"* but there is no historical accuracy tracking to validate this.
- Breaking news (the exact black-swan scenario Susquehanna described) will cause Valyu
  to return fresh, unverified information. The agent will treat it as high-confidence signal.
- A signal with `confidence: 'high'` and a large EV may be entirely fabricated by the LLM
  based on a single misleading news article.

**Precautions:**
1. **Confidence floor gate:** Only surface `confidence: 'high'` signals when `|ev| > 0.10`
   (double the current threshold). High EV + high confidence = compelling; avoid low-evidence extremes.
2. **Timestamp recency gate in agent mandate:** Add to the Event Pod mandate:
   *"Prefer news from the last 48 hours. News older than 7 days should reduce your confidence rating."*
3. **Source count floor:** Require at least 2 distinct news sources before proposing a trade.
   A single-source high-EV signal is a red flag.
4. **Display disclaimer on UI:** Show `Darwin estimate — not financial advice` on every signal card.

---

### Lesson 7 — Choosing the Right Tool for the Job

> *"For writing software algorithms running at the exchange, we use C# or C++. For
> quant research, Python notebooks. FPGAs for the lowest latency path."*

Susquehanna uses different languages and runtimes for different concerns within the same system.

**Darwin Capital's stack audit:**

| Component | Current Stack | Assessment |
|-----------|---------------|------------|
| Data wrappers | TypeScript / fetch | Correct — typed, maintainable, fast enough |
| LLM agent loop | Vercel AI SDK `generateText` | Correct — model-agnostic, swappable |
| In-memory store | `Map<string, Signal>` | Correct for hackathon; SQLite needed for production |
| Frontend polling | React Query + REST | Correct given WebSocket exclusion |
| Background scanner | `setInterval` (implied) | Risk: `setInterval` doesn't prevent overlapping cycles |

**Specific alert — `setInterval` overlap:**
If the scan cycle takes longer than `CYCLE_INTERVAL_MS`, a new cycle will start while the
previous one is still running. This creates:
- Duplicate LLM API calls for the same markets
- Race conditions writing to the in-memory store
- Potential cost explosion

**Fix:** Use a self-scheduling pattern instead:
```typescript
async function runCycle() {
  if (isRunning) return  // guard
  isRunning = true
  try {
    await fullScanCycle()
  } finally {
    isRunning = false
    setTimeout(runCycle, CYCLE_INTERVAL_MS)  // schedule NEXT after CURRENT completes
  }
}
```

---

### Lesson 8 — Displaying Data That Matters Most

> *"We display data numerically rather than graphically because numerical precision is
> easy to see. Even a hundredth of a difference in a number can make a huge difference
> in a trading decision."*

Susquehanna's UI techniques: numerical display, colour coding, sound alerts, nested views, focus mode.

**Darwin Capital's UI design against these principles:**

| Susquehanna Technique | Darwin Capital Status |
|----------------------|----------------------|
| Numerical precision over graphs | Alpha bar is visual — needs exact numbers on hover (P1 backlog ✓) |
| Colour coding for direction | Signal badge (low/medium/high confidence) — good |
| Nested views (top-level → detail) | Market grid → detail page — well designed |
| Focus / attention drawing | Missing: no visual distinction for new signals vs seen signals |
| Sound alerts | P2 backlog — listed but deprioritised |

**Precaution for the demo:** The `alpha-bar` component visualises EV divergence.
Visually impressive, but for a judge with a trading background (likely at a Susquehanna
workshop), they will want to see the **exact numbers**: `Darwin: 72% · Market: 51% · EV: +21%`.
Ensure those numbers are prominently displayed alongside the visual bar, not just on hover.

---

## Part III — Synthesis: Darwin Capital's Priority Action List

Based on the Susquehanna workshop mapped against the current architecture:

### Before Demo — Must Fix

| # | Action | Effort | Risk if Skipped |
|---|--------|--------|-----------------|
| 1 | Add `isRunning` guard to prevent overlapping scan cycles | 30 min | Cost explosion, store corruption |
| 2 | Hard cap `MARKETS_PER_CYCLE` env var | 15 min | Demo freezes mid-presentation |
| 3 | Add timing logs around every tool call in agent loop | 30 min | Blind to where latency hits |
| 4 | Return `{ isScanning, lastScanAt }` from `/api/health` | 20 min | UI shows no scan progress |

### Before Demo — Should Fix

| # | Action | Effort | Risk if Skipped |
|---|--------|--------|-----------------|
| 5 | Require ≥2 news sources before `confidence: 'high'` | 1 hr | Misleading high-confidence signals |
| 6 | Add `scanCycleId` to Signal type | 30 min | UI can't detect stale vs fresh signals |
| 7 | Display exact EV numbers on market cards (not just alpha bar) | 1 hr | Loses credibility with trading judges |

### Post-Hackathon — Production Readiness

| # | Action | Rationale |
|---|--------|-----------|
| 8 | Kill switch endpoint (`POST /api/admin/stop`) | Susquehanna's #1 lesson |
| 9 | SQLite persistence + signal history | No restart recovery without it |
| 10 | Parallel market processing with concurrency limit | Scaling from 10 → 100+ markets |
| 11 | Delta encoding for signal polling | Bandwidth as signal volume grows |
| 12 | Calibration tracking: predicted EV vs actual resolution | Validates the model's edge |

---

## Part IV — The Deeper Alignment

What Susquehanna described and what Darwin Capital is building are philosophically aligned:

- **Susquehanna** computes a "theo" (theoretical fair price) and trades when market price
  diverges from theo. The trading decision is then "almost trivial."

- **Darwin Capital** computes `darwinEstimate` (LLM-estimated probability) and generates
  a signal when `|darwinEstimate - marketPrice| > EV_THRESHOLD`. Same structure, different inputs.

The Susquehanna system uses quantitative models. Darwin uses an LLM + news context.
The engineering challenges are identical:
1. How do you compute the theo fast enough?
2. How do you trust the theo is accurate?
3. How do you act on it reliably?

Darwin's edge — and its risk — is that the LLM can reason about unstructured, breaking news
in a way that quant models cannot. The **news-lag strategy** is legitimate alpha.
But the calibration problem (is the LLM's 70% actually 70%?) is Darwin's version of
Susquehanna's model validation problem, and it deserves the same engineering rigour.

---

*Generated: 2026-02-21 | Source: susquehanna_workshop.txt × Darwin Capital architecture docs*
