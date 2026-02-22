import { logActivity } from '@/store/activity-log';
import { config } from '@/lib/config';
import { onUpdate } from '@/data/polymarket-ws';
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
  unsubscribeWs: (() => void) | null;
}

const state: PriceWatcherState = {
  running: false,
  prices: new Map(),
  markets: new Map(),
  unsubscribeWs: null,
};

export type PriceChangeCallback = (changes: PriceChange[]) => void;

let onChangeCallback: PriceChangeCallback | null = null;

export function startPriceWatcher(callback: PriceChangeCallback): void {
  if (state.running) return;

  state.running = true;
  onChangeCallback = callback;

  logActivity(
    'price-watcher',
    'info',
    `Starting (WebSocket mode, threshold: ${(config.orchestrator.priceChangeThreshold * 100).toFixed(0)}%)`,
  );

  // Listen for live WebSocket updates instead of polling
  state.unsubscribeWs = onUpdate((update) => {
    if (!state.running || !onChangeCallback) return;

    const tokenId = update.tokenId;
    const newPrice = update.data.price;
    if (!newPrice || newPrice <= 0) return;

    // Find the market associated with this token
    let matchedMarket: Market | undefined;
    for (const market of state.markets.values()) {
      if (market.clobTokenId === tokenId) {
        matchedMarket = market;
        break;
      }
    }

    if (!matchedMarket) return;

    const previous = state.prices.get(matchedMarket.id);
    state.prices.set(matchedMarket.id, newPrice);

    if (previous !== undefined) {
      const changeMagnitude = Math.abs(newPrice - previous);
      if (changeMagnitude >= config.orchestrator.priceChangeThreshold) {
        onChangeCallback([{
          market: matchedMarket,
          previousPrice: previous,
          currentPrice: newPrice,
          changeMagnitude,
        }]);
      }
    }
  });
}

export function stopPriceWatcher(): void {
  if (state.unsubscribeWs) {
    state.unsubscribeWs();
    state.unsubscribeWs = null;
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
    trackedMarkets: state.markets.size,
  };
}

export function getTrackedMarkets(): Market[] {
  return Array.from(state.markets.values());
}

/** Update the set of markets being tracked for price changes. */
export function setTrackedMarkets(markets: Market[]): void {
  state.markets.clear();
  for (const market of markets) {
    state.markets.set(market.id, market);
    // Seed initial price if we don't have one
    if (!state.prices.has(market.id)) {
      state.prices.set(market.id, market.probability);
    }
  }
}
