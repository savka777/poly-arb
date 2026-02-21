import { fetchMarkets, fetchMarketById } from '@/data/polymarket';
import { runEventPod } from '@/agent/graph';
import { getWatchlist } from '@/store/watchlist';
import { config } from '@/lib/config';
import type { ScannerStatus } from '@/lib/types';

interface ScannerState {
  running: boolean;
  lastScanAt: string | null;
  marketsScanned: number;
  signalsGenerated: number;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

const state: ScannerState = {
  running: false,
  lastScanAt: null,
  marketsScanned: 0,
  signalsGenerated: 0,
  intervalHandle: null,
};

const MARKETS_PER_CYCLE = 20;

async function runScanCycle(): Promise<void> {
  console.log('[scanner] Starting scan cycle...');

  // Fetch top markets
  const marketsResult = await fetchMarkets({ limit: MARKETS_PER_CYCLE });
  if (!marketsResult.ok) {
    console.error('[scanner] Failed to fetch markets:', marketsResult.error);
    return;
  }

  const markets = marketsResult.data;

  // Merge with watchlist
  const watchlistIds = getWatchlist();
  const marketIds = new Set(markets.map((m) => m.id));
  const watchlistMarkets = [];

  for (const wId of watchlistIds) {
    if (!marketIds.has(wId)) {
      const result = await fetchMarketById(wId);
      if (result.ok) {
        watchlistMarkets.push(result.data);
      }
    }
  }

  // Watchlisted markets go first
  const allMarkets = [...watchlistMarkets, ...markets];

  let scanned = 0;
  let generated = 0;

  // Run sequentially to avoid rate limits
  for (const market of allMarkets) {
    try {
      console.log(`[scanner] Analyzing: ${market.question.slice(0, 60)}...`);
      const result = await runEventPod(market);
      scanned++;
      if (result.signal) {
        generated++;
        console.log(
          `[scanner] Signal: ${result.signal.direction.toUpperCase()} EV=${result.signal.ev.toFixed(3)} for "${market.question.slice(0, 40)}..."`
        );
      }
    } catch (e) {
      console.error(
        `[scanner] Error analyzing ${market.id}:`,
        e instanceof Error ? e.message : String(e)
      );
    }
  }

  state.lastScanAt = new Date().toISOString();
  state.marketsScanned += scanned;
  state.signalsGenerated += generated;

  console.log(
    `[scanner] Cycle complete. Scanned: ${scanned}, Signals: ${generated}`
  );
}

export function startScanner(): void {
  if (state.running) return;

  state.running = true;
  console.log(
    `[scanner] Starting background scanner (interval: ${config.cycleIntervalMs}ms)`
  );

  // Run first cycle after a short delay to let the server finish booting
  setTimeout(() => {
    runScanCycle().catch((e) =>
      console.error('[scanner] Scan cycle error:', e)
    );
  }, 5_000);

  // Schedule recurring cycles
  state.intervalHandle = setInterval(() => {
    runScanCycle().catch((e) =>
      console.error('[scanner] Scan cycle error:', e)
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
          new Date(state.lastScanAt).getTime() + config.cycleIntervalMs
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
