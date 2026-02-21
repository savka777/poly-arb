import { logActivity } from '@/store/activity-log';
import { config } from '@/lib/config';
import type { Market } from '@/lib/types';

export interface ExpiryAlert {
  market: Market;
  hoursUntilExpiry: number;
  urgency: 'critical' | 'high' | 'normal';
}

interface TimeWatcherState {
  running: boolean;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

const state: TimeWatcherState = {
  running: false,
  intervalHandle: null,
};

export type ExpiryCallback = (alerts: ExpiryAlert[]) => void;

let onExpiryCallback: ExpiryCallback | null = null;
let trackedMarkets: Market[] = [];

function checkExpiries(): void {
  const now = Date.now();
  const alerts: ExpiryAlert[] = [];

  for (const market of trackedMarkets) {
    const msLeft = new Date(market.endDate).getTime() - now;
    if (msLeft <= 0) continue; // already expired

    const hoursLeft = msLeft / (60 * 60 * 1000);

    let urgency: ExpiryAlert['urgency'];
    if (hoursLeft < 24) {
      urgency = 'critical';
    } else if (hoursLeft < 7 * 24) {
      urgency = 'high';
    } else {
      continue; // not urgent enough
    }

    alerts.push({
      market,
      hoursUntilExpiry: hoursLeft,
      urgency,
    });
  }

  if (alerts.length > 0) {
    // Sort by urgency (critical first), then by time remaining
    alerts.sort((a, b) => {
      const urgencyOrder = { critical: 0, high: 1, normal: 2 };
      const urgDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgDiff !== 0) return urgDiff;
      return a.hoursUntilExpiry - b.hoursUntilExpiry;
    });

    onExpiryCallback?.(alerts);
  } else {
    logActivity('time-watcher', 'info', `Checked ${trackedMarkets.length} markets, no near-expiry alerts`);
  }
}

export function updateTrackedMarkets(markets: Market[]): void {
  trackedMarkets = markets;
}

export function startTimeWatcher(callback: ExpiryCallback): void {
  if (state.running) return;

  state.running = true;
  onExpiryCallback = callback;

  logActivity(
    'time-watcher',
    'info',
    `Starting (interval: ${config.orchestrator.timeWatchIntervalMs}ms)`,
  );

  // First check after short delay
  setTimeout(() => checkExpiries(), 6_000);

  state.intervalHandle = setInterval(
    () => checkExpiries(),
    config.orchestrator.timeWatchIntervalMs,
  );
}

export function stopTimeWatcher(): void {
  if (state.intervalHandle) {
    clearInterval(state.intervalHandle);
    state.intervalHandle = null;
  }
  state.running = false;
  onExpiryCallback = null;
  logActivity('time-watcher', 'info', 'Stopped');
}

export function getTimeWatcherStatus(): {
  running: boolean;
  trackedMarkets: number;
} {
  return {
    running: state.running,
    trackedMarkets: trackedMarkets.length,
  };
}
