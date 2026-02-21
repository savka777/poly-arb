function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  // Vertex AI (Google Cloud) — for Claude access
  googleCloudProject: optionalEnv('GOOGLE_CLOUD_PROJECT', ''),
  vertexRegion: optionalEnv('VERTEX_REGION', 'us-east5'),

  // Valyu — don't throw if missing when using mock data
  valyuApiKey: optionalEnv('VALYU_API_KEY', ''),

  /** Minimum |EV| required to surface a signal */
  evThreshold: parseFloat(optionalEnv('EV_THRESHOLD', '0.05')),

  /** Background scan interval in ms */
  cycleIntervalMs: parseInt(optionalEnv('CYCLE_INTERVAL_MS', '300000'), 10),

  /** React Query polling interval (exposed to client) */
  pollIntervalMs: parseInt(
    optionalEnv('NEXT_PUBLIC_POLL_INTERVAL_MS', '30000'),
    10,
  ),

  /** Maximum markets to analyze per scan cycle */
  marketsPerCycle: parseInt(optionalEnv('MARKETS_PER_CYCLE', '20'), 10),

  /** Use mock data instead of live APIs */
  useMockData: process.env.USE_MOCK_DATA === 'true',

  polymarket: {
    gammaBaseUrl: 'https://gamma-api.polymarket.com',
    clobBaseUrl: 'https://clob.polymarket.com',
  },

  valyu: {
    baseUrl: 'https://api.valyu.network/v1',
  },
} as const;
