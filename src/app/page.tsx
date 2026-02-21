"use client"

import { useMemo, useState } from "react"
import { Search, X, ArrowUpDown, TrendingUp, Flame, Clock, LayoutGrid, Zap, Grid3x3, Circle } from "lucide-react"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import { useHealth } from "@/hooks/use-health"
import { useWatchlist } from "@/hooks/use-watchlist"
import { MarketCard } from "@/components/market-card"
import { CompareLink } from "@/components/compare-link"
import { HeatMatrix } from "@/components/heat-matrix"
import { SignalTicker } from "@/components/signal-ticker"
import { BubbleScatter } from "@/components/bubble-scatter"
import type { Market, Signal, SignalsResponse } from "@/lib/types"
import { relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

type ViewTab = "markets" | "heatmap" | "signals" | "scatter"
type SortMode = "alpha" | "volume" | "newest" | "probability"
type SignalFilter = "all" | "has-signal" | "high-ev" | "bullish" | "bearish"

const VIEW_TABS: { value: ViewTab; label: string; icon: typeof LayoutGrid }[] = [
  { value: "markets", label: "Markets", icon: LayoutGrid },
  { value: "heatmap", label: "Heat Map", icon: Grid3x3 },
  { value: "signals", label: "Signals", icon: Zap },
  { value: "scatter", label: "Scatter", icon: Circle },
]

const SORT_OPTIONS: { value: SortMode; label: string; icon: typeof ArrowUpDown }[] = [
  { value: "alpha", label: "Alpha", icon: TrendingUp },
  { value: "volume", label: "Volume", icon: Flame },
  { value: "newest", label: "Newest", icon: Clock },
  { value: "probability", label: "Probability", icon: ArrowUpDown },
]

const SIGNAL_FILTERS: { value: SignalFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "has-signal", label: "Has Signal" },
  { value: "high-ev", label: "High EV" },
  { value: "bullish", label: "Bullish" },
  { value: "bearish", label: "Bearish" },
]

function extractCategories(markets: Market[]): string[] {
  const cats = new Set<string>()
  for (const m of markets) {
    if (m.category) cats.add(m.category)
  }
  return [...cats].sort()
}

function matchesSearch(market: Market, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    market.question.toLowerCase().includes(q) ||
    (market.category?.toLowerCase().includes(q) ?? false)
  )
}

function matchesSignalFilter(
  market: Market,
  signal: Signal | undefined,
  filter: SignalFilter
): boolean {
  switch (filter) {
    case "all":
      return true
    case "has-signal":
      return !!signal
    case "high-ev":
      return !!signal && Math.abs(signal.ev) >= 0.05
    case "bullish":
      return !!signal && signal.ev > 0
    case "bearish":
      return !!signal && signal.ev < 0
  }
}

function sortMarkets(
  markets: Market[],
  signalMap: Map<string, Signal>,
  mode: SortMode
): Market[] {
  return [...markets].sort((a, b) => {
    switch (mode) {
      case "alpha": {
        const evA = Math.abs(signalMap.get(a.id)?.ev ?? 0)
        const evB = Math.abs(signalMap.get(b.id)?.ev ?? 0)
        return evB - evA
      }
      case "volume":
        return b.volume - a.volume
      case "newest":
        return new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
      case "probability":
        return b.probability - a.probability
    }
  })
}

export default function MarketGrid() {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets()
  const { data: signalsData } = useSignals()
  const { data: health } = useHealth()
  const { data: watchlistData } = useWatchlist()
  const watchlistedIds = new Set(watchlistData?.marketIds ?? [])

  const [activeTab, setActiveTab] = useState<ViewTab>("markets")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("alpha")
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all")

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

  const allMarkets = marketsData?.markets ?? []
  const categories = useMemo(() => extractCategories(allMarkets), [allMarkets])

  const filteredMarkets = useMemo(() => {
    let markets = allMarkets

    if (selectedCategory) {
      markets = markets.filter((m) => m.category === selectedCategory)
    }

    markets = markets.filter((m) => matchesSearch(m, searchQuery))

    markets = markets.filter((m) =>
      matchesSignalFilter(m, signalsByMarket.get(m.id), signalFilter)
    )

    return sortMarkets(markets, signalsByMarket, sortMode)
  }, [allMarkets, selectedCategory, searchQuery, signalFilter, sortMode, signalsByMarket])

  const activeSignals = signalsData?.total ?? 0
  const marketsScanned = marketsData?.total ?? 0
  const highEv = signalsData?.signals.filter(
    (s) => s.confidence === "high"
  ).length ?? 0

  const hasActiveFilters = selectedCategory !== null || searchQuery !== "" || signalFilter !== "all"

  return (
    <div className="min-h-screen bg-darwin-bg">
      {/* Header */}
      <header className="border-b border-darwin-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/" className="text-lg font-semibold tracking-tight text-darwin-text hover:text-darwin-text-secondary transition-colors">
              DARWIN CAPITAL
            </a>
            <CompareLink />
          </div>
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
      </header>

      {/* Stats bar + View tabs */}
      <div className="border-b border-darwin-border px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <StatItem label="Active Signals" value={activeSignals} />
            <StatItem label="Markets Scanned" value={marketsScanned} />
            <StatItem label="High-EV" value={highEv} highlight />
          </div>
          <div className="flex items-center gap-0.5 border border-darwin-border">
            {VIEW_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setActiveTab(value)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase transition-colors",
                  activeTab === value
                    ? "bg-darwin-elevated text-darwin-text"
                    : "text-darwin-text-muted hover:text-darwin-text-secondary"
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter bar — only for markets view */}
      {activeTab === "markets" && (
        <div className="border-b border-darwin-border px-6 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-darwin-text-muted" />
              <input
                type="text"
                placeholder="Search markets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full bg-darwin-card pl-8 pr-8 text-xs text-darwin-text placeholder:text-darwin-text-muted border border-darwin-border outline-none focus:border-darwin-blue transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-darwin-text-muted hover:text-darwin-text"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              {SORT_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSortMode(value)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium uppercase transition-colors",
                    sortMode === value
                      ? "bg-darwin-elevated text-darwin-text"
                      : "text-darwin-text-muted hover:text-darwin-text-secondary"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            <span className="text-darwin-border">|</span>
            <div className="flex items-center gap-0.5">
              {SIGNAL_FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSignalFilter(value)}
                  className={cn(
                    "px-2.5 py-1.5 text-[11px] font-medium uppercase transition-colors",
                    signalFilter === value
                      ? "bg-darwin-elevated text-darwin-text"
                      : "text-darwin-text-muted hover:text-darwin-text-secondary"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {hasActiveFilters && (
              <>
                <span className="text-darwin-border">|</span>
                <button
                  onClick={() => {
                    setSearchQuery("")
                    setSelectedCategory(null)
                    setSignalFilter("all")
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] text-darwin-text-muted hover:text-darwin-text transition-colors"
                >
                  <X className="h-3 w-3" />
                  Clear
                </button>
              </>
            )}
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setSelectedCategory(null)}
                className={cn(
                  "shrink-0 px-3 py-1 text-[11px] font-medium transition-colors border",
                  selectedCategory === null
                    ? "border-darwin-text-secondary text-darwin-text bg-darwin-elevated"
                    : "border-darwin-border text-darwin-text-muted hover:text-darwin-text-secondary hover:border-darwin-text-muted"
                )}
              >
                All Categories
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setSelectedCategory(selectedCategory === cat ? null : cat)
                  }
                  className={cn(
                    "shrink-0 px-3 py-1 text-[11px] font-medium transition-colors border capitalize",
                    selectedCategory === cat
                      ? "border-darwin-blue text-darwin-blue bg-darwin-blue/10"
                      : "border-darwin-border text-darwin-text-muted hover:text-darwin-text-secondary hover:border-darwin-text-muted"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab content */}
      {activeTab === "markets" && (
        <>
          <div className="px-6 pt-4 pb-2">
            <span className="text-[11px] text-darwin-text-muted">
              {filteredMarkets.length} market{filteredMarkets.length !== 1 ? "s" : ""}
              {hasActiveFilters ? " (filtered)" : ""}
            </span>
          </div>
          <main className="px-6 pb-6">
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
            ) : filteredMarkets.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm text-darwin-text-muted">
                  No markets match your filters.
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setSelectedCategory(null)
                      setSignalFilter("all")
                    }}
                    className="mt-2 text-xs text-darwin-blue hover:text-darwin-blue/80 transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredMarkets.map((market) => (
                  <MarketCard
                    key={market.id}
                    market={market}
                    signal={signalsByMarket.get(market.id)}
                    watchlisted={watchlistedIds.has(market.id)}
                  />
                ))}
              </div>
            )}
          </main>
        </>
      )}

      {activeTab === "heatmap" && (
        <main className="px-6 py-4">
          <HeatMatrix markets={allMarkets} signalMap={signalsByMarket} />
        </main>
      )}

      {activeTab === "signals" && (
        <main className="px-6 py-4">
          <SignalTicker signals={signalsData?.signals ?? []} />
        </main>
      )}

      {activeTab === "scatter" && (
        <main className="px-6 py-4">
          <BubbleScatter markets={allMarkets} signalMap={signalsByMarket} />
        </main>
      )}

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
