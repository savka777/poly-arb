"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Link2, Link2Off, Columns3, Rows3, LayoutGrid } from "lucide-react"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import { generateMockTimeSeries } from "@/lib/mock-timeseries"
import type { ComparePanel as ComparePanelData } from "@/lib/mock-timeseries"
import type { Market, Signal } from "@/lib/types"
import { ComparePanel } from "@/components/compare-panel"
import { MarketSearchModal } from "@/components/market-search-modal"
import { ResizableGrid, type GridLayout } from "@/components/resizable-grid"
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

/** How many grid slots for a given number of filled panels */
function gridSlotsFor(filledCount: number): number {
  if (filledCount <= 1) return 1
  if (filledCount <= 2) return 2
  if (filledCount <= 4) return 4
  if (filledCount <= 6) return 6
  return 8
}

export default function ComparePage() {
  const searchParams = useSearchParams()
  const { data: marketsData, isLoading: marketsLoading } = useMarkets()
  const { data: signalsData } = useSignals()
  const [syncCrosshair, setSyncCrosshair] = useState(false)
  const [gridLayout, setGridLayout] = useState<GridLayout>("auto")

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

  // Positional slots: each index is a grid cell, value is marketId or null
  const [slots, setSlots] = useState<(string | null)[]>([])

  // Handle ?add=marketId from URL on first load
  const addParam = searchParams.get("add")
  const [initialAddHandled, setInitialAddHandled] = useState(false)
  useEffect(() => {
    if (addParam && !initialAddHandled && allMarkets.length > 0) {
      setInitialAddHandled(true)
      setSlots((prev) => {
        if (prev.includes(addParam)) return prev
        // Place in first empty slot, or append
        const emptyIdx = prev.indexOf(null)
        if (emptyIdx !== -1) {
          const next = [...prev]
          next[emptyIdx] = addParam
          return next
        }
        return [...prev, addParam]
      })
    }
  }, [addParam, initialAddHandled, allMarkets])

  const filledCount = useMemo(() => slots.filter((s) => s !== null).length, [slots])
  const totalSlots = useMemo(() => gridSlotsFor(filledCount), [filledCount])

  // Ensure slots array is always the right length
  const normalizedSlots = useMemo(() => {
    // In horizontal/vertical mode, only show filled slots (no empty placeholders)
    if (gridLayout !== "auto") {
      return slots.filter((s) => s !== null)
    }
    const result = [...slots]
    // Pad to totalSlots
    while (result.length < totalSlots) result.push(null)
    // Trim trailing nulls beyond totalSlots (but keep ones in the middle)
    while (result.length > totalSlots && result[result.length - 1] === null) {
      result.pop()
    }
    return result
  }, [slots, totalSlots, gridLayout])

  // Build panels from slots
  const slotPanels = useMemo(() => {
    return normalizedSlots.map((id) => {
      if (!id) return null
      const market = marketById.get(id)
      if (!market) return null
      return buildPanel(market, signalMap)
    })
  }, [normalizedSlots, marketById, signalMap])

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Search modal: null = closed, "add" = first empty slot, number = specific slot
  const [modalMode, setModalMode] = useState<"add" | number | null>(null)

  const currentMarketIds = useMemo(
    () => normalizedSlots.filter((s): s is string => s !== null),
    [normalizedSlots]
  )

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

  // Drop: swap the two slots (works for both filled and empty targets)
  const handleDrop = useCallback(
    (targetIdx: number) => {
      if (dragIdx === null || dragIdx === targetIdx) return
      setSlots((prev) => {
        const next = [...prev]
        // Pad if needed
        while (next.length <= Math.max(dragIdx, targetIdx)) next.push(null)
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

  const handleSwap = useCallback((index: number) => {
    setModalMode(index)
  }, [])

  const handleRemove = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev]
      next[index] = null
      // If all trailing slots are null, trim them
      while (next.length > 0 && next[next.length - 1] === null) {
        next.pop()
      }
      return next
    })
  }, [])

  const handleSelectMarket = useCallback(
    (market: Market) => {
      if (modalMode === "add") {
        setSlots((prev) => {
          if (prev.includes(market.id)) return prev
          // Find first null slot
          const emptyIdx = prev.indexOf(null)
          if (emptyIdx !== -1) {
            const next = [...prev]
            next[emptyIdx] = market.id
            return next
          }
          if (prev.filter((s) => s !== null).length >= 8) return prev
          return [...prev, market.id]
        })
      } else if (typeof modalMode === "number") {
        setSlots((prev) => {
          const next = [...prev]
          while (next.length <= modalMode) next.push(null)
          next[modalMode] = market.id
          return next
        })
      }
      setModalMode(null)
    },
    [modalMode]
  )

  const canAdd = filledCount < 8

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

          {filledCount > 1 && (
            <>
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
              <div className="flex items-center border border-darwin-border">
                <button
                  onClick={() => setGridLayout("auto")}
                  className={cn(
                    "p-1 text-[11px] transition-colors",
                    gridLayout === "auto"
                      ? "bg-darwin-hover text-darwin-text"
                      : "text-darwin-text-muted hover:text-darwin-text-secondary"
                  )}
                  title="Grid layout"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setGridLayout("horizontal")}
                  className={cn(
                    "p-1 text-[11px] transition-colors",
                    gridLayout === "horizontal"
                      ? "bg-darwin-hover text-darwin-text"
                      : "text-darwin-text-muted hover:text-darwin-text-secondary"
                  )}
                  title="Horizontal layout"
                >
                  <Columns3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setGridLayout("vertical")}
                  className={cn(
                    "p-1 text-[11px] transition-colors",
                    gridLayout === "vertical"
                      ? "bg-darwin-hover text-darwin-text"
                      : "text-darwin-text-muted hover:text-darwin-text-secondary"
                  )}
                  title="Vertical layout"
                >
                  <Rows3 className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
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

          {filledCount > 0 && (
            <span className="text-[11px] text-darwin-text-muted">
              {filledCount} panel{filledCount !== 1 ? "s" : ""}
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
      ) : filledCount === 0 ? (
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
        <ResizableGrid layout={gridLayout}>
          {normalizedSlots.map((slotId, i) => {
            const panel = slotPanels[i]
            if (panel) {
              return (
                <ComparePanel
                  key={`slot-${i}`}
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
              )
            }
            // Empty slot — drop target + add button
            return (
              <div
                key={`slot-${i}`}
                className={cn(
                  "flex h-full w-full items-center justify-center border border-dashed border-darwin-border/50 bg-darwin-bg transition-colors",
                  dragOverIdx === i && "ring-2 ring-inset ring-darwin-blue/50 bg-darwin-blue/5"
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = "move"
                  if (dragIdx !== null) setDragOverIdx(i)
                }}
                onDragLeave={() => {
                  if (dragOverIdx === i) setDragOverIdx(null)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  handleDrop(i)
                }}
              >
                <button
                  onClick={() => setModalMode(i)}
                  className="flex flex-col items-center gap-2 text-darwin-text-muted hover:text-darwin-text-secondary transition-colors"
                >
                  <Plus className="h-6 w-6" />
                  <span className="text-xs">Add Market</span>
                </button>
              </div>
            )
          })}
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
