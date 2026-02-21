import { fetchEvents } from '@/data/polymarket';
import { bulkUpsertMarkets, getMarketCount } from '@/store/markets';
import { logActivity } from '@/store/activity-log';
import { config } from '@/lib/config';
import type { Market, SyncStatus } from '@/lib/types';

const syncState = {
  lastSyncAt: null as string | null,
  syncInProgress: false,
};

function gammaEventToMarkets(event: {
  id: string;
  title: string;
  tags: Array<{ label: string; slug: string }>;
  markets: Array<{
    id: string;
    question: string;
    slug: string;
    endDate: string;
    liquidity: number;
    volume: number;
    outcomePrices: string;
    outcomes: string;
    clobTokenIds: string;
    category: string;
    active: boolean;
    oneDayPriceChange?: number;
    volume24hr?: number;
    spread?: number;
  }>;
}): Market[] {
  const results: Market[] = [];

  for (const m of event.markets ?? []) {
    if (!m.question || !m.outcomePrices || !m.active) continue;

    let probability = 0.5;
    try {
      const prices = JSON.parse(m.outcomePrices) as number[];
      probability = prices[0] ?? 0.5;
    } catch {
      // fallback
    }

    let clobTokenId: string | undefined;
    try {
      const tokenIds = JSON.parse(m.clobTokenIds) as string[];
      clobTokenId = tokenIds[0];
    } catch {
      // no token ID
    }

    // Derive category from tags
    const tagLabels = (event.tags ?? []).map((t) => t.label);
    const category = m.category || tagLabels[0] || undefined;

    results.push({
      id: m.id,
      platform: 'polymarket',
      question: m.question,
      probability,
      volume: m.volume ?? 0,
      liquidity: m.liquidity ?? 0,
      endDate: m.endDate ?? new Date().toISOString(),
      url: `https://polymarket.com/event/${m.slug}`,
      category,
      lastUpdated: new Date().toISOString(),
      clobTokenId,
      spread: m.spread,
      oneDayPriceChange: m.oneDayPriceChange,
      volume24hr: m.volume24hr,
      event: { id: event.id, title: event.title },
    });
  }

  return results;
}

async function fetchPage(offset: number, limit: number): Promise<Market[]> {
  const result = await fetchEvents({ limit, offset });
  if (!result.ok) {
    logActivity('sync', 'warn', `Failed to fetch page at offset ${offset}: ${result.error}`);
    return [];
  }

  const markets: Market[] = [];
  for (const event of result.data) {
    markets.push(...gammaEventToMarkets(event));
  }
  return markets;
}

export async function syncAllMarkets(): Promise<number> {
  if (syncState.syncInProgress) {
    logActivity('sync', 'warn', 'Sync already in progress, skipping');
    return 0;
  }

  syncState.syncInProgress = true;
  logActivity('sync', 'info', 'Full market sync started...');

  const perPage = 50;
  const maxPages = config.sync.fullSyncPages;
  const concurrency = config.sync.concurrency;

  let totalSynced = 0;
  let page = 0;
  let emptyPages = 0;

  try {
    while (page < maxPages && emptyPages < 3) {
      // Fetch `concurrency` pages in parallel
      const batch: Promise<Market[]>[] = [];
      for (let i = 0; i < concurrency && page + i < maxPages; i++) {
        batch.push(fetchPage((page + i) * perPage, perPage));
      }

      const results = await Promise.all(batch);

      let batchTotal = 0;
      for (const markets of results) {
        if (markets.length === 0) {
          emptyPages++;
        } else {
          emptyPages = 0;
          const upserted = bulkUpsertMarkets(markets);
          batchTotal += upserted;
        }
      }

      totalSynced += batchTotal;
      page += concurrency;

      // Progress log every 500 markets
      if (totalSynced > 0 && totalSynced % 500 < batchTotal) {
        logActivity('sync', 'info', `Sync progress: ${totalSynced} markets synced (page ${page})`);
      }
    }

    syncState.lastSyncAt = new Date().toISOString();
    logActivity('sync', 'info', `Full sync complete: ${totalSynced} markets synced to SQLite`, {
      totalMarkets: getMarketCount(),
      pagesScanned: page,
    });

    return totalSynced;
  } catch (e) {
    logActivity('sync', 'error', `Sync failed: ${e instanceof Error ? e.message : String(e)}`);
    return totalSynced;
  } finally {
    syncState.syncInProgress = false;
  }
}

export async function syncRecentMarkets(): Promise<number> {
  if (syncState.syncInProgress) return 0;

  syncState.syncInProgress = true;

  const perPage = 50;
  const pages = config.sync.incrementalPages;
  let totalSynced = 0;

  try {
    for (let i = 0; i < pages; i++) {
      const markets = await fetchPage(i * perPage, perPage);
      if (markets.length === 0) break;
      totalSynced += bulkUpsertMarkets(markets);
    }

    syncState.lastSyncAt = new Date().toISOString();

    if (totalSynced > 0) {
      logActivity('sync', 'info', `Incremental sync: ${totalSynced} markets updated`, {
        totalMarkets: getMarketCount(),
      });
    }

    return totalSynced;
  } catch (e) {
    logActivity('sync', 'error', `Incremental sync failed: ${e instanceof Error ? e.message : String(e)}`);
    return totalSynced;
  } finally {
    syncState.syncInProgress = false;
  }
}

export function getSyncStatus(): SyncStatus {
  return {
    lastSyncAt: syncState.lastSyncAt,
    totalMarkets: getMarketCount(),
    syncInProgress: syncState.syncInProgress,
  };
}
