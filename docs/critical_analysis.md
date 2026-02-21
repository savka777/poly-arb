# Darwin Capital — Critical Analysis

> HackEurope 2026 · Judges: Susquehanna International Group

---

## Strengths

- **workshop_analysis.md** already maps SIG's own workshop lessons against the architecture — most teams never do this. Fix what's in there and you've pre-empted the judges' critique.
- **Concept maps to SIG's worldview** — SIG computes a "theo" and trades divergences. Darwin does the same thing with LLM reasoning as the edge. Say this explicitly in the pitch.
- **Alpha bar** is immediately legible without explanation. Judges get it in 3 seconds.
- **Scope is right** — one platform, one strategy, one agent. Focused enough to actually finish.
- **Clean code standards** — Result<T>, single LLM entry point, strict TypeScript. Source code will look professional.

---

## Critical Weaknesses

| # | Problem | Risk Level |
|---|---------|------------|
| 1 | `estimateEventProbability` is an LLM call with no calibration data — can't answer "what's your hit rate?" | **Critical** |
| 2 | workshop_analysis.md identified kill switch, overlap, stale news, no multi-source — none fixed | **High** |
| 3 | No historical evidence that news-to-price lag exists at detectable scale | **High** |
| 4 | Valyu samples show articles days/weeks old — may not be fresher than market price | **High** |
| 5 | Sprint 1 incomplete (no package.json, no agent layer) — Sprints 2 & 3 blocked | **High** |

---

## Improvements Ranked by Impact / Effort

### Do First
1. **Find 5-10 resolved historical markets** where price moved after news. Measure the lag in minutes. Opens with empirical thesis, not theory.
2. **Fix setInterval overlap guard** — one boolean flag. Prevents the most likely live demo crash.
3. **Hard cap markets per scan cycle** at 20. Prevents runaway scans collapsing the demo.

### Do Second
4. **Cross-platform divergence signal** — pull the same market from Manifold or Metaculus. If prices differ >5%, flag it. LLM-free, structurally rigorous alpha. SIG will respect it immediately.
5. **Show exact numbers everywhere** — EV to 3 decimal places, latency in ms, scan timestamp. Quant judges notice precision.

### Do If Time Allows
6. **Add calibration caveat in UI** — "Darwin confidence: 73% (calibration: early stage)." Shows you understand calibration without claiming data you don't have.

---

## The Real Risk

**Time.** 40+ backlog tasks remain. Sprint 1 (agent layer) must finish before UI can start.

Minimum viable demo: **one market → one agent run → one signal with visible reasoning.** That is the floor. Ship that first, polish second.

---

## SIG Pitch Framing

Don't say: *"autonomous alpha detector."*

Say: *"information asymmetry surface — we identify markets where news has moved reality but price hasn't caught up, and quantify the window for human review."*

Honest, defensible, and exactly how a quant firm thinks about edge.
