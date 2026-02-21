import { type Result, type NewsResult } from '@/lib/types';
import { ok, err } from '@/lib/result';
import { config } from '@/lib/config';
import { getMockNewsResults } from './mock';

const VALYU_API_BASE = 'https://api.valyu.network/v1';

const MAX_ATTEMPTS = 4;
const BACKOFF_DELAYS = [0, 1000, 2000, 4000];

interface ValyuSearchResponse {
  results: Array<{
    title: string;
    content: string;
    source: string;
    relevance_score: number;
  }>;
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
    }
  }

  throw lastError ?? new Error('fetchWithRetry exhausted all attempts');
}

export async function searchNews(
  query: string,
  maxResults?: number,
): Promise<Result<NewsResult[]>> {
  if (config.useMockData) {
    return ok(getMockNewsResults(query));
  }

  try {
    const url = `${VALYU_API_BASE}/search`;

    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.valyuApiKey,
      },
      body: JSON.stringify({
        query,
        search_type: 'all',
        max_num_results: maxResults ?? 5,
      }),
    });

    const data = (await response.json()) as ValyuSearchResponse;

    const results: NewsResult[] = data.results.map((r) => ({
      title: r.title,
      content: r.content,
      source: r.source,
      relevanceScore: r.relevance_score,
    }));

    return ok(results);
  } catch (e) {
    return err(`Failed to search news: ${e instanceof Error ? e.message : String(e)}`);
  }
}
