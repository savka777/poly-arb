'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { MarketDetailResponse, AnalyzeResponse, ToolCallRecord } from '@/lib/types';
import { AlphaBar } from '@/components/alpha-bar';
import { SignalBadge } from '@/components/signal-badge';
import { AnalysisFeed } from '@/components/analysis-feed';
import { QueryInterface } from '@/components/query-interface';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatCurrency(v: number): string {
  const n = Number(v);
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = params.id as string;

  const [extraToolCalls, setExtraToolCalls] = useState<ToolCallRecord[]>([]);

  const { data, isLoading } = useQuery<MarketDetailResponse>({
    queryKey: ['market', marketId],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${marketId}`);
      if (!res.ok) throw new Error('Failed to fetch market');
      return res.json();
    },
    refetchInterval: parseInt(
      process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '30000',
      10,
    ),
  });

  const handleAnalysisComplete = (response: AnalyzeResponse) => {
    if (response.toolCalls) {
      setExtraToolCalls((prev) => [...prev, ...response.toolCalls]);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <header className="border-b border-border-default px-6 py-4">
          <button
            onClick={() => router.push('/')}
            className="text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            ← Back to Markets
          </button>
        </header>
        <div className="max-w-7xl mx-auto px-6 py-8 animate-pulse">
          <div className="h-8 bg-bg-elevated rounded w-2/3 mb-4" />
          <div className="h-4 bg-bg-elevated rounded w-1/3 mb-8" />
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="h-32 bg-bg-card rounded-xl" />
              <div className="h-32 bg-bg-card rounded-xl" />
            </div>
            <div className="h-64 bg-bg-card rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-text-muted">Market not found</p>
      </div>
    );
  }

  const { market, signals } = data;
  const latestSignal = signals[0] ?? null;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border-default px-6 py-4">
        <button
          onClick={() => router.push('/')}
          className="text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ← Back to Markets
        </button>
      </header>

      {/* Market Info */}
      <div className="border-b border-border-default px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">
            {market.question}
          </h1>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="uppercase font-semibold bg-bg-elevated px-2 py-0.5 rounded">
              Polymarket
            </span>
            <span>Ends {formatDate(market.endDate)}</span>
            <span>Vol {formatCurrency(market.volume)}</span>
            <span>Liq {formatCurrency(market.liquidity)}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Panel */}
          <div className="space-y-4">
            {/* Market Price */}
            <div className="bg-bg-card border border-border-default rounded-xl p-5">
              <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                Market Price
              </p>
              <p className="text-4xl font-mono font-medium text-text-primary">
                {Number(market.probability).toFixed(2)}
              </p>
            </div>

            {/* Darwin Estimate */}
            {latestSignal && (
              <div className="bg-bg-card border border-border-default rounded-xl p-5">
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">
                  Darwin Estimate
                </p>
                <p className="text-4xl font-mono font-medium text-text-primary mb-3">
                  {Number(latestSignal.darwinEstimate).toFixed(2)}
                </p>
                <AlphaBar
                  darwinEstimate={latestSignal.darwinEstimate}
                  marketPrice={latestSignal.marketPrice}
                  size="md"
                />
              </div>
            )}

            {/* Signal Details */}
            {latestSignal && (
              <div className="bg-bg-card border border-border-default rounded-xl p-5">
                <p className="text-[10px] text-text-muted uppercase tracking-wide mb-3">
                  Signal Details
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Direction</span>
                    <span className="font-mono text-text-primary uppercase">
                      {latestSignal.direction}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">EV</span>
                    <span
                      className={`font-mono font-medium ${
                        latestSignal.ev > 0
                          ? 'text-accent-green'
                          : 'text-accent-red'
                      }`}
                    >
                      {latestSignal.ev > 0 ? '+' : ''}
                      {Number(latestSignal.ev).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">Confidence</span>
                    <SignalBadge confidence={latestSignal.confidence} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">News Events</span>
                    <span className="font-mono text-text-primary">
                      {latestSignal.newsEvents.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Created</span>
                    <span className="text-text-secondary">
                      {timeAgo(latestSignal.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel — Analysis Feed */}
          <div>
            <h2 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-4">
              Analysis Feed
            </h2>
            <div className="bg-bg-card border border-border-default rounded-xl p-5">
              <AnalysisFeed signals={signals} toolCalls={extraToolCalls} />
            </div>
          </div>
        </div>

        {/* Query Interface */}
        <div className="mt-8 border-t border-border-default pt-6">
          <QueryInterface
            marketId={marketId}
            onAnalysisComplete={handleAnalysisComplete}
          />
        </div>
      </main>
    </div>
  );
}
