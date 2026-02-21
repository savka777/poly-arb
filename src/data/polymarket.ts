import { type Result, type Market } from '@/lib/types';
import { ok, err } from '@/lib/result';
import { config } from '@/lib/config';
import { getMockMarkets, getMockMarketDetail } from './mock';

const GAMMA_API_BASE = 'https://gamma-api.polymarket.com';
const CLOB_API_BASE = 'https://clob.polymarket.com';

const MAX_ATTEMPTS = 4;
const BACKOFF_DELAYS = [0, 1000, 2000, 4000];

interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  endDate: string;
  liquidity: number;
  volume: number;
  outcomePrices: string; // JSON-encoded: "[0.65, 0.35]"
  outcomes: string;
  category: string;
  active: boolean;
}

function gammaToMarket(gamma: GammaMarket): Market {
  const prices = JSON.parse(gamma.outcomePrices) as number[];
  return {
    id: gamma.id,
    platform: 'polymarket',
    question: gamma.question,
    probability: prices[0],
    volume: gamma.volume,
    liquidity: gamma.liquidity,
    endDate: gamma.endDate,
    url: `https://polymarket.com/event/${gamma.slug}`,
    category: gamma.category,
    lastUpdated: new Date().toISOString(),
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(BACKOFF_DELAYS[attempt]);
    }

    try {
      const response = await fetch(url, init);

      if (response.ok) {
        return response;
      }

      if (!isRetryableStatus(response.status) || attempt === MAX_ATTEMPTS - 1) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      if (attempt === MAX_ATTEMPTS - 1) {
        throw lastError;
      }

      // Only retry on network errors or retryable status codes
      // If it's a non-retryable HTTP error, it was already thrown above
    }
  }

  throw lastError ?? new Error('fetchWithRetry exhausted all attempts');
}

export async function fetchMarkets(
  category?: string,
  limit?: number,
): Promise<Result<Market[]>> {
  if (config.useMockData) {
    const mocks = getMockMarkets();
    const filtered = category
      ? mocks.filter((m) => m.category === category)
      : mocks;
    return ok(limit ? filtered.slice(0, limit) : filtered);
  }

  try {
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (limit) params.set('limit', String(limit));
    params.set('active', 'true');
    params.set('closed', 'false');

    const queryString = params.toString();
    const url = `${GAMMA_API_BASE}/markets${queryString ? `?${queryString}` : ''}`;

    const response = await fetchWithRetry(url);
    const data = (await response.json()) as GammaMarket[];

    const markets = data
      .filter((g) => g.active && g.outcomePrices)
      .map(gammaToMarket);

    return ok(markets);
  } catch (e) {
    return err(`Failed to fetch markets: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export async function fetchMarketDetail(id: string): Promise<Result<Market>> {
  if (config.useMockData) {
    const mock = getMockMarketDetail(id);
    if (!mock) {
      return err(`Mock market not found: ${id}`);
    }
    return ok(mock);
  }

  try {
    const url = `${CLOB_API_BASE}/markets/${id}`;
    const response = await fetchWithRetry(url);
    const data = (await response.json()) as GammaMarket;

    if (!data.outcomePrices) {
      return err(`Market ${id} has no outcome prices`);
    }

    return ok(gammaToMarket(data));
  } catch (e) {
    return err(`Failed to fetch market detail: ${e instanceof Error ? e.message : String(e)}`);
  }
}
