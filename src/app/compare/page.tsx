"use client"

import { useState, useMemo, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Plus } from "lucide-react"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import { generateMockTimeSeries } from "@/lib/mock-timeseries"
import type { ComparePanel as ComparePanelData } from "@/lib/mock-timeseries"
import type { Market, Signal } from "@/lib/types"
import { ComparePanel } from "@/components/compare-panel"
import { MarketSearchModal } from "@/components/market-search-modal"

function buildPanel(
  market: Market,
  signalMap: Map<string, Signal>
): ComparePanelData {
  const signal = signalMap.get(market.id) ?? null
  return {
    market,
    signal,
    timeSeries: generateMockTimeSeries(market, signal),
  }
}

export default function ComparePage() {
  const { data: marketsData, isLoading: marketsLoading } = useMarkets()
  const { data: signalsData } = useSignals()

  const signalMap = useMemo(() => {
    const map = new Map<string, Signal>()
    if (signalsData?.signals) {
      for (const s of signalsData.signals) {
        map.set(s.marketId, s)
      }
    }
    return map
  }, [signalsData])

  const allMarkets = marketsData?.markets ?? []

  // Panel state: store market IDs, derive panels from current data
  const [panelMarketIds, setPanelMarketIds] = useState<string[] | null>(null)

  // Initialize with first 4 markets once data loads
  const activeIds = useMemo(() => {
    if (panelMarketIds) return panelMarketIds
    if (allMarkets.length === 0) return []
    return allMarkets.slice(0, 4).map((m) => m.id)
  }, [panelMarketIds, allMarkets])

  const marketById = useMemo(() => {
    const map = new Map<string, Market>()
    for (const m of allMarkets) {
      map.set(m.id, m)
    }
    return map
  }, [allMarkets])

  const panels = useMemo(() => {
    return activeIds
      .map((id) => {
        const market = marketById.get(id)
        if (!market) return null
        return buildPanel(market, signalMap)
      })
      .filter((p): p is ComparePanelData => p !== null)
  }, [activeIds, marketById, signalMap])

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Search modal state
  const [swapTarget, setSwapTarget] = useState<number | null>(null)

  const currentMarketIds = useMemo(
    () => panels.map((p) => p.market.id),
    [panels]
  )

  // Drag handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIdx(index)
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault()
      if (dragIdx !== null && dragIdx !== index) {
        setDragOverIdx(index)
      }
    },
    [dragIdx]
  )

  const handleDragEnd = useCallback(() => {
    setDragIdx(null)
    setDragOverIdx(null)
  }, [])

  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx === null || dragIdx === targetIdx) return
      setPanelMarketIds((prev) => {
        const ids = prev ?? activeIds
        const next = [...ids]
        const temp = next[dragIdx]
        next[dragIdx] = next[targetIdx]
        next[targetIdx] = temp
        return next
      })
      setDragIdx(null)
      setDragOverIdx(null)
    },
    [dragIdx, activeIds]
  )

  // Swap market in a panel
  const handleSwap = useCallback((index: number) => {
    setSwapTarget(index)
  }, [])

  const handleSelectMarket = useCallback(
    (market: Market) => {
      if (swapTarget === null) return
      setPanelMarketIds((prev) => {
        const ids = prev ?? [...activeIds]
        const next = [...ids]
        next[swapTarget] = market.id
        return next
      })
      setSwapTarget(null)
    },
    [swapTarget, activeIds]
  )

  return (
    <div className="flex h-screen flex-col bg-darwin-bg">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-darwin-border px-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold tracking-tight text-darwin-text">
            DARWIN CAPITAL
          </h1>
          <span className="text-xs font-medium tracking-wider text-darwin-text-secondary uppercase">
            Compare
          </span>
          <button
            onClick={() => setSwapTarget(panels.length > 0 ? 0 : null)}
            className="flex items-center gap-1 rounded-none border border-darwin-border px-2 py-1 text-[11px] text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
          >
            <Plus className="h-3 w-3" />
            Add Market
          </button>
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-darwin-text-secondary transition-colors hover:text-darwin-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Grid
        </Link>
      </header>

      {/* 2x2 grid */}
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-px bg-darwin-border">
        {marketsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-center bg-darwin-card">
              <span className="text-xs text-darwin-text-muted animate-pulse">
                Loading markets...
              </span>
            </div>
          ))
        ) : (
          panels.map((panel, i) => (
            <ComparePanel
              key={panel.market.id}
              panel={panel}
              index={i}
              onSwap={handleSwap}
              dragging={dragIdx === i}
              dragOver={dragOverIdx === i}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
            />
          ))
        )}
      </div>

      {/* Search modal */}
      <MarketSearchModal
        open={swapTarget !== null}
        onClose={() => setSwapTarget(null)}
        onSelect={handleSelectMarket}
        currentMarketIds={currentMarketIds}
        markets={allMarkets}
        loading={marketsLoading}
      />
    </div>
  )
}
