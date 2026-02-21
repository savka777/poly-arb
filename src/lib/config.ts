export const config = {
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT || '',
  vertexRegion: process.env.VERTEX_REGION || 'global',
  valyuApiKey: process.env.VALYU_API_KEY || '',
  pollIntervalMs: parseInt(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '30000', 10),
  cycleIntervalMs: parseInt(process.env.CYCLE_INTERVAL_MS || '300000', 10),
  evThreshold: parseFloat(process.env.EV_THRESHOLD || '0.05'),
  useMockData: process.env.USE_MOCK_DATA === 'true',
} as const;
