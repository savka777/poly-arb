/**
 * Valyu Research API wrapper.
 *
 * Endpoint: POST /v1/deepsearch
 * Auth: x-api-key header
 *
 * Used by the Event Pod agent to fetch recent news relevant to a
 * prediction market question before estimating probability.
 *
 * All functions return Result<T> and never throw.
 * Rate-limit backoff: 4 attempts at 0s / 1s / 2s / 4s.
 */

import { ok, err } from '../lib/result'
import type { Result } from '../lib/types'
import { config } from '../lib/config'

// ─── Raw API types ────────────────────────────────────────────────────────────

interface ValyuSearchRequest {
  query: string
  search_type: 'all' | 'proprietary' | 'web' | 'academic'
  max_num_results?: number
  max_price?: number
}

interface ValyuRawResult {
  title?: string
  url?: string
  content?: string
  source?: string
  relevance_score?: number
  [key: string]: unknown
}

interface ValyuSearchResponse {
  success: boolean
  error?: string
  tx_id?: string
  query?: string
  results?: ValyuRawResult[]
}

// ─── Normalized types ─────────────────────────────────────────────────────────

export interface NewsResult {
  title: string
  url: string
  content: string
  source: string
  relevanceScore: number
}

export interface NewsSearchResult {
  results: NewsResult[]
  query: string
  totalFound: number
}

// ─── Backoff helper ───────────────────────────────────────────────────────────

const BACKOFF_DELAYS_MS = [0, 1000, 2000, 4000]

async function fetchWithBackoff(
  url: string,
  init: RequestInit
): Promise<Response> {
  let lastError: Error = new Error('Unknown fetch error')

  for (let attempt = 0; attempt < BACKOFF_DELAYS_MS.length; attempt++) {
    if (BACKOFF_DELAYS_MS[attempt] > 0) {
      await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[attempt]))
    }

    try {
      const res = await fetch(url, init)

      // Retry on 429 or 5xx
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }

      return res
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
    }
  }

  throw lastError
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalizeResult(raw: ValyuRawResult): NewsResult {
  return {
    title: raw.title ?? 'Untitled',
    url: raw.url ?? '',
    content: raw.content ?? '',
    source: raw.source ?? (raw.url ? new URL(raw.url).hostname : 'unknown'),
    relevanceScore: raw.relevance_score ?? 0,
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Search for recent news relevant to a prediction market question.
 *
 * @param query       Search query — typically the market question or key terms
 * @param maxResults  Maximum number of results to return (default 5)
 * @param searchType  Valyu search type (default 'all' for broadest coverage)
 */
export async function searchNews(
  query: string,
  maxResults = 5,
  searchType: ValyuSearchRequest['search_type'] = 'all'
): Promise<Result<NewsSearchResult>> {
  if (!query.trim()) {
    return err('searchNews: query must not be empty')
  }

  const url = `${config.valyu.baseUrl}/deepsearch`

  const body: ValyuSearchRequest = {
    query,
    search_type: searchType,
    max_num_results: maxResults,
  }

  try {
    const res = await fetchWithBackoff(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.valyuApiKey,
        'User-Agent': 'darwin-capital/1.0',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      // Try to parse the error body for a better message
      let body = ''
      try { body = await res.text() } catch { /* ignore */ }
      let detail = body.slice(0, 200)
      try { detail = (JSON.parse(body) as { message?: string; error?: string }).message ?? detail } catch { /* ignore */ }
      return err(`Valyu /deepsearch HTTP ${res.status}: ${detail}`)
    }

    const raw = (await res.json()) as ValyuSearchResponse

    if (!raw.success) {
      return err(`Valyu search failed: ${raw.error ?? 'unknown error'}`)
    }

    const results = (raw.results ?? []).map(normalizeResult)

    return ok({
      results,
      query: raw.query ?? query,
      totalFound: results.length,
    })
  } catch (e) {
    return err(`searchNews failed: ${String(e)}`)
  }
}

/**
 * Search for news using web-only results.
 * Useful when you want fresh web content rather than Valyu's proprietary sources.
 */
export async function searchWebNews(
  query: string,
  maxResults = 5
): Promise<Result<NewsSearchResult>> {
  return searchNews(query, maxResults, 'web')
}

/**
 * Build a focused search query from a market question.
 * Strips common prediction-market phrasing and extracts the core topic.
 *
 * e.g. "Will Trump be impeached before 2027?" → "Trump impeachment 2027"
 */
export function buildNewsQuery(marketQuestion: string): string {
  return marketQuestion
    .replace(/^Will\s+/i, '')
    .replace(/\s+before\s+\w+\??\s*$/i, '')
    .replace(/\s+by\s+\w+\??\s*$/i, '')
    .replace(/\?+$/, '')
    .trim()
}
