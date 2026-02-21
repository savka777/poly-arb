"use client"

import Link from "next/link"
import type { Market, Signal } from "@/lib/types"
import { AlphaBar } from "./alpha-bar"
import { SignalBadge } from "./signal-badge"
import { formatProbability, formatEV, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface MarketCardProps {
  market: Market
  signal?: Signal
  loading?: boolean
}

export function MarketCard({ market, signal, loading }: MarketCardProps) {
  if (loading) {
    return (
      <div className="rounded-sm border border-darwin-border bg-darwin-card p-4 space-y-3 animate-pulse">
        <div className="h-4 w-3/4 rounded-sm bg-darwin-border" />
        <div className="h-3 w-1/4 rounded-sm bg-darwin-border" />
        <div className="space-y-2 pt-2">
          <div className="h-3 w-1/2 rounded-sm bg-darwin-border" />
          <div className="h-3 w-1/2 rounded-sm bg-darwin-border" />
          <div className="h-2 w-full rounded-sm bg-darwin-border" />
        </div>
        <div className="h-3 w-1/3 rounded-sm bg-darwin-border" />
      </div>
    )
  }

  const hasSignal = !!signal
  const isBullish = signal && signal.ev > 0

  return (
    <Link href={`/markets/${market.id}`}>
      <div
        className={cn(
          "rounded-sm border border-darwin-border bg-darwin-card p-4 space-y-3",
          "transition-colors duration-150 hover:bg-darwin-hover cursor-pointer",
          hasSignal && "border-t-2",
          hasSignal && isBullish && "border-t-darwin-green",
          hasSignal && !isBullish && "border-t-darwin-red",
          !hasSignal && "opacity-60"
        )}
      >
        <div>
          <h3 className="text-sm font-medium text-darwin-text line-clamp-2 leading-snug">
            {market.question}
          </h3>
          <span className="label-caps mt-1 inline-block">POLYMARKET</span>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-darwin-text-secondary">Market</span>
            <span className="font-data text-sm text-darwin-text">
              {formatProbability(market.probability)}
            </span>
          </div>

          {hasSignal && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-darwin-text-secondary">Darwin</span>
                <span className="font-data text-sm text-darwin-text">
                  {formatProbability(signal.darwinEstimate)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-darwin-text-secondary">EV</span>
                <span
                  className={cn(
                    "font-data text-sm font-medium",
                    isBullish ? "text-darwin-green" : "text-darwin-red"
                  )}
                >
                  {formatEV(signal.ev)}
                </span>
              </div>
            </>
          )}
        </div>

        {hasSignal ? (
          <AlphaBar
            darwinEstimate={signal.darwinEstimate}
            marketPrice={signal.marketPrice}
            size="sm"
          />
        ) : (
          <p className="text-xs text-darwin-text-muted">No signal</p>
        )}

        {hasSignal && (
          <div className="flex items-center justify-between pt-1">
            <SignalBadge confidence={signal.confidence} />
            <span className="text-[11px] text-darwin-text-muted">
              {relativeTime(signal.createdAt)}
            </span>
          </div>
        )}
      </div>
    </Link>
  )
}
