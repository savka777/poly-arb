import type { Result } from './result'

export type { Result }

export type Direction = 'yes' | 'no'

// ─── Raw API shapes ───────────────────────────────────────────────────────────

/** Raw market object from Polymarket Gamma API */
export interface GammaMarket {
  id: string
  question: string
  conditionId: string
  slug: string
  endDate: string
  liquidity: string          // decimal string e.g. "20975.77725"
  volume: string             // decimal string
  outcomes: string           // JSON-encoded string e.g. "[\"Yes\", \"No\"]"
  outcomePrices: string      // JSON-encoded string of string decimals e.g. "[\"0.022\", \"0.978\"]"
  clobTokenIds: string       // JSON-encoded string of token ID strings
  category?: string
  active: boolean
  closed: boolean
  updatedAt: string
}

/** Raw market object from Polymarket CLOB API */
export interface ClobMarket {
  condition_id: string
  question_id: string
  question: string
  market_slug: string
  end_date_iso: string
  active: boolean
  closed: boolean
  archived: boolean
  accepting_orders: boolean
  tokens: ClobToken[]
}

export interface ClobToken {
  token_id: string
  outcome: string   // "Yes" | "No" (or team names for sports)
  price: number     // 0-1
  winner: boolean
}

export interface ClobMarketsResponse {
  data: ClobMarket[]
  next_cursor?: string
}

export interface ClobOrderBook {
  market: string
  asset_id: string
  timestamp: string
  bids: Array<{ price: string; size: string }>
  asks: Array<{ price: string; size: string }>
}

// ─── Normalized domain types ──────────────────────────────────────────────────

/** Normalized market — the only market type used inside the app */
export interface Market {
  id: string              // Gamma numeric ID (e.g. "517310")
  conditionId: string     // CLOB condition_id (0x hex) — used for CLOB API calls
  tokenIds: [string, string]  // [YES token_id, NO token_id] — for CLOB price/book queries
  platform: 'polymarket'
  question: string
  probability: number     // 0-1, current YES price
  volume: number          // total volume in USD
  liquidity: number       // current liquidity in USD
  endDate: string         // ISO 8601
  url: string
  category?: string
  lastUpdated: string     // ISO 8601
}

export interface Signal {
  id: string
  marketId: string
  marketQuestion: string
  darwinEstimate: number        // agent's probability estimate (0-1)
  marketPrice: number           // market price at time of analysis (0-1)
  ev: number                    // darwinEstimate - marketPrice
  direction: Direction
  reasoning: string
  newsEvents: string[]
  confidence: 'low' | 'medium' | 'high'
  createdAt: string             // ISO 8601
  expiresAt: string             // ISO 8601 — market end date
}

export interface TradeProposal {
  id: string
  marketId: string
  platform: 'polymarket'
  direction: Direction
  confidence: number            // raw 0-1 confidence score
  estimatedProbability: number
  marketProbability: number
  ev: number
  reasoning: string
  timestamp: string
}

// ─── API response shapes (internal routes) ────────────────────────────────────

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

export interface HealthResponse {
  status: 'ok' | 'error'
  uptime: number
  lastScanAt: string | null
  signalCount: number
}

export interface ApiError {
  error: string
  status: number
}

// ─── Agent types ──────────────────────────────────────────────────────────────

export interface ToolCallRecord {
  tool: string
  input: unknown
  output: unknown
  durationMs: number
  timestamp: string
}
