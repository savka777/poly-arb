export type Direction = "yes" | "no"

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

export interface CostBreakdown {
  fee: number
  slippage: number
  latencyDecay: number
  resolutionRisk: number
  total: number
}

export interface EVResult {
  pHat: number
  pHatLB: number
  evGross: number
  evNet: number
  evNetLB: number
  direction: Direction
  costs: CostBreakdown
  features: { zNews: number; zTime: number }
  tradeable: boolean
}

export interface Market {
  id: string
  platform: "polymarket"
  question: string
  probability: number
  volume: number
  liquidity: number
  endDate: string
  url: string
  category?: string
  lastUpdated: string
  clobTokenId?: string
  spread?: number
  oneDayPriceChange?: number
  volume24hr?: number
  event?: { id: string; title: string }
}

export interface PolymarketEvent {
  id: string
  title: string
  slug: string
  volume24hr: number
  tags: string[]
  marketCount: number
}

export interface Signal {
  id: string
  marketId: string
  marketQuestion: string
  darwinEstimate: number
  marketPrice: number
  ev: number
  direction: Direction
  reasoning: string
  newsEvents: string[]
  confidence: "low" | "medium" | "high"
  createdAt: string
  expiresAt: string
  evNet?: number
  costs?: CostBreakdown
  features?: { zNews: number; zTime: number }
  tradeable?: boolean
  pHatLB?: number
  source?: "scanner" | "news-monitor"
  commitTxSignature?: string
  commitHash?: string
  revealTxSignature?: string
  commitSlot?: number
  marketPriceAtCommit?: number
}

export interface NewsResult {
  title: string
  url?: string
  content: string
  source: string
  relevanceScore: number
}

export interface ToolCallRecord {
  id?: string
  name: string
  toolName?: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  durationMs?: number
  timestamp: string
}

export interface ScannerStatus {
  running: boolean
  lastScanAt: string | null
  marketsScanned: number
  signalsGenerated: number
  nextScanAt: string | null
}

export interface NewsEvent {
  id: string
  article: { title: string; url: string; source: string; content: string }
  matchedMarkets: Array<{ marketId: string; question: string; relevance: string }>
  signalsGenerated: string[]
  timestamp: string
}

export interface NewsMonitorStatus {
  running: boolean
  lastPollAt: string | null
  articlesProcessed: number
  signalsGenerated: number
}

export interface OrchestratorStatus {
  running: boolean
  queueSize: number
  activeWorkers: number
  totalAnalyzed: number
  totalSignals: number
  watchers: {
    price: { running: boolean; trackedMarkets: number }
    news: { running: boolean; lastPollAt: string | null }
    time: { running: boolean; trackedMarkets: number }
  }
  rss?: {
    running: boolean
    feedCount: number
    lastPollAt: string | null
    totalArticlesSeen: number
    totalMatches: number
  }
}

export interface HealthResponse {
  status: "ok" | "error"
  uptime: number
  lastScanAt: string | null
  signalCount: number
  scanner: ScannerStatus
  orchestrator?: OrchestratorStatus
  newsMonitor?: NewsMonitorStatus
}

export interface MarketsResponse {
  markets: Market[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  lastFetchedAt: string
}

export type ActivitySource = 'orchestrator' | 'price-watcher' | 'news-watcher' | 'time-watcher' | 'analyze' | 'sync'
export type ActivityLevel = 'info' | 'warn' | 'error'

export interface ActivityEntry {
  id: string
  timestamp: string
  source: ActivitySource
  level: ActivityLevel
  message: string
  details?: Record<string, unknown>
}

export interface ActivityResponse {
  entries: ActivityEntry[]
  total: number
}

export interface SyncStatus {
  lastSyncAt: string | null
  totalMarkets: number
  syncInProgress: boolean
}

export interface MarketDetailResponse {
  market: Market
  orderBook?: {
    bids: Array<{ price: number; size: number }>
    asks: Array<{ price: number; size: number }>
  }
  signals: Signal[]
}

export interface SignalsResponse {
  signals: Signal[]
  total: number
}

export interface AnalyzeRequest {
  marketId: string
}

export interface AnalyzeResponse {
  signal: Signal | null
  reasoning: string
  toolCalls: ToolCallRecord[]
}

export interface LiveMarketData {
  tokenId: string
  price: number
  bestBid: number | null
  bestAsk: number | null
  spread: number | null
  lastTradePrice: number | null
  lastTradeSize: number | null
  lastTradeSide: string | null
  updatedAt: number
}

export interface LiveUpdate {
  type: 'price_change' | 'last_trade_price' | 'best_bid_ask' | 'book'
  tokenId: string
  data: LiveMarketData
  timestamp: number
}

export interface ApiError {
  error: string
  status: number
}
