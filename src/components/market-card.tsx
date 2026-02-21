'use client';

import { useRouter } from 'next/navigation';
import type { Market, Signal } from '@/lib/types';
import { AlphaBar } from './alpha-bar';
import { SignalBadge } from './signal-badge';

interface MarketCardProps {
  market: Market;
  signal?: Signal;
}

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

export function MarketCard({ market, signal }: MarketCardProps) {
  const router = useRouter();

  const question =
    market.question.length > 80
      ? market.question.slice(0, 77) + '...'
      : market.question;

  return (
    <div
      onClick={() => router.push(`/markets/${market.id}`)}
      className="bg-bg-card border border-border-default rounded-xl p-4 cursor-pointer transition-colors duration-150 hover:bg-bg-hover"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary leading-snug pr-2">
          {question}
        </h3>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
          Polymarket
        </span>
      </div>

      {signal ? (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide">
                Market
              </p>
              <p className="font-mono text-sm text-text-primary">
                {Number(signal.marketPrice).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide">
                Darwin
              </p>
              <p className="font-mono text-sm text-text-primary">
                {Number(signal.darwinEstimate).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide">
                EV
              </p>
              <p
                className={`font-mono text-sm font-medium ${
                  signal.ev > 0 ? 'text-accent-green' : 'text-accent-red'
                }`}
              >
                {signal.ev > 0 ? '+' : ''}
                {Number(signal.ev).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mb-3">
            <AlphaBar
              darwinEstimate={signal.darwinEstimate}
              marketPrice={signal.marketPrice}
              size="sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <SignalBadge confidence={signal.confidence} />
            <span className="text-xs text-text-muted">
              {timeAgo(signal.createdAt)}
            </span>
          </div>
        </>
      ) : (
        <div className="mt-2">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wide">
                Market
              </p>
              <p className="font-mono text-sm text-text-secondary">
                {Number(market.probability).toFixed(2)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-text-muted mt-3">No signal</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
