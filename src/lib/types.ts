export type Direction = "yes" | "no"

export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

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
}

export interface TradeProposal {
  id: string
  marketId: string
  platform: "polymarket"
  direction: Direction
  confidence: number
  estimatedProbability: number
  marketProbability: number
  ev: number
  reasoning: string
  timestamp: string
}

export interface ToolCallRecord {
  id: string
  toolName: string
  input: Record<string, unknown>
  output: Record<string, unknown>
  durationMs: number
  timestamp: string
}

export interface HealthResponse {
  status: "ok" | "error"
  uptime: number
  lastScanAt: string | null
  signalCount: number
}

export interface MarketsResponse {
  markets: Market[]
  total: number
  lastFetchedAt: string
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

export interface ApiError {
  error: string
  status: number
}
