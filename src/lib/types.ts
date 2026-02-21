export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export type Direction = 'yes' | 'no';

export interface Market {
  id: string;
  platform: 'polymarket';
  question: string;
  probability: number;
  volume: number;
  liquidity: number;
  endDate: string;
  url: string;
  category?: string;
  lastUpdated: string;
}

export interface Signal {
  id: string;
  marketId: string;
  marketQuestion: string;
  darwinEstimate: number;
  marketPrice: number;
  ev: number;
  direction: Direction;
  reasoning: string;
  newsEvents: string[];
  confidence: 'low' | 'medium' | 'high';
  createdAt: string;
  expiresAt: string;
}

export interface TradeProposal {
  id: string;
  marketId: string;
  platform: 'polymarket';
  direction: Direction;
  confidence: number;
  estimatedProbability: number;
  marketProbability: number;
  ev: number;
  reasoning: string;
  timestamp: string;
}

export interface ToolCallRecord {
  name: string;
  input: unknown;
  output: unknown;
  timestamp: string;
}

export interface AgentOutput {
  proposals: TradeProposal[];
  reasoning: string;
  toolCalls: ToolCallRecord[];
}

export interface NewsResult {
  title: string;
  content: string;
  source: string;
  relevanceScore: number;
}

export interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
  lastScanAt: string | null;
  signalCount: number;
}

export interface MarketsResponse {
  markets: Market[];
  total: number;
  lastFetchedAt: string;
}

export interface MarketDetailResponse {
  market: Market;
  signals: Signal[];
}

export interface SignalsResponse {
  signals: Signal[];
  total: number;
}

export interface AnalyzeRequest {
  marketId: string;
}

export interface AnalyzeResponse {
  signal: Signal | null;
  reasoning: string;
  toolCalls: ToolCallRecord[];
}
