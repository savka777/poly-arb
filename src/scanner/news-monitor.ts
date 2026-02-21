import { nanoid } from 'nanoid';
import { searchNews } from '@/data/valyu';
import { fetchTrendingMarkets } from '@/data/polymarket';
import { runEventPod } from '@/agent/graph';
import { matchNewsToMarkets } from '@/intelligence/market-matcher';
import { addNewsEvent } from '@/store/news-events';
import { config } from '@/lib/config';
import type { Market, NewsMonitorStatus, NewsEvent, NewsResult } from '@/lib/types';

// ─── State ───────────────────────────────────────────────────────────────────

interface NewsMonitorState {
  running: boolean;
  lastPollAt: string | null;
  articlesProcessed: number;
  signalsGenerated: number;
  intervalHandle: ReturnType<typeof setInterval> | null;
  queryIndex: number;
}

const state: NewsMonitorState = {
  running: false,
  lastPollAt: null,
  articlesProcessed: 0,
  signalsGenerated: 0,
  intervalHandle: null,
  queryIndex: 0,
};

// ─── Dedup ───────────────────────────────────────────────────────────────────

const MAX_SEEN = 500;
const seen = new Set<string>();

function dedupeKey(title: string): string {
  return title.toLowerCase().slice(0, 100);
}

function addSeen(key: string): void {
  seen.add(key);
  if (seen.size > MAX_SEEN) {
    const first = seen.values().next().value;
    if (first !== undefined) seen.delete(first);
  }
}

// ─── Market cache ────────────────────────────────────────────────────────────

let cachedMarkets: Market[] = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000;

async function getActiveMarkets(): Promise<Market[]> {
  if (Date.now() - cacheTimestamp < CACHE_TTL_MS && cachedMarkets.length > 0) {
    return cachedMarkets;
  }

  const result = await fetchTrendingMarkets({ limit: 100, pages: 3 });
  if (!result.ok) {
    console.error('[news-monitor] Failed to fetch markets:', result.error);
    return cachedMarkets;
  }

  cachedMarkets = result.data;
  cacheTimestamp = Date.now();
  return cachedMarkets;
}

// ─── Poll cycle ──────────────────────────────────────────────────────────────

async function runPollCycle(): Promise<void> {
  const queries = config.newsMonitor.queries;
  if (queries.length === 0) return;

  const query = queries[state.queryIndex % queries.length];
  state.queryIndex++;

  console.log(`[news-monitor] Polling: "${query}"...`);

  const newsResult = await searchNews(query, config.newsMonitor.maxArticlesPerPoll);
  if (!newsResult.ok) {
    console.error('[news-monitor] News fetch failed:', newsResult.error);
    return;
  }

  const articles = newsResult.data;

  // Deduplicate
  const newArticles: NewsResult[] = [];
  let skipped = 0;
  for (const article of articles) {
    const key = dedupeKey(article.title);
    if (seen.has(key)) {
      skipped++;
      continue;
    }
    addSeen(key);
    newArticles.push(article);
  }

  if (newArticles.length === 0) {
    console.log(`[news-monitor] No new articles (${skipped} seen, skipped)`);
    state.lastPollAt = new Date().toISOString();
    return;
  }

  console.log(
    `[news-monitor] ${newArticles.length} new articles (${skipped} seen, skipped)`,
  );

  const markets = await getActiveMarkets();
  if (markets.length === 0) {
    console.log('[news-monitor] No active markets to match against');
    state.lastPollAt = new Date().toISOString();
    return;
  }

  for (const article of newArticles) {
    state.articlesProcessed++;

    const matches = await matchNewsToMarkets(article, markets);

    const signalIds: string[] = [];

    if (matches.length > 0) {
      console.log(
        `[news-monitor] "${article.title.slice(0, 60)}..." → matched ${matches.length} markets`,
      );

      for (const match of matches) {
        const market = markets.find((m) => m.id === match.marketId);
        if (!market) continue;

        try {
          const result = await runEventPod(market);
          if (result.signal) {
            signalIds.push(result.signal.id);
            state.signalsGenerated++;
            console.log(
              `[news-monitor] ✓ Signal for market ${market.id} (EV_net=${result.signal.ev.toFixed(3)})`,
            );
          }
        } catch (e) {
          console.error(
            `[news-monitor] ✗ Error running pod for ${market.id}:`,
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    }

    const event: NewsEvent = {
      id: nanoid(),
      article: {
        title: article.title,
        url: article.url ?? '',
        source: article.source,
        content: article.content.slice(0, 500),
      },
      matchedMarkets: matches.map((m) => ({
        marketId: m.marketId,
        question: markets.find((mk) => mk.id === m.marketId)?.question ?? '',
        relevance: m.relevance,
      })),
      signalsGenerated: signalIds,
      timestamp: new Date().toISOString(),
    };

    addNewsEvent(event);
  }

  state.lastPollAt = new Date().toISOString();
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startNewsMonitor(): void {
  if (state.running) return;

  state.running = true;
  console.log(
    `[news-monitor] Starting (interval: ${config.newsMonitor.intervalMs}ms, queries: ${config.newsMonitor.queries.length})`,
  );

  // First poll after short delay
  setTimeout(() => {
    runPollCycle().catch((e) =>
      console.error('[news-monitor] Poll cycle error:', e),
    );
  }, 5_000);

  // Recurring polls
  state.intervalHandle = setInterval(() => {
    runPollCycle().catch((e) =>
      console.error('[news-monitor] Poll cycle error:', e),
    );
  }, config.newsMonitor.intervalMs);
}

export function stopNewsMonitor(): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  console.log('[news-monitor] Stopped');
}

export function getNewsMonitorStatus(): NewsMonitorStatus {
  return {
    running: state.running,
    lastPollAt: state.lastPollAt,
    articlesProcessed: state.articlesProcessed,
    signalsGenerated: state.signalsGenerated,
  };
}
