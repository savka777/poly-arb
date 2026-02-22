import { runEventPod } from '@/agent/graph';
import { hasRecentSignal, pruneExpiredSignals } from '@/store/signals';
import { addNewsEvent } from '@/store/news-events';
import { addScoutEvent, isArticleUrlSeen, markArticleUrlSeen } from '@/store/scout-events';
import { logActivity } from '@/store/activity-log';
import { syncAllMarkets, syncRecentMarkets, getSyncStatus } from '@/data/market-sync';
import { getAllMarketsList } from '@/store/markets';
import { commitUncommittedSignals } from '@/solana/commitment';
import { config } from '@/lib/config';
import { nanoid } from 'nanoid';
import type { Market, OrchestratorStatus, NewsEvent } from '@/lib/types';
import {
  startPriceWatcher,
  stopPriceWatcher,
  getPriceWatcherStatus,
  getTrackedMarkets,
  setTrackedMarkets,
  type PriceChange,
} from './watchers/price-watcher';
import {
  startNewsWatcher,
  stopNewsWatcher,
  getNewsWatcherStatus,
  updateActiveMarkets,
  type NewsMatch,
} from './watchers/news-watcher';
import {
  startTimeWatcher,
  stopTimeWatcher,
  getTimeWatcherStatus,
  updateTrackedMarkets,
  type ExpiryAlert,
} from './watchers/time-watcher';
import {
  startRssWatcher,
  stopRssWatcher,
  getRssWatcherStatus,
  updateRssActiveMarkets,
  type RssMatch,
} from './watchers/rss-watcher';
import {
  startPolymarketWS,
  stopPolymarketWS,
  subscribeMarkets,
} from '@/data/polymarket-ws';

// ─── Priority Queue ─────────────────────────────────────────────────────────

interface QueueEntry {
  market: Market;
  priority: number;
  reason: 'price_change' | 'news_match' | 'near_expiry' | 'manual';
  enqueuedAt: number;
}

const queue: Map<string, QueueEntry> = new Map();

function computePriority(
  changeSignal: number,
  liquidity: number,
  daysToExpiry: number,
): number {
  const liquidityFactor = Math.log10(Math.max(liquidity, 1));
  const expiryFactor = 1 / (1 + daysToExpiry / 7);
  return changeSignal * liquidityFactor * expiryFactor;
}

function enqueue(
  market: Market,
  priority: number,
  reason: QueueEntry['reason'],
): void {
  const existing = queue.get(market.id);
  if (existing) {
    // Take the higher priority
    if (priority > existing.priority) {
      existing.priority = priority;
      existing.reason = reason;
    }
    return;
  }

  if (queue.size >= config.orchestrator.maxQueueSize) {
    // Drop lowest priority entry
    let lowestId = '';
    let lowestPriority = Infinity;
    for (const [id, entry] of queue) {
      if (entry.priority < lowestPriority) {
        lowestPriority = entry.priority;
        lowestId = id;
      }
    }
    if (lowestPriority < priority && lowestId) {
      queue.delete(lowestId);
    } else {
      return; // new entry is lower priority than everything in queue
    }
  }

  queue.set(market.id, {
    market,
    priority,
    reason,
    enqueuedAt: Date.now(),
  });
}

function dequeueHighest(): QueueEntry | null {
  let best: QueueEntry | null = null;
  let bestId = '';

  for (const [id, entry] of queue) {
    if (!best || entry.priority > best.priority) {
      best = entry;
      bestId = id;
    }
  }

  if (bestId) queue.delete(bestId);
  return best;
}

// ─── Cooldowns + Locks ──────────────────────────────────────────────────────

interface CooldownEntry {
  analyzedAt: number;
  cooldownMs: number;
}

const cooldowns: Map<string, CooldownEntry> = new Map();
const activeLocks: Set<string> = new Set();

function isOnCooldown(marketId: string): boolean {
  const entry = cooldowns.get(marketId);
  if (!entry) return false;
  return Date.now() - entry.analyzedAt < entry.cooldownMs;
}

function setCooldown(marketId: string, cooldownMs: number): void {
  cooldowns.set(marketId, { analyzedAt: Date.now(), cooldownMs });
}

function acquireLock(marketId: string): boolean {
  if (activeLocks.has(marketId)) return false;
  activeLocks.add(marketId);
  return true;
}

function releaseLock(marketId: string): void {
  activeLocks.delete(marketId);
}

// ─── Worker Pool ────────────────────────────────────────────────────────────

interface OrchestratorState {
  running: boolean;
  totalAnalyzed: number;
  totalSignals: number;
  activeWorkers: number;
  workerHandles: ReturnType<typeof setInterval>[];
  syncHandle: ReturnType<typeof setInterval> | null;
}

const state: OrchestratorState = {
  running: false,
  totalAnalyzed: 0,
  totalSignals: 0,
  activeWorkers: 0,
  workerHandles: [],
  syncHandle: null,
};

async function workerLoop(workerId: number): Promise<void> {
  while (state.running) {
    const entry = dequeueHighest();
    if (!entry) {
      // No work — wait and retry
      await new Promise((r) => setTimeout(r, 2_000));
      continue;
    }

    const { market, reason } = entry;

    // Skip if on cooldown or recently signaled
    if (isOnCooldown(market.id)) continue;
    if (hasRecentSignal(market.id, config.scanner.signalTtlMs)) {
      setCooldown(market.id, config.orchestrator.cooldown.signalFound);
      continue;
    }

    // Acquire per-market lock
    if (!acquireLock(market.id)) continue;

    state.activeWorkers++;

    try {
      const label = market.question.slice(0, 50);
      logActivity('orchestrator', 'info', `[w${workerId}] Analyzing (${reason}): ${label}...`);

      const result = await runEventPod(market);
      state.totalAnalyzed++;

      if (result.signal) {
        state.totalSignals++;
        setCooldown(market.id, config.orchestrator.cooldown.signalFound);
        logActivity(
          'orchestrator',
          'info',
          `[w${workerId}] Signal: ${result.signal.direction.toUpperCase()} EV=${result.signal.ev.toFixed(3)} "${label}..."`,
          { marketId: market.id, ev: result.signal.ev, direction: result.signal.direction },
        );

        // Record as news event for the feed
        const newsEvent: NewsEvent = {
          id: nanoid(),
          article: {
            title: `Analysis triggered by ${reason.replace('_', ' ')}`,
            url: market.url,
            source: 'orchestrator',
            content: result.reasoning,
          },
          matchedMarkets: [{
            marketId: market.id,
            question: market.question,
            relevance: 'high',
          }],
          signalsGenerated: [result.signal.id],
          timestamp: new Date().toISOString(),
        };
        addNewsEvent(newsEvent);
      } else if (result.reasoning.includes('No news')) {
        setCooldown(market.id, config.orchestrator.cooldown.noNews);
        logActivity('orchestrator', 'info', `[w${workerId}] No news for "${label}..."`);
      } else {
        setCooldown(market.id, config.orchestrator.cooldown.newsNoSignal);
        logActivity('orchestrator', 'info', `[w${workerId}] No signal for "${label}..."`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logActivity('orchestrator', 'error', `[w${workerId}] Error analyzing ${market.id}: ${msg}`);
      setCooldown(market.id, config.orchestrator.cooldown.error);
    } finally {
      releaseLock(market.id);
      state.activeWorkers--;
    }
  }
}

// ─── Watcher Callbacks ──────────────────────────────────────────────────────

function onPriceChanges(changes: PriceChange[]): void {
  if (changes.length > 0) {
    logActivity('price-watcher', 'info', `${changes.length} markets moved >${(config.orchestrator.priceChangeThreshold * 100).toFixed(0)}%`);
  }

  for (const change of changes) {
    const daysToExpiry =
      (new Date(change.market.endDate).getTime() - Date.now()) / 86_400_000;
    const priority = computePriority(
      change.changeMagnitude * 10, // amplify price changes
      change.market.liquidity,
      daysToExpiry,
    );
    enqueue(change.market, priority, 'price_change');
  }

  // Update markets available to other watchers
  const markets = getTrackedMarkets();
  updateActiveMarkets(markets);
  updateTrackedMarkets(markets);
}

function onNewsMatches(matches: NewsMatch[]): void {
  if (matches.length > 0) {
    logActivity('news-watcher', 'info', `${matches.length} news-market matches found`);
  }

  for (const match of matches) {
    const daysToExpiry =
      (new Date(match.market.endDate).getTime() - Date.now()) / 86_400_000;
    const priority = computePriority(
      match.keywordOverlap * 5,
      match.market.liquidity,
      daysToExpiry,
    );
    enqueue(match.market, priority, 'news_match');
  }
}

function onRssMatches(matches: RssMatch[]): void {
  if (matches.length > 0) {
    logActivity('news-watcher', 'info', `RSS: ${matches.length} article-market matches → enqueuing for analysis`);
  }

  for (const match of matches) {
    const daysToExpiry =
      (new Date(match.market.endDate).getTime() - Date.now()) / 86_400_000;
    const priority = computePriority(
      match.keywordOverlap * 5,
      match.market.liquidity,
      daysToExpiry,
    );
    enqueue(match.market, priority, 'news_match');
  }

  // Scout: surface high-relevance matches immediately (before LLM analysis)
  const highRelevance = matches.filter((m) => m.keywordOverlap >= 0.4);
  if (highRelevance.length > 0) {
    // Console log each match as a structured trade alert
    for (const match of highRelevance) {
      console.log(
        `[SCOUT] 🛸 RSS Alert | "${match.article.title.slice(0, 80)}"\n` +
        `        → Market: "${match.market.question.slice(0, 80)}" ` +
        `(overlap: ${(match.keywordOverlap * 100).toFixed(0)}%, liq: $${match.market.liquidity.toLocaleString()})`,
      );
    }

    // Bundle all high-relevance matches from this poll into one ScoutEvent.
    // Skip if this article URL was already surfaced — prevents duplicate alerts
    // even across RSS poll cycles or after seenKeys eviction.
    const representativeArticle = highRelevance[0].article;
    const articleUrl = representativeArticle.url ?? '';
    if (articleUrl && isArticleUrlSeen(articleUrl)) return;
    markArticleUrlSeen(articleUrl);
    addScoutEvent({
      id: nanoid(),
      article: {
        title: representativeArticle.title,
        url: representativeArticle.url ?? '',
        source: representativeArticle.source,
        snippet: representativeArticle.content?.slice(0, 200),
      },
      matchedMarkets: highRelevance.map((m) => ({
        marketId: m.market.id,
        question: m.market.question,
        category: m.market.category,
        keywordOverlap: m.keywordOverlap,
        url: m.market.url,
        capturedPrice: m.market.probability,
      })),
      timestamp: new Date().toISOString(),
    });
  }
}

function onExpiryAlerts(alerts: ExpiryAlert[]): void {
  if (alerts.length > 0) {
    const critical = alerts.filter((a) => a.urgency === 'critical').length;
    logActivity('time-watcher', 'info', `${alerts.length} near-expiry markets (${critical} critical)`);
  }

  for (const alert of alerts) {
    const urgencySignal =
      alert.urgency === 'critical' ? 3 : alert.urgency === 'high' ? 1.5 : 0.5;
    const priority = computePriority(
      urgencySignal,
      alert.market.liquidity,
      alert.hoursUntilExpiry / 24,
    );
    enqueue(alert.market, priority, 'near_expiry');
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function startOrchestrator(): void {
  if (state.running) return;

  state.running = true;

  logActivity(
    'orchestrator',
    'info',
    `Starting (workers: ${config.orchestrator.workerCount}, queue max: ${config.orchestrator.maxQueueSize})`,
  );

  // Prune expired signals on startup
  const pruned = pruneExpiredSignals();
  if (pruned > 0) {
    logActivity('orchestrator', 'info', `Pruned ${pruned} expired signals`);
  }

  // Full market sync on startup, then start watchers
  syncAllMarkets()
    .then(() => {
      // Seed watchers with full market list from SQLite
      const allMarkets = getAllMarketsList();
      if (allMarkets.length > 0) {
        updateActiveMarkets(allMarkets);
        updateTrackedMarkets(allMarkets);
        updateRssActiveMarkets(allMarkets);
        setTrackedMarkets(allMarkets);
        logActivity('orchestrator', 'info', `Seeded watchers with ${allMarkets.length} markets from SQLite`);

        // Start WebSocket with all known token IDs
        const tokenIds = allMarkets
          .map((m) => m.clobTokenId)
          .filter((id): id is string => !!id);
        if (tokenIds.length > 0) {
          startPolymarketWS(tokenIds);
          logActivity('orchestrator', 'info', `WebSocket started with ${tokenIds.length} tokens`);
        }
      }
    })
    .catch((e) => {
      logActivity('orchestrator', 'error', `Initial sync failed: ${e instanceof Error ? e.message : String(e)}`);
    });

  // Commit any signals that were saved but not yet committed to Solana
  if (config.solana.enabled) {
    commitUncommittedSignals().catch((e) => {
      logActivity('orchestrator', 'error', `Failed to commit pending signals: ${e instanceof Error ? e.message : String(e)}`);
    });
  }

  // Start watchers
  startPriceWatcher(onPriceChanges);
  startNewsWatcher(onNewsMatches);
  startTimeWatcher(onExpiryAlerts);
  startRssWatcher(onRssMatches);

  // Schedule incremental syncs
  state.syncHandle = setInterval(() => {
    syncRecentMarkets()
      .then(() => {
        // Refresh watcher market lists after sync
        const allMarkets = getAllMarketsList();
        if (allMarkets.length > 0) {
          updateActiveMarkets(allMarkets);
          updateTrackedMarkets(allMarkets);
          updateRssActiveMarkets(allMarkets);
          setTrackedMarkets(allMarkets);

          // Subscribe any new tokens to the WebSocket
          const tokenIds = allMarkets
            .map((m) => m.clobTokenId)
            .filter((id): id is string => !!id);
          if (tokenIds.length > 0) {
            subscribeMarkets(tokenIds);
          }
        }
      })
      .catch((e) => {
        logActivity('sync', 'error', `Scheduled sync failed: ${e instanceof Error ? e.message : String(e)}`);
      });
  }, config.sync.intervalMs);

  // Start worker pool
  for (let i = 0; i < config.orchestrator.workerCount; i++) {
    workerLoop(i).catch((e) =>
      logActivity('orchestrator', 'error', `Worker ${i} fatal error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }
}

export function stopOrchestrator(): void {
  state.running = false;
  stopPriceWatcher();
  stopNewsWatcher();
  stopTimeWatcher();
  stopRssWatcher();
  stopPolymarketWS();
  if (state.syncHandle) {
    clearInterval(state.syncHandle);
    state.syncHandle = null;
  }
  queue.clear();
  logActivity('orchestrator', 'info', 'Stopped');
}

export function enqueueMarket(
  market: Market,
  reason: QueueEntry['reason'] = 'manual',
): void {
  const daysToExpiry =
    (new Date(market.endDate).getTime() - Date.now()) / 86_400_000;
  const priority = computePriority(10, market.liquidity, daysToExpiry);
  enqueue(market, priority, reason);
}

export function getOrchestratorStatus(): OrchestratorStatus {
  const priceStatus = getPriceWatcherStatus();
  const newsStatus = getNewsWatcherStatus();
  const timeStatus = getTimeWatcherStatus();
  const rssStatus = getRssWatcherStatus();

  return {
    running: state.running,
    queueSize: queue.size,
    activeWorkers: state.activeWorkers,
    totalAnalyzed: state.totalAnalyzed,
    totalSignals: state.totalSignals,
    watchers: {
      price: {
        running: priceStatus.running,
        trackedMarkets: priceStatus.trackedMarkets,
      },
      news: {
        running: newsStatus.running,
        lastPollAt: newsStatus.lastPollAt,
      },
      time: {
        running: timeStatus.running,
        trackedMarkets: timeStatus.trackedMarkets,
      },
    },
    rss: {
      running: rssStatus.running,
      feedCount: rssStatus.feedCount,
      lastPollAt: rssStatus.lastPollAt,
      totalArticlesSeen: rssStatus.totalArticlesSeen,
      totalMatches: rssStatus.totalMatches,
    },
  };
}
