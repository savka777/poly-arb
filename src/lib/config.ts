function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

function envInt(key: string, fallback: number): number {
  const val = process.env[key]
  if (!val) return fallback
  const parsed = parseInt(val, 10)
  return isNaN(parsed) ? fallback : parsed
}

function envFloat(key: string, fallback: number): number {
  const val = process.env[key]
  if (!val) return fallback
  const parsed = parseFloat(val)
  return isNaN(parsed) ? fallback : parsed
}

export const config = {
  aiModel: env("AI_MODEL", "anthropic/claude-opus-4-6"),
  anthropicApiKey: env("ANTHROPIC_API_KEY", ""),
  valyuApiKey: env("VALYU_API_KEY", ""),
  pollIntervalMs: envInt("NEXT_PUBLIC_POLL_INTERVAL_MS", 15_000),
  cycleIntervalMs: envInt("CYCLE_INTERVAL_MS", 60_000),
  evThreshold: envFloat("EV_THRESHOLD", 0.02),

  /** Scanner tuning */
  scanner: {
    concurrency: envInt("SCANNER_CONCURRENCY", 5),
    marketsPerCycle: envInt("SCANNER_MARKETS_PER_CYCLE", 50),
    /** Skip re-analyzing a market if we have a signal younger than this (ms) */
    signalTtlMs: envInt("SCANNER_SIGNAL_TTL_MS", 10 * 60 * 1000),
  },

  /** Market filters — controls which markets the scanner targets */
  marketFilters: {
    minLiquidity: envFloat("MARKET_MIN_LIQUIDITY", 0),
    minVolume: envFloat("MARKET_MIN_VOLUME", 0),
    minProbability: envFloat("MARKET_MIN_PROBABILITY", 0.05),
    maxProbability: envFloat("MARKET_MAX_PROBABILITY", 0.95),
  },

  /** Strategy selection — which strategies to run */
  strategies: {
    enabled: env("ENABLED_STRATEGIES", "ev")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
}
