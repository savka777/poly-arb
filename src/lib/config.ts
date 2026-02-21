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
  pollIntervalMs: envInt("NEXT_PUBLIC_POLL_INTERVAL_MS", 30_000),
  cycleIntervalMs: envInt("CYCLE_INTERVAL_MS", 300_000),
  evThreshold: envFloat("EV_THRESHOLD", 0.05),

  /** Market filters — controls which markets the scanner targets */
  marketFilters: {
    /** Minimum liquidity in USD */
    minLiquidity: envFloat("MARKET_MIN_LIQUIDITY", 0),
    /** Minimum total volume in USD */
    minVolume: envFloat("MARKET_MIN_VOLUME", 0),
    /** Skip near-impossible markets (probability below this threshold) */
    minProbability: envFloat("MARKET_MIN_PROBABILITY", 0.05),
    /** Skip near-certain markets (probability above this threshold) */
    maxProbability: envFloat("MARKET_MAX_PROBABILITY", 0.95),
  },

  /** Strategy selection — which strategies to run */
  strategies: {
    /** Enabled strategies, parsed from comma-separated env var */
    enabled: env("ENABLED_STRATEGIES", "ev")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
}
