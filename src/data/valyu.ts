/**
 * Valyu Research API wrapper.
 *
 * Endpoint: POST /v1/deepsearch
 * Auth: x-api-key header
 *
 * All functions return Result<T> and never throw.
 * Rate-limit backoff: 4 attempts at 0s / 1s / 2s / 4s.
 */

import { ok, err } from '../lib/result';
import type { Result, NewsResult } from '../lib/types';
import { config } from '../lib/config';
import { getMockNewsResults } from './mock';

// ─── Raw API types ────────────────────────────────────────────────────────────

interface ValyuSearchRequest {
  query: string;
  search_type: 'all' | 'proprietary' | 'web' | 'academic';
  max_num_results?: number;
  max_price?: number;
}

interface ValyuRawResult {
  title?: string;
  url?: string;
  content?: string;
  source?: string;
  relevance_score?: number;
  [key: string]: unknown;
}

interface ValyuSearchResponse {
  success: boolean;
  error?: string;
  tx_id?: string;
  query?: string;
  results?: ValyuRawResult[];
}

// ─── Backoff helper ───────────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [0, 1000, 2000, 4000];

async function fetchWithBackoff(
  url: string,
  init: RequestInit,
): Promise<Response> {
  let lastError: Error = new Error('Unknown fetch error');

  for (let attempt = 0; attempt < BACKOFF_DELAYS_MS.length; attempt++) {
    if (BACKOFF_DELAYS_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[attempt]));
    }

    try {
      const res = await fetch(url, init);

      // Retry on 429 or 5xx
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`);
        continue;
      }

      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError;
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeResult(raw: ValyuRawResult): NewsResult {
  return {
    title: raw.title ?? 'Untitled',
    url: raw.url ?? '',
    content: raw.content ?? '',
    source: raw.source ?? (raw.url ? new URL(raw.url).hostname : 'unknown'),
    relevanceScore: raw.relevance_score ?? 0,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for recent news relevant to a prediction market question.
 * Returns Result<NewsResult[]> for direct use by agent nodes.
 */
export async function searchNews(
  query: string,
  maxResults = 5,
  searchType: ValyuSearchRequest['search_type'] = 'all',
): Promise<Result<NewsResult[]>> {
  if (config.useMockData) {
    return ok(getMockNewsResults(query));
  }

  if (!query.trim()) {
    return err('searchNews: query must not be empty');
  }

  const url = `${config.valyu.baseUrl}/deepsearch`;

  const body: ValyuSearchRequest = {
    query,
    search_type: searchType,
    max_num_results: maxResults,
  };

  try {
    const res = await fetchWithBackoff(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.valyuApiKey,
        'User-Agent': 'darwin-capital/1.0',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = await res.text(); } catch { /* ignore */ }
      return err(`Valyu /deepsearch HTTP ${res.status}: ${detail.slice(0, 200)}`);
    }

    const raw = (await res.json()) as ValyuSearchResponse;

    if (!raw.success) {
      return err(`Valyu search failed: ${raw.error ?? 'unknown error'}`);
    }

    const results = (raw.results ?? []).map(normalizeResult);

    return ok(results);
  } catch (e) {
    return err(`searchNews failed: ${String(e)}`);
  }
}

/**
 * Search for news using web-only results.
 */
export async function searchWebNews(
  query: string,
  maxResults = 5,
): Promise<Result<NewsResult[]>> {
  return searchNews(query, maxResults, 'web');
}

/**
 * Build a focused search query from a market question.
 * Strips common prediction-market phrasing and extracts the core topic.
 */
export function buildNewsQuery(marketQuestion: string): string {
  return marketQuestion
    .replace(/^Will\s+/i, '')
    .replace(/\s+before\s+\w+\??\s*$/i, '')
    .replace(/\s+by\s+\w+\??\s*$/i, '')
    .replace(/\?+$/, '')
    .trim();
}
