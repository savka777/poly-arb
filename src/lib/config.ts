function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing required environment variable: ${key}`)
  return val
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback
}

export const config = {
  aiModel: optionalEnv('AI_MODEL', 'anthropic/claude-opus-4-6'),

  anthropicApiKey: optionalEnv('ANTHROPIC_API_KEY', ''),

  valyuApiKey: requireEnv('VALYU_API_KEY'),

  /** Minimum |EV| required to surface a signal */
  evThreshold: parseFloat(optionalEnv('EV_THRESHOLD', '0.05')),

  /** Background scan interval in ms */
  cycleIntervalMs: parseInt(optionalEnv('CYCLE_INTERVAL_MS', '300000'), 10),

  /** React Query polling interval (exposed to client) */
  pollIntervalMs: parseInt(
    optionalEnv('NEXT_PUBLIC_POLL_INTERVAL_MS', '30000'),
    10
  ),

  /** Maximum markets to analyze per scan cycle */
  marketsPerCycle: parseInt(optionalEnv('MARKETS_PER_CYCLE', '20'), 10),

  polymarket: {
    gammaBaseUrl: 'https://gamma-api.polymarket.com',
    clobBaseUrl: 'https://clob.polymarket.com',
  },

  valyu: {
    baseUrl: 'https://api.valyu.network/v1',
  },
} as const
