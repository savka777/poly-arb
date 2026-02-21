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

  /** EV calculation weights (logit-space feature combination) */
  ev: {
    wNews: envFloat("W_NEWS", 0.4),
    wTime: envFloat("W_TIME", 0.3),
  },

  /** Orchestrator tuning */
  orchestrator: {
    workerCount: envInt("ORCHESTRATOR_WORKERS", 3),
    maxQueueSize: envInt("ORCHESTRATOR_MAX_QUEUE", 200),
    /** Price change threshold to trigger re-analysis */
    priceChangeThreshold: envFloat("PRICE_CHANGE_THRESHOLD", 0.02),
    /** Price watcher polling interval (ms) */
    priceWatchIntervalMs: envInt("PRICE_WATCH_INTERVAL_MS", 30_000),
    /** News watcher polling interval (ms) */
    newsWatchIntervalMs: envInt("NEWS_WATCH_INTERVAL_MS", 60_000),
    /** Time watcher check interval (ms) */
    timeWatchIntervalMs: envInt("TIME_WATCH_INTERVAL_MS", 300_000),
    /** Cooldowns after analysis (ms) */
    cooldown: {
      signalFound: envInt("COOLDOWN_SIGNAL_FOUND_MS", 5 * 60_000),
      newsNoSignal: envInt("COOLDOWN_NEWS_NO_SIGNAL_MS", 30 * 60_000),
      noNews: envInt("COOLDOWN_NO_NEWS_MS", 2 * 60 * 60_000),
      error: envInt("COOLDOWN_ERROR_MS", 2 * 60_000),
    },
  },

  /** Scanner tuning (legacy — used by orchestrator for market fetching) */
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
    excludeTags: env("MARKET_EXCLUDE_TAGS",
      "Sports,NBA,NFL,Soccer,Basketball,Hockey,NHL,Tennis,Baseball,MLB,Cricket,MMA,UFC,Boxing,Esports,F1,Golf,Games"
    ).split(",").map(s => s.trim()).filter(Boolean),
  },

  /** Strategy selection — which strategies to run */
  strategies: {
    enabled: env("ENABLED_STRATEGIES", "ev")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },

  /** Market sync — full Polymarket sync to SQLite */
  sync: {
    concurrency: envInt("SYNC_CONCURRENCY", 5),
    fullSyncPages: envInt("SYNC_FULL_PAGES", 200),
    incrementalPages: envInt("SYNC_INCREMENTAL_PAGES", 10),
    intervalMs: envInt("SYNC_INTERVAL_MS", 300_000),
  },

  /** RSS feed monitoring — polls 50+ feeds for breaking news */
  rss: {
    intervalMs: envInt("RSS_INTERVAL_MS", 30_000),
    concurrency: envInt("RSS_CONCURRENCY", 8),
  },

  /** News monitor — Valyu deep search (legacy, supplements RSS) */
  newsMonitor: {
    intervalMs: envInt("NEWS_MONITOR_INTERVAL_MS", 30_000),
    queries: env("NEWS_MONITOR_QUERIES", "breaking news today,latest world events,financial markets news")
      .split(",").map((s) => s.trim()).filter(Boolean),
    maxArticlesPerPoll: envInt("NEWS_MONITOR_MAX_ARTICLES_PER_POLL", 10),
  },

  /** Rate limiting */
  rateLimit: {
    maxConcurrentAnalyses: envInt("MAX_CONCURRENT_ANALYSES", 3),
    maxAnalysesPerMinute: envInt("MAX_ANALYSES_PER_MINUTE", 5),
  },
}
