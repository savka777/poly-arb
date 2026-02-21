"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import { useHealth } from "@/hooks/use-health"
import { MarketCard } from "@/components/market-card"
import type { SignalsResponse } from "@/lib/types"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

export default function MarketGrid() {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets()
  const { data: signalsData } = useSignals()
  const { data: health } = useHealth()

  const signalsByMarket = useMemo(() => {
    if (!signalsData?.signals) return new Map<string, SignalsResponse["signals"][number]>()
    const map = new Map<string, SignalsResponse["signals"][number]>()
    for (const signal of signalsData.signals) {
      const existing = map.get(signal.marketId)
      if (!existing || Math.abs(signal.ev) > Math.abs(existing.ev)) {
        map.set(signal.marketId, signal)
      }
    }
    return map
  }, [signalsData])

  const sortedMarkets = useMemo(() => {
    if (!marketsData?.markets) return []
    return [...marketsData.markets].sort((a, b) => {
      const sigA = signalsByMarket.get(a.id)
      const sigB = signalsByMarket.get(b.id)
      const evA = sigA ? Math.abs(sigA.ev) : 0
      const evB = sigB ? Math.abs(sigB.ev) : 0
      return evB - evA
    })
  }, [marketsData, signalsByMarket])

  const activeSignals = signalsData?.total ?? 0
  const marketsScanned = marketsData?.total ?? 0
  const highEv = signalsData?.signals.filter(
    (s) => s.confidence === "high"
  ).length ?? 0

  return (
    <div className="min-h-screen bg-darwin-bg">
      {/* Header */}
      <header className="border-b border-darwin-border px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight text-darwin-text">
            DARWIN CAPITAL
          </h1>
          <div className="flex items-center gap-4">
            <Link
              href="/research"
              className="text-xs font-mono text-darwin-text-secondary hover:text-darwin-blue transition-colors"
            >
              Evidence →
            </Link>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  health?.status === "ok"
                    ? "bg-darwin-green animate-pulse"
                    : "bg-darwin-text-muted"
                )}
              />
              <span className="text-xs text-darwin-text-secondary">
                {health?.lastScanAt
                  ? `Scanned ${relativeTime(health.lastScanAt)}`
                  : "Scanning..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Stats bar */}
      <div className="border-b border-darwin-border px-6 py-3">
        <div className="flex items-center gap-8">
          <StatItem label="Active Signals" value={activeSignals} />
          <StatItem label="Markets Scanned" value={marketsScanned} />
          <StatItem label="High-EV" value={highEv} highlight />
        </div>
      </div>

      {/* Grid */}
      <main className="px-6 py-6">
        {marketsLoading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MarketCard
                key={i}
                market={{
                  id: "",
                  platform: "polymarket",
                  question: "",
                  probability: 0,
                  volume: 0,
                  liquidity: 0,
                  endDate: "",
                  url: "",
                  lastUpdated: "",
                }}
                loading
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
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
  )
}

function StatItem({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-darwin-text-secondary">{label}:</span>
      <span
        className={cn(
          "font-data text-sm font-medium",
          highlight ? "text-darwin-green" : "text-darwin-text"
        )}
      >
        {value}
      </span>
    </div>
  )
}
