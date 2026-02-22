import { searchNews, buildNewsQuery } from '@/data/valyu';
import { logActivity } from '@/store/activity-log';
import { hasSeenArticle, markArticleSeen, loadSeenKeys, pruneSeenArticles } from '@/store/seen-articles';
import { config } from '@/lib/config';
import type { Market, NewsResult } from '@/lib/types';

export interface NewsMatch {
  market: Market;
  article: NewsResult;
  keywordOverlap: number;
}

interface NewsWatcherState {
  running: boolean;
  lastPollAt: string | null;
  queryIndex: number;
  seenTitles: Set<string>;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

// In-memory cache backed by SQLite — survives restarts
let seenTitlesCache: Set<string> | null = null;

function getSeenTitles(): Set<string> {
  if (!seenTitlesCache) {
    seenTitlesCache = loadSeenKeys('news');
  }
  return seenTitlesCache;
}

const state: NewsWatcherState = {
  running: false,
  lastPollAt: null,
  queryIndex: 0,
  seenTitles: new Set(), // kept for interface compat, but not used for dedup
  intervalHandle: null,
};

export type NewsMatchCallback = (matches: NewsMatch[]) => void;

let onMatchCallback: NewsMatchCallback | null = null;
let activeMarkets: Market[] = [];

function dedupeKey(title: string): string {
  return title.toLowerCase().slice(0, 100);
}

function extractKeywords(text: string): Set<string> {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'not', 'no', 'nor', 'so', 'yet', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just',
    'about', 'up', 'out', 'if', 'then', 'that', 'this', 'these', 'those',
    'it', 'its', 'he', 'she', 'they', 'we', 'you', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'any', 'new',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w)),
  );
}

function matchArticleToMarkets(
  article: NewsResult,
  markets: Market[],
): NewsMatch[] {
  const articleKeywords = extractKeywords(`${article.title} ${article.content.slice(0, 300)}`);
  if (articleKeywords.size === 0) return [];

  const matches: NewsMatch[] = [];

  for (const market of markets) {
    const marketKeywords = extractKeywords(buildNewsQuery(market.question));
    if (marketKeywords.size === 0) continue;

    let overlap = 0;
    for (const word of marketKeywords) {
      if (articleKeywords.has(word)) overlap++;
    }

    const overlapRatio = overlap / marketKeywords.size;

    // Require at least 30% keyword overlap
    if (overlapRatio >= 0.3 && overlap >= 2) {
      matches.push({ market, article, keywordOverlap: overlapRatio });
    }
  }

  // Sort by overlap descending
  matches.sort((a, b) => b.keywordOverlap - a.keywordOverlap);

  return matches;
}

async function pollNews(): Promise<void> {
  const queries = config.newsMonitor.queries;
  if (queries.length === 0) return;

  const query = queries[state.queryIndex % queries.length];
  state.queryIndex++;

  const newsResult = await searchNews(query, config.newsMonitor.maxArticlesPerPoll);
  if (!newsResult.ok) {
    logActivity('news-watcher', 'error', `Fetch failed: ${newsResult.error}`);
    return;
  }

  // Deduplicate
  const newArticles: NewsResult[] = [];
  const seen = getSeenTitles();
  for (const article of newsResult.data) {
    const key = dedupeKey(article.title);
    if (seen.has(key)) continue;
    if (hasSeenArticle(key, 'news')) {
      seen.add(key);
      continue;
    }

    seen.add(key);
    markArticleSeen(key, 'news');
    newArticles.push(article);
  }

  if (newArticles.length === 0) {
    state.lastPollAt = new Date().toISOString();
    logActivity('news-watcher', 'info', `Polled "${query}" — no new articles`);
    return;
  }

  // Keyword-based matching (no LLM)
  const allMatches: NewsMatch[] = [];
  for (const article of newArticles) {
    const matches = matchArticleToMarkets(article, activeMarkets);
    allMatches.push(...matches);
  }

  if (allMatches.length > 0) {
    logActivity(
      'news-watcher',
      'info',
      `${newArticles.length} new articles → ${allMatches.length} market matches`,
      { query, articles: newArticles.length, matches: allMatches.length },
    );
    onMatchCallback?.(allMatches);
  } else {
    logActivity(
      'news-watcher',
      'info',
      `${newArticles.length} new articles, 0 market matches (matching against ${activeMarkets.length} markets)`,
    );
  }

  state.lastPollAt = new Date().toISOString();
}

export function updateActiveMarkets(markets: Market[]): void {
  activeMarkets = markets;
}

export function startNewsWatcher(callback: NewsMatchCallback): void {
  if (state.running) return;

  state.running = true;
  onMatchCallback = callback;

  // Load persisted seen keys + prune old entries
  const loaded = getSeenTitles();
  const pruned = pruneSeenArticles();
  logActivity(
    'news-watcher',
    'info',
    `Starting (interval: ${config.orchestrator.newsWatchIntervalMs}ms, ${loaded.size} seen articles loaded${pruned > 0 ? `, ${pruned} old pruned` : ''})`,
  );

  // Initial poll after short delay
  setTimeout(() => {
    pollNews().catch((e) =>
      logActivity('news-watcher', 'error', `Poll error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, 4_000);

  state.intervalHandle = setInterval(() => {
    pollNews().catch((e) =>
      logActivity('news-watcher', 'error', `Poll error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, config.orchestrator.newsWatchIntervalMs);
}

export function stopNewsWatcher(): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  onMatchCallback = null;
  logActivity('news-watcher', 'info', 'Stopped');
}

export function getNewsWatcherStatus(): {
  running: boolean;
  lastPollAt: string | null;
} {
  return {
    running: state.running,
    lastPollAt: state.lastPollAt,
  };
}
