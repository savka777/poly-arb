'use client';

import { useMemo } from 'react';
import { useMarkets } from '@/hooks/use-markets';
import { useSignals } from '@/hooks/use-signals';
import { MarketCard } from '@/components/market-card';
import type { Market, Signal } from '@/lib/types';

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export default function MarketGridPage() {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets();
  const { data: signalsData, isLoading: signalsLoading } = useSignals();

  const isLoading = marketsLoading || signalsLoading;

  const signalsByMarket = useMemo(() => {
    const map = new Map<string, Signal>();
    if (signalsData?.signals) {
      for (const signal of signalsData.signals) {
        const existing = map.get(signal.marketId);
        if (!existing || signal.createdAt > existing.createdAt) {
          map.set(signal.marketId, signal);
        }
      }
    }
    return map;
  }, [signalsData]);

  const sortedMarkets = useMemo(() => {
    if (!marketsData?.markets) return [];
    return [...marketsData.markets].sort((a, b) => {
      const sigA = signalsByMarket.get(a.id);
      const sigB = signalsByMarket.get(b.id);
      const evA = sigA ? Math.abs(sigA.ev) : 0;
      const evB = sigB ? Math.abs(sigB.ev) : 0;
      return evB - evA;
    });
  }, [marketsData, signalsByMarket]);

  const activeSignals = signalsData?.total ?? 0;
  const marketsScanned = marketsData?.total ?? 0;
  const highEvCount = signalsData?.signals
    ? signalsData.signals.filter((s) => s.confidence === 'high').length
    : 0;

  const lastScan = signalsData?.signals?.[0]?.createdAt ?? null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">
            DARWIN CAPITAL
          </h1>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
            Scanning ({timeAgo(lastScan)})
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      <div className="border-b border-border-default px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted uppercase tracking-wide">
              Active Signals
            </span>
            <span className="font-mono text-sm font-medium text-text-primary">
              {activeSignals}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted uppercase tracking-wide">
              Markets Scanned
            </span>
            <span className="font-mono text-sm font-medium text-text-primary">
              {marketsScanned}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted uppercase tracking-wide">
              High-EV
            </span>
            <span className="font-mono text-sm font-medium text-accent-green">
              {highEvCount}
            </span>
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-bg-card border border-border-default rounded-xl p-4 animate-pulse"
              >
                <div className="h-4 bg-bg-elevated rounded w-3/4 mb-4" />
                <div className="h-3 bg-bg-elevated rounded w-1/2 mb-3" />
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="h-8 bg-bg-elevated rounded" />
                  <div className="h-8 bg-bg-elevated rounded" />
                  <div className="h-8 bg-bg-elevated rounded" />
                </div>
                <div className="h-2 bg-bg-elevated rounded mb-3" />
                <div className="h-4 bg-bg-elevated rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : sortedMarkets.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <p className="text-lg mb-2">No markets loaded</p>
            <p className="text-sm">
              Markets will appear once the scanner runs.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedMarkets.map((market) => (
              <MarketCard
                key={market.id}
                market={market}
                signal={signalsByMarket.get(market.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
