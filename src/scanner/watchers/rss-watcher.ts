/**
 * RSS Watcher — polls 50+ RSS feeds every 30s for breaking news.
 *
 * Phase 1: Detect headlines (cheap, fast, parallel)
 *   - Fetch all feeds with concurrency limit
 *   - Normalize to common article shape
 *   - Dedupe by URL + title hash
 *   - Match new articles against full market index (SQLite)
 *
 * Phase 2 happens downstream: matched (article, market) pairs get
 * enqueued into the orchestrator for Valyu research + LLM analysis.
 */

import RssParser from 'rss-parser';
import { FEEDS, type FeedSource } from '@/data/feeds';
import { logActivity } from '@/store/activity-log';
import { config } from '@/lib/config';
import type { Market, NewsResult } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RssArticle {
  title: string
  url: string
  content: string
  source: string
  category: string
  publishedAt: string | null
}

export interface RssMatch {
  market: Market
  article: NewsResult
  keywordOverlap: number
}

// ─── State ───────────────────────────────────────────────────────────────────

interface RssWatcherState {
  running: boolean
  lastPollAt: string | null
  intervalHandle: ReturnType<typeof setInterval> | null
  totalArticlesSeen: number
  totalMatches: number
}

const state: RssWatcherState = {
  running: false,
  lastPollAt: null,
  intervalHandle: null,
  totalArticlesSeen: 0,
  totalMatches: 0,
};

const MAX_SEEN = 5000;
const seenKeys = new Set<string>();

export type RssMatchCallback = (matches: RssMatch[]) => void;

let onMatchCallback: RssMatchCallback | null = null;
let activeMarkets: Market[] = [];

// ─── RSS Parser ──────────────────────────────────────────────────────────────

const parser = new RssParser({
  timeout: 10_000,
  headers: {
    'User-Agent': 'darwin-capital/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml, */*',
  },
  maxRedirects: 3,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dedupeKey(url: string, title: string): string {
  // Prefer URL for dedup (unique), fall back to title hash
  if (url) return url.toLowerCase().split('?')[0];
  return title.toLowerCase().slice(0, 120);
}

function isRecent(pubDate: string | null, maxAgeHours: number): boolean {
  if (!pubDate) return true; // if no date, assume it's new
  const published = new Date(pubDate).getTime();
  if (isNaN(published)) return true;
  const ageMs = Date.now() - published;
  return ageMs < maxAgeHours * 60 * 60 * 1000;
}

// ─── Keyword Matching (same logic as news-watcher) ───────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
  'not', 'no', 'nor', 'so', 'yet', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just',
  'about', 'up', 'out', 'if', 'then', 'that', 'this', 'these', 'those',
  'it', 'its', 'he', 'she', 'they', 'we', 'you', 'what', 'which',
  'who', 'when', 'where', 'why', 'how', 'all', 'any', 'new', 'says',
  'said', 'also', 'over', 'per', 'get', 'like', 'back', 'one', 'two',
  'three', 'year', 'years', 'first', 'last', 'next', 'now', 'day',
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function stripMarketQuestion(question: string): string {
  return question
    .replace(/^Will\s+/i, '')
    .replace(/\s+before\s+\w+\??\s*$/i, '')
    .replace(/\s+by\s+(end\s+of\s+)?\w+\s*\d*\??\s*$/i, '')
    .replace(/\?+$/, '')
    .trim();
}

function matchArticleToMarkets(
  article: RssArticle,
  markets: Market[],
): RssMatch[] {
  const text = `${article.title} ${article.content.slice(0, 500)}`;
  const articleKeywords = extractKeywords(text);
  if (articleKeywords.size === 0) return [];

  const matches: RssMatch[] = [];

  for (const market of markets) {
    const marketKeywords = extractKeywords(stripMarketQuestion(market.question));
    if (marketKeywords.size === 0) continue;

    let overlap = 0;
    for (const word of marketKeywords) {
      if (articleKeywords.has(word)) overlap++;
    }

    const overlapRatio = overlap / marketKeywords.size;

    // Require 30%+ overlap AND at least 2 matching words
    if (overlapRatio >= 0.3 && overlap >= 2) {
      const newsResult: NewsResult = {
        title: article.title,
        url: article.url,
        content: article.content,
        source: article.source,
        relevanceScore: overlapRatio,
      };
      matches.push({ market, article: newsResult, keywordOverlap: overlapRatio });
    }
  }

  // Top matches only
  matches.sort((a, b) => b.keywordOverlap - a.keywordOverlap);
  return matches.slice(0, 10);
}

// ─── Feed Fetching ───────────────────────────────────────────────────────────

interface FeedResult {
  ok: boolean
  articles: RssArticle[]
}

async function fetchFeed(feed: FeedSource): Promise<FeedResult> {
  try {
    const result = await parser.parseURL(feed.url);
    const articles: RssArticle[] = [];

    for (const item of result.items ?? []) {
      const title = (item.title ?? '').trim();
      if (!title) continue;

      // Skip articles older than 6 hours
      const pubDate = item.pubDate ?? item.isoDate ?? null;
      if (!isRecent(pubDate, 6)) continue;

      const url = (item.link ?? '').trim();
      const key = dedupeKey(url, title);

      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      // Evict oldest keys if over limit
      if (seenKeys.size > MAX_SEEN) {
        const first = seenKeys.values().next().value;
        if (first !== undefined) seenKeys.delete(first);
      }

      articles.push({
        title,
        url,
        content: item.contentSnippet ?? item.content ?? item.summary ?? '',
        source: feed.name,
        category: feed.category,
        publishedAt: pubDate,
      });
    }

    return { ok: true, articles };
  } catch {
    // Silently skip broken feeds — some will 403, timeout, etc.
    return { ok: false, articles: [] };
  }
}

async function pollAllFeeds(): Promise<void> {
  const concurrency = config.rss?.concurrency ?? 8;
  const feeds = FEEDS;

  const allArticles: RssArticle[] = [];
  let feedsOk = 0;
  let feedsFailed = 0;

  // Process feeds in batches
  for (let i = 0; i < feeds.length; i += concurrency) {
    const batch = feeds.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((f) => fetchFeed(f)));

    for (const result of results) {
      if (result.ok) {
        feedsOk++;
        allArticles.push(...result.articles);
      } else {
        feedsFailed++;
      }
    }
  }

  state.lastPollAt = new Date().toISOString();
  state.totalArticlesSeen += allArticles.length;

  if (allArticles.length === 0) {
    logActivity('news-watcher', 'info',
      `RSS poll: ${feedsOk} feeds OK, ${feedsFailed} failed, 0 new articles`);
    return;
  }

  // Match against full market index
  const allMatches: RssMatch[] = [];
  for (const article of allArticles) {
    const matches = matchArticleToMarkets(article, activeMarkets);
    allMatches.push(...matches);
  }

  state.totalMatches += allMatches.length;

  if (allMatches.length > 0) {
    // Dedupe matches by market ID — keep highest overlap per market
    const bestByMarket = new Map<string, RssMatch>();
    for (const match of allMatches) {
      const existing = bestByMarket.get(match.market.id);
      if (!existing || match.keywordOverlap > existing.keywordOverlap) {
        bestByMarket.set(match.market.id, match);
      }
    }
    const deduped = Array.from(bestByMarket.values());

    logActivity('news-watcher', 'info',
      `RSS: ${allArticles.length} new articles from ${feedsOk} feeds → ${deduped.length} market matches`,
      {
        articles: allArticles.length,
        feeds: feedsOk,
        matches: deduped.length,
        topMatch: deduped[0] ? `${deduped[0].article.title.slice(0, 60)} → ${deduped[0].market.question.slice(0, 40)}` : undefined,
      });

    onMatchCallback?.(deduped);
  } else {
    logActivity('news-watcher', 'info',
      `RSS: ${allArticles.length} new articles from ${feedsOk} feeds, 0 market matches`);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function updateRssActiveMarkets(markets: Market[]): void {
  activeMarkets = markets;
}

export function startRssWatcher(callback: RssMatchCallback): void {
  if (state.running) return;

  state.running = true;
  onMatchCallback = callback;

  const intervalMs = config.rss?.intervalMs ?? 30_000;

  logActivity('news-watcher', 'info',
    `RSS watcher starting: ${FEEDS.length} feeds, polling every ${intervalMs / 1000}s`);

  // First poll after 3s
  setTimeout(() => {
    pollAllFeeds().catch((e) =>
      logActivity('news-watcher', 'error', `RSS poll error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, 3_000);

  state.intervalHandle = setInterval(() => {
    pollAllFeeds().catch((e) =>
      logActivity('news-watcher', 'error', `RSS poll error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, intervalMs);
}

export function stopRssWatcher(): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  onMatchCallback = null;
  logActivity('news-watcher', 'info', 'RSS watcher stopped');
}

export function getRssWatcherStatus(): {
  running: boolean
  lastPollAt: string | null
  feedCount: number
  totalArticlesSeen: number
  totalMatches: number
} {
  return {
    running: state.running,
    lastPollAt: state.lastPollAt,
    feedCount: FEEDS.length,
    totalArticlesSeen: state.totalArticlesSeen,
    totalMatches: state.totalMatches,
  };
}
