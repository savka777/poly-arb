import { fetchTrendingMarkets } from '@/data/polymarket';
import { logActivity } from '@/store/activity-log';
import { config } from '@/lib/config';
import type { Market } from '@/lib/types';

export interface PriceChange {
  market: Market;
  previousPrice: number;
  currentPrice: number;
  changeMagnitude: number;
}

interface PriceWatcherState {
  running: boolean;
  prices: Map<string, number>;
  markets: Map<string, Market>;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

const state: PriceWatcherState = {
  running: false,
  prices: new Map(),
  markets: new Map(),
  intervalHandle: null,
};

export type PriceChangeCallback = (changes: PriceChange[]) => void;

let onChangeCallback: PriceChangeCallback | null = null;

async function pollPrices(): Promise<void> {
  const result = await fetchTrendingMarkets({
    limit: config.scanner.marketsPerCycle,
    pages: 2,
  });

  if (!result.ok) {
    logActivity('price-watcher', 'error', `Failed to fetch markets: ${result.error}`);
    return;
  }

  const changes: PriceChange[] = [];

  for (const market of result.data) {
    const previous = state.prices.get(market.id);
    state.markets.set(market.id, market);

    if (previous !== undefined) {
      const changeMagnitude = Math.abs(market.probability - previous);
      if (changeMagnitude >= config.orchestrator.priceChangeThreshold) {
        changes.push({
          market,
          previousPrice: previous,
          currentPrice: market.probability,
          changeMagnitude,
        });
      }
    }

    state.prices.set(market.id, market.probability);
  }

  if (changes.length > 0) {
    onChangeCallback?.(changes);
  } else {
    logActivity('price-watcher', 'info', `Polled ${result.data.length} markets, no significant changes`);
  }
}

export function startPriceWatcher(callback: PriceChangeCallback): void {
  if (state.running) return;

  state.running = true;
  onChangeCallback = callback;

  logActivity(
    'price-watcher',
    'info',
    `Starting (interval: ${config.orchestrator.priceWatchIntervalMs}ms, threshold: ${(config.orchestrator.priceChangeThreshold * 100).toFixed(0)}%)`,
  );

  // Initial poll after short delay
  setTimeout(() => {
    pollPrices().catch((e) =>
      logActivity('price-watcher', 'error', `Poll error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, 2_000);

  state.intervalHandle = setInterval(() => {
    pollPrices().catch((e) =>
      logActivity('price-watcher', 'error', `Poll error: ${e instanceof Error ? e.message : String(e)}`),
    );
  }, config.orchestrator.priceWatchIntervalMs);
}

export function stopPriceWatcher(): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  onChangeCallback = null;
  logActivity('price-watcher', 'info', 'Stopped');
}

export function getPriceWatcherStatus(): {
  running: boolean;
  trackedMarkets: number;
} {
  return {
    running: state.running,
    trackedMarkets: state.prices.size,
  };
}

export function getTrackedMarkets(): Market[] {
  return Array.from(state.markets.values());
}
