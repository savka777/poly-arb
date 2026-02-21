import { fetchTrendingMarkets, fetchMarketById } from '@/data/polymarket';
import { runEventPod } from '@/agent/graph';
import { getWatchlist } from '@/store/watchlist';
import { getSignalsByMarket } from '@/store/signals';
import { config } from '@/lib/config';
import type { Market, ScannerStatus } from '@/lib/types';

interface ScannerState {
  running: boolean;
  lastScanAt: string | null;
  marketsScanned: number;
  signalsGenerated: number;
  cycleInProgress: boolean;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

const state: ScannerState = {
  running: false,
  lastScanAt: null,
  marketsScanned: 0,
  signalsGenerated: 0,
  cycleInProgress: false,
  intervalHandle: null,
};

// ─── Concurrency pool ────────────────────────────────────────────────────────

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

// ─── Signal freshness check ──────────────────────────────────────────────────

function hasRecentSignal(marketId: string): boolean {
  const signals = getSignalsByMarket(marketId);
  if (signals.length === 0) return false;

  const latest = signals[0]; // signals are sorted newest first
  const age = Date.now() - new Date(latest.createdAt).getTime();
  return age < config.scanner.signalTtlMs;
}

// ─── Scan cycle ──────────────────────────────────────────────────────────────

async function runScanCycle(): Promise<void> {
  if (state.cycleInProgress) {
    console.log('[scanner] Cycle already in progress, skipping');
    return;
  }

  state.cycleInProgress = true;
  const cycleStart = Date.now();

  try {
    console.log('[scanner] Starting scan cycle...');

    // Fetch trending markets (events-based, excludes sports)
    const marketsResult = await fetchTrendingMarkets({
      limit: config.scanner.marketsPerCycle,
      pages: 2,
    });
    if (!marketsResult.ok) {
      console.error('[scanner] Failed to fetch markets:', marketsResult.error);
      return;
    }

    const markets = marketsResult.data;

    // Merge with watchlist
    const watchlistIds = getWatchlist();
    const marketIds = new Set(markets.map((m) => m.id));
    const watchlistMarkets: Market[] = [];

    // Fetch watchlist markets concurrently
    const missingWatchlistIds = watchlistIds.filter((id) => !marketIds.has(id));
    if (missingWatchlistIds.length > 0) {
      const fetched = await runPool(
        missingWatchlistIds,
        config.scanner.concurrency,
        async (id) => {
          const result = await fetchMarketById(id);
          return result.ok ? result.data : null;
        },
      );
      for (const m of fetched) {
        if (m) watchlistMarkets.push(m);
      }
    }

    // Watchlisted first, then by volume
    const allMarkets = [...watchlistMarkets, ...markets];

    // Filter out markets with recent signals (skip re-analysis)
    const marketsToAnalyze = allMarkets.filter(
      (m) => !hasRecentSignal(m.id),
    );

    const skipped = allMarkets.length - marketsToAnalyze.length;
    if (skipped > 0) {
      console.log(
        `[scanner] Skipping ${skipped} markets with recent signals`,
      );
    }

    console.log(
      `[scanner] Analyzing ${marketsToAnalyze.length} markets (concurrency: ${config.scanner.concurrency})`,
    );

    // Run analysis concurrently with pool
    let generated = 0;

    const results = await runPool(
      marketsToAnalyze,
      config.scanner.concurrency,
      async (market) => {
        try {
          const label = market.question.slice(0, 50);
          console.log(`[scanner] ▸ ${label}...`);

          const result = await runEventPod(market);

          if (result.signal) {
            generated++;
            console.log(
              `[scanner] ✓ ${result.signal.direction.toUpperCase()} EV=${result.signal.ev.toFixed(3)} "${label}..."`,
            );
          }
          return { ok: true as const };
        } catch (e) {
          console.error(
            `[scanner] ✗ Error ${market.id}:`,
            e instanceof Error ? e.message : String(e),
          );
          return { ok: false as const };
        }
      },
    );

    const scanned = results.filter((r) => r.ok).length;
    const elapsed = ((Date.now() - cycleStart) / 1000).toFixed(1);

    state.lastScanAt = new Date().toISOString();
    state.marketsScanned += scanned;
    state.signalsGenerated += generated;

    console.log(
      `[scanner] Cycle complete in ${elapsed}s — Scanned: ${scanned}, Signals: ${generated}, Skipped: ${skipped}`,
    );
  } finally {
    state.cycleInProgress = false;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function startScanner(): void {
  if (state.running) return;

  state.running = true;
  console.log(
    `[scanner] Starting background scanner (interval: ${config.cycleIntervalMs}ms, concurrency: ${config.scanner.concurrency}, markets: ${config.scanner.marketsPerCycle})`,
  );

  // First cycle after short delay
  setTimeout(() => {
    runScanCycle().catch((e) =>
      console.error('[scanner] Scan cycle error:', e),
    );
  }, 3_000);

  // Recurring cycles
  state.intervalHandle = setInterval(() => {
    runScanCycle().catch((e) =>
      console.error('[scanner] Scan cycle error:', e),
    );
  }, config.cycleIntervalMs);
}

export function stopScanner(): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  console.log('[scanner] Stopped');
}

export function getScannerStatus(): ScannerStatus {
  const nextScanAt =
    state.running && state.lastScanAt
      ? new Date(
          new Date(state.lastScanAt).getTime() + config.cycleIntervalMs,
        ).toISOString()
      : null;

  return {
    running: state.running,
    lastScanAt: state.lastScanAt,
    marketsScanned: state.marketsScanned,
    signalsGenerated: state.signalsGenerated,
    nextScanAt,
  };
}
