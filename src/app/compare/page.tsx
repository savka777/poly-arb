"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, X, Link2, Link2Off } from "lucide-react"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import { generateMockTimeSeries } from "@/lib/mock-timeseries"
import type { ComparePanel as ComparePanelData } from "@/lib/mock-timeseries"
import type { Market, Signal } from "@/lib/types"
import { ComparePanel } from "@/components/compare-panel"
import { MarketSearchModal } from "@/components/market-search-modal"
import { ResizableGrid } from "@/components/resizable-grid"
import { cn } from "@/lib/utils"

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
  const searchParams = useSearchParams()
  const { data: marketsData, isLoading: marketsLoading } = useMarkets()
  const { data: signalsData } = useSignals()
  const [syncCrosshair, setSyncCrosshair] = useState(false)

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

  const marketById = useMemo(() => {
    const map = new Map<string, Market>()
    for (const m of allMarkets) {
      map.set(m.id, m)
    }
    return map
  }, [allMarkets])

  // Panel state: explicitly added market IDs (starts empty)
  const [panelMarketIds, setPanelMarketIds] = useState<string[]>([])

  // Handle ?add=marketId from URL on first load
  const addParam = searchParams.get("add")
  const [initialAddHandled, setInitialAddHandled] = useState(false)
  useEffect(() => {
    if (addParam && !initialAddHandled && allMarkets.length > 0) {
      setInitialAddHandled(true)
      setPanelMarketIds((prev) => {
        if (prev.includes(addParam)) return prev
        return [...prev, addParam]
      })
    }
  }, [addParam, initialAddHandled, allMarkets])

  const panels = useMemo(() => {
    return panelMarketIds
      .map((id) => {
        const market = marketById.get(id)
        if (!market) return null
        return buildPanel(market, signalMap)
      })
      .filter((p): p is ComparePanelData => p !== null)
  }, [panelMarketIds, marketById, signalMap])

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Search modal state — null = closed, "add" = adding new, number = swapping that index
  const [modalMode, setModalMode] = useState<"add" | number | null>(null)

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
        const next = [...prev]
        const temp = next[dragIdx]
        next[dragIdx] = next[targetIdx]
        next[targetIdx] = temp
        return next
      })
      setDragIdx(null)
      setDragOverIdx(null)
    },
    [dragIdx]
  )

  // Swap market in a panel
  const handleSwap = useCallback((index: number) => {
    setModalMode(index)
  }, [])

  // Remove a panel
  const handleRemove = useCallback((index: number) => {
    setPanelMarketIds((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const handleSelectMarket = useCallback(
    (market: Market) => {
      if (modalMode === "add") {
        // Add new panel
        setPanelMarketIds((prev) => {
          if (prev.includes(market.id)) return prev
          if (prev.length >= 8) return prev // max 8
          return [...prev, market.id]
        })
      } else if (typeof modalMode === "number") {
        // Swap existing panel
        setPanelMarketIds((prev) => {
          const next = [...prev]
          next[modalMode] = market.id
          return next
        })
      }
      setModalMode(null)
    },
    [modalMode]
  )

  const canAdd = panels.length < 8

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

          {panels.length > 1 && (
            <button
              onClick={() => setSyncCrosshair((p) => !p)}
              className={cn(
                "flex items-center gap-1 border border-darwin-border px-2 py-1 text-[11px] transition-colors",
                syncCrosshair
                  ? "border-darwin-blue/50 text-darwin-blue"
                  : "text-darwin-text-muted hover:text-darwin-text-secondary"
              )}
              title="Sync crosshair across panels"
            >
              {syncCrosshair ? <Link2 className="h-3 w-3" /> : <Link2Off className="h-3 w-3" />}
              Sync
            </button>
          )}

          {canAdd && (
            <button
              onClick={() => setModalMode("add")}
              className="flex items-center gap-1 border border-darwin-border px-2 py-1 text-[11px] text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
            >
              <Plus className="h-3 w-3" />
              Add Market
            </button>
          )}

          {panels.length > 0 && (
            <span className="text-[11px] text-darwin-text-muted">
              {panels.length} panel{panels.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs text-darwin-text-secondary transition-colors hover:text-darwin-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Grid
        </Link>
      </header>

      {/* Content */}
      {marketsLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-xs text-darwin-text-muted animate-pulse">
            Loading markets...
          </span>
        </div>
      ) : panels.length === 0 ? (
        /* Empty state */
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-darwin-text-muted">
            No markets added yet.
          </p>
          <button
            onClick={() => setModalMode("add")}
            className="flex items-center gap-2 border border-darwin-border px-4 py-2 text-sm text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
          >
            <Plus className="h-4 w-4" />
            Add Market
          </button>
        </div>
      ) : (
        <ResizableGrid>
          {panels.map((panel, i) => (
            <ComparePanel
              key={panel.market.id}
              panel={panel}
              index={i}
              onSwap={handleSwap}
              onRemove={handleRemove}
              dragging={dragIdx === i}
              dragOver={dragOverIdx === i}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              syncCrosshair={syncCrosshair}
            />
          ))}
        </ResizableGrid>
      )}

      {/* Search modal */}
      <MarketSearchModal
        open={modalMode !== null}
        onClose={() => setModalMode(null)}
        onSelect={handleSelectMarket}
        currentMarketIds={currentMarketIds}
        markets={allMarkets}
        loading={marketsLoading}
      />
    </div>
  )
}
