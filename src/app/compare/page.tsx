"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Link2, Link2Off, Columns3, Rows3, LayoutGrid, PanelRightOpen, PanelRightClose } from "lucide-react"
import { useMarkets } from "@/hooks/use-markets"
import { useSignals } from "@/hooks/use-signals"
import { useAnalysis } from "@/hooks/use-analysis"
import { useFairValue } from "@/hooks/use-fair-value"
import { generateMockTimeSeries } from "@/lib/mock-timeseries"
import type { ComparePanel as ComparePanelData } from "@/lib/mock-timeseries"
import type { Market, Signal } from "@/lib/types"
import { ComparePanel } from "@/components/compare-panel"
import { MarketSearchModal, type SelectMode } from "@/components/market-search-modal"
import { ResizableGrid, type GridLayout } from "@/components/resizable-grid"
import { AlphaBar } from "@/components/alpha-bar"
import { SignalBadge } from "@/components/signal-badge"
import { FairValueEditor } from "@/components/fair-value-editor"
import { AnalysisFeed, type FeedEntry } from "@/components/analysis-feed"
import { QueryInterface } from "@/components/query-interface"
import { formatProbability, formatEV, relativeTime } from "@/lib/format"
import { cn } from "@/lib/utils"

interface PanelSlot {
  primaryId: string
  overlayIds: string[]
}

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

type ModalMode =
  | { type: "new-pane" }
  | { type: "overlay"; panelIndex: number }
  | { type: "swap"; panelIndex: number }
  | null

// ---------------------------------------------------------------------------
// Demo mode data — used when ?demo=true is present in the URL
// ---------------------------------------------------------------------------

const DEMO_MARKETS: Market[] = [
  {
    id: "demo-italy-wc2026",
    platform: "polymarket",
    question: "Will Italy qualify for the 2026 FIFA World Cup?",
    probability: 0.635,
    volume: 1_240_000,
    liquidity: 320_000,
    endDate: "2025-11-18",
    url: "https://polymarket.com",
    category: "Sports",
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "demo-sweden-wc2026",
    platform: "polymarket",
    question: "Will Sweden qualify for the 2026 FIFA World Cup?",
    probability: 0.275,
    volume: 680_000,
    liquidity: 180_000,
    endDate: "2025-11-18",
    url: "https://polymarket.com",
    category: "Sports",
    lastUpdated: new Date().toISOString(),
  },
]

const DEMO_SIGNALS: Signal[] = [
  {
    id: "demo-signal-italy",
    marketId: "demo-italy-wc2026",
    marketQuestion: "Will Italy qualify for the 2026 FIFA World Cup?",
    darwinEstimate: 0.611,
    marketPrice: 0.635,
    ev: -0.024,
    direction: "no",
    reasoning:
      "Despite Italy's strong Nations League campaign, recent qualifying draw analysis and opponent strength metrics suggest the market has modestly overpriced their probability. Key fixtures against top UEFA seeds remain.",
    newsEvents: [
      "Italy draws Spain in UEFA Nations League semifinal",
      "2026 World Cup European qualifying draw announced",
    ],
    confidence: "medium",
    createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "demo-signal-sweden",
    marketId: "demo-sweden-wc2026",
    marketQuestion: "Will Sweden qualify for the 2026 FIFA World Cup?",
    darwinEstimate: 0.298,
    marketPrice: 0.275,
    ev: 0.023,
    direction: "yes",
    reasoning:
      "Sweden's group path appears more favourable than the market implies. Improved form under new management and a historically strong home record suggest market is underpricing their qualifying probability.",
    newsEvents: [
      "Sweden beats Norway 2-0 in Nordic Cup",
      "Alexander Isak returns from injury ahead of qualifiers",
    ],
    confidence: "medium",
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  },
]

export default function ComparePage() {
  const searchParams = useSearchParams()
  const isDemo = searchParams.get("demo") === "true"

  const { data: marketsData, isLoading: marketsLoading } = useMarkets()
  const { data: signalsData } = useSignals()
  const analysis = useAnalysis()
  const [syncCrosshair, setSyncCrosshair] = useState(false)
  const [gridLayout, setGridLayout] = useState<GridLayout>("auto")
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number | null>(null)
  const [feedEntries, setFeedEntries] = useState<Map<string, FeedEntry[]>>(new Map())

  const signalMap = useMemo(() => {
    if (isDemo) {
      const map = new Map<string, Signal>()
      for (const s of DEMO_SIGNALS) {
        map.set(s.marketId, s)
      }
      return map
    }
    const map = new Map<string, Signal>()
    if (signalsData?.signals) {
      for (const s of signalsData.signals) {
        map.set(s.marketId, s)
      }
    }
    return map
  }, [isDemo, signalsData])

  const allMarkets = isDemo ? DEMO_MARKETS : (marketsData?.markets ?? [])

  const marketById = useMemo(() => {
    const map = new Map<string, Market>()
    for (const m of allMarkets) {
      map.set(m.id, m)
    }
    return map
  }, [allMarkets])

  // Positional slots: each index is a grid cell
  const [slots, setSlots] = useState<(PanelSlot | null)[]>(
    isDemo
      ? [
          { primaryId: DEMO_MARKETS[0].id, overlayIds: [] },
          { primaryId: DEMO_MARKETS[1].id, overlayIds: [] },
        ]
      : []
  )

  // Handle ?add=marketId from URL on first load
  const addParam = searchParams.get("add")
  const [initialAddHandled, setInitialAddHandled] = useState(false)
  useEffect(() => {
    if (addParam && !initialAddHandled && allMarkets.length > 0) {
      setInitialAddHandled(true)
      setSlots((prev) => {
        if (prev.some((s) => s?.primaryId === addParam)) return prev
        const emptyIdx = prev.indexOf(null)
        const newSlot: PanelSlot = { primaryId: addParam, overlayIds: [] }
        if (emptyIdx !== -1) {
          const next = [...prev]
          next[emptyIdx] = newSlot
          // Auto-select this panel and show analysis if it has a signal
          setSelectedPanelIndex(emptyIdx)
          if (signalMap.has(addParam)) setShowAnalysis(true)
          return next
        }
        const newSlots = [...prev, newSlot]
        setSelectedPanelIndex(newSlots.length - 1)
        if (signalMap.has(addParam)) setShowAnalysis(true)
        return newSlots
      })
    }
  }, [addParam, initialAddHandled, allMarkets, signalMap])

  // Demo mode: auto-select first panel and open analysis sidebar on mount
  useEffect(() => {
    if (!isDemo) return
    setSelectedPanelIndex(0)
    setShowAnalysis(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo])

  const filledCount = useMemo(() => slots.filter((s) => s !== null).length, [slots])
  const totalSlots = useMemo(() => gridSlotsFor(filledCount), [filledCount])

  // Ensure slots array is always the right length
  const normalizedSlots = useMemo(() => {
    if (gridLayout !== "auto") {
      return slots.filter((s) => s !== null)
    }
    const result = [...slots]
    while (result.length < totalSlots) result.push(null)
    while (result.length > totalSlots && result[result.length - 1] === null) {
      result.pop()
    }
    return result
  }, [slots, totalSlots, gridLayout])

  // Build panels from slots
  const slotPanels = useMemo(() => {
    return normalizedSlots.map((slot) => {
      if (!slot) return null
      const market = marketById.get(slot.primaryId)
      if (!market) return null
      return buildPanel(market, signalMap)
    })
  }, [normalizedSlots, marketById, signalMap])

  // Drag state
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Search modal
  const [modalMode, setModalMode] = useState<ModalMode>(null)

  // All market IDs currently in use (primary + overlays)
  const currentMarketIds = useMemo(() => {
    const ids: string[] = []
    for (const slot of normalizedSlots) {
      if (slot) {
        ids.push(slot.primaryId)
        ids.push(...slot.overlayIds)
      }
    }
    return ids
  }, [normalizedSlots])

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
      setSlots((prev) => {
        const next = [...prev]
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
    setModalMode({ type: "swap", panelIndex: index })
  }, [])

  const handleRemove = useCallback((index: number) => {
    setSlots((prev) => {
      const next = [...prev]
      next[index] = null
      while (next.length > 0 && next[next.length - 1] === null) {
        next.pop()
      }
      return next
    })
    if (selectedPanelIndex === index) {
      setSelectedPanelIndex(null)
    }
  }, [selectedPanelIndex])

  const handleRemoveOverlay = useCallback((panelIndex: number, marketId: string) => {
    setSlots((prev) => {
      const next = [...prev]
      const slot = next[panelIndex]
      if (!slot) return prev
      next[panelIndex] = {
        ...slot,
        overlayIds: slot.overlayIds.filter((id) => id !== marketId),
      }
      return next
    })
  }, [])

  const handleAddOverlay = useCallback((panelIndex: number) => {
    setModalMode({ type: "overlay", panelIndex })
  }, [])

  const handleSelectMarket = useCallback(
    (market: Market, mode: SelectMode) => {
      if (!modalMode) return

      if (mode === "overlay" && modalMode.type === "overlay") {
        // Add as overlay to the specified panel
        setSlots((prev) => {
          const next = [...prev]
          const slot = next[modalMode.panelIndex]
          if (!slot) return prev
          if (slot.overlayIds.includes(market.id) || slot.primaryId === market.id) return prev
          next[modalMode.panelIndex] = {
            ...slot,
            overlayIds: [...slot.overlayIds, market.id],
          }
          return next
        })
      } else if (mode === "overlay" && (modalMode.type === "new-pane" || modalMode.type === "swap")) {
        // Default click in new-pane/swap mode when hasPanels → overlay on selected panel
        if (selectedPanelIndex !== null) {
          setSlots((prev) => {
            const next = [...prev]
            const slot = next[selectedPanelIndex]
            if (!slot) return prev
            if (slot.overlayIds.includes(market.id) || slot.primaryId === market.id) return prev
            next[selectedPanelIndex] = {
              ...slot,
              overlayIds: [...slot.overlayIds, market.id],
            }
            return next
          })
        } else {
          // No selected panel, add as new pane instead
          addAsNewPane(market)
        }
      } else if (mode === "new-pane") {
        if (modalMode.type === "swap" && typeof modalMode.panelIndex === "number") {
          // Swap: replace the primary of the target panel
          setSlots((prev) => {
            const next = [...prev]
            while (next.length <= modalMode.panelIndex) next.push(null)
            next[modalMode.panelIndex] = { primaryId: market.id, overlayIds: [] }
            return next
          })
        } else {
          addAsNewPane(market)
        }
      }
      setModalMode(null)
    },
    [modalMode, selectedPanelIndex]
  )

  const addAsNewPane = useCallback((market: Market) => {
    setSlots((prev) => {
      if (prev.some((s) => s?.primaryId === market.id)) return prev
      const emptyIdx = prev.indexOf(null)
      const newSlot: PanelSlot = { primaryId: market.id, overlayIds: [] }
      if (emptyIdx !== -1) {
        const next = [...prev]
        next[emptyIdx] = newSlot
        return next
      }
      if (prev.filter((s) => s !== null).length >= 8) return prev
      return [...prev, newSlot]
    })
  }, [])

  // Analysis sidebar
  const selectedSlot = selectedPanelIndex !== null ? normalizedSlots[selectedPanelIndex] : null
  const selectedMarket = selectedSlot ? marketById.get(selectedSlot.primaryId) : null
  const selectedSignal = selectedMarket ? signalMap.get(selectedMarket.id) ?? null : null
  const selectedFv = useFairValue(
    selectedMarket?.id ?? "",
    selectedSignal?.darwinEstimate ?? undefined
  )

  const selectedFeedEntries = useMemo(() => {
    if (!selectedMarket) return []
    return feedEntries.get(selectedMarket.id) ?? []
  }, [selectedMarket, feedEntries])

  const initialFeedEntries = useMemo<FeedEntry[]>(() => {
    if (!selectedSignal) return []
    return [{ type: "signal", signal: selectedSignal }]
  }, [selectedSignal])

  const allEntries = useMemo(() => {
    return [...selectedFeedEntries, ...initialFeedEntries]
  }, [selectedFeedEntries, initialFeedEntries])

  const isBullish = selectedSignal && selectedSignal.ev > 0

  function handleAnalyze(query: string) {
    if (!selectedMarket) return
    const now = new Date().toISOString()
    const marketId = selectedMarket.id

    setFeedEntries((prev) => {
      const next = new Map(prev)
      const existing = next.get(marketId) ?? []
      next.set(marketId, [
        { type: "user_query", text: query, timestamp: now },
        ...existing,
      ])
      return next
    })

    analysis.mutate(marketId, {
      onSuccess: (result) => {
        const newEntries: FeedEntry[] = []
        for (const tc of result.toolCalls) {
          newEntries.push({ type: "tool_call", toolCall: tc })
        }
        if (result.signal) {
          newEntries.push({ type: "signal", signal: result.signal })
        }
        setFeedEntries((prev) => {
          const next = new Map(prev)
          const existing = next.get(marketId) ?? []
          next.set(marketId, [...newEntries, ...existing])
          return next
        })
      },
      onError: (err) => {
        setFeedEntries((prev) => {
          const next = new Map(prev)
          const existing = next.get(marketId) ?? []
          next.set(marketId, [
            { type: "error", message: err.message, timestamp: new Date().toISOString() },
            ...existing,
          ])
          return next
        })
      },
    })
  }

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
              onClick={() => setModalMode({ type: "new-pane" })}
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
        <div className="flex items-center gap-2">
          {filledCount > 0 && (
            <button
              onClick={() => setShowAnalysis((p) => !p)}
              className={cn(
                "flex items-center gap-1.5 border px-2.5 py-1 text-xs transition-colors",
                showAnalysis
                  ? "border-darwin-blue/50 text-darwin-blue"
                  : "border-darwin-border text-darwin-text-secondary hover:border-darwin-text-muted hover:text-darwin-text"
              )}
              title={showAnalysis ? "Hide analysis panel" : "Show analysis panel"}
            >
              {showAnalysis ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              Analysis
            </button>
          )}
          {!isDemo && (
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-xs text-darwin-text-secondary transition-colors hover:text-darwin-text"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Grid
            </Link>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chart panels */}
        <div className="flex-1 min-w-0">
          {marketsLoading && !isDemo ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs text-darwin-text-muted animate-pulse">
                Loading markets...
              </span>
            </div>
          ) : filledCount === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <p className="text-sm text-darwin-text-muted">
                No markets added yet.
              </p>
              <button
                onClick={() => setModalMode({ type: "new-pane" })}
                className="flex items-center gap-2 border border-darwin-border px-4 py-2 text-sm text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
              >
                <Plus className="h-4 w-4" />
                Add Market
              </button>
            </div>
          ) : (
            <ResizableGrid layout={gridLayout}>
              {normalizedSlots.map((slot, i) => {
                const panel = slotPanels[i]
                const isVerticalSync = gridLayout === "vertical" && syncCrosshair
                const lastFilledIdx = normalizedSlots.reduce((last, s, idx) => s !== null ? idx : last, -1)
                const shouldHideTime = isVerticalSync && i !== lastFilledIdx

                // Get overlay markets for this panel
                const overlayMarkets = slot
                  ? slot.overlayIds
                      .map((id) => marketById.get(id))
                      .filter((m): m is Market => !!m)
                  : []

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
                      hideTimeScale={shouldHideTime}
                      overlayMarkets={overlayMarkets}
                      onRemoveOverlay={(id) => handleRemoveOverlay(i, id)}
                      onAddOverlay={() => handleAddOverlay(i)}
                      isSelected={selectedPanelIndex === i}
                      onSelect={() => setSelectedPanelIndex(i)}
                    />
                  )
                }
                // Empty slot
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
                      onClick={() => setModalMode({ type: "swap", panelIndex: i })}
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
        </div>

        {/* Analysis sidebar */}
        {showAnalysis && (
          <div className="flex w-[380px] shrink-0 flex-col border-l border-darwin-border">
            {selectedMarket ? (
              <>
                {/* Header */}
                <div className="border-b border-darwin-border px-4 py-3">
                  <h2 className="text-sm font-medium text-darwin-text">
                    Darwin Analysis
                  </h2>
                  <p className="mt-0.5 text-[11px] text-darwin-text-muted truncate">
                    {selectedMarket.question}
                  </p>
                </div>

                {/* Signal summary */}
                {selectedSignal && (
                  <div className="border-b border-darwin-border px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="label-caps">Signal</span>
                      <span className="text-[10px] text-darwin-text-muted">
                        {relativeTime(selectedSignal.createdAt)}
                      </span>
                    </div>
                    <AlphaBar
                      darwinEstimate={selectedSignal.darwinEstimate}
                      marketPrice={selectedSignal.marketPrice}
                      size="md"
                    />
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <span className="block label-caps !text-[9px]">Market</span>
                        <span className="font-data text-sm text-darwin-text">
                          {formatProbability(selectedSignal.marketPrice)}
                        </span>
                      </div>
                      <div>
                        <span className="block label-caps !text-[9px]">Darwin</span>
                        <span className={cn(
                          "font-data text-sm",
                          isBullish ? "text-darwin-green" : "text-darwin-red"
                        )}>
                          {formatProbability(selectedSignal.darwinEstimate)}
                        </span>
                      </div>
                      <div>
                        <span className="block label-caps !text-[9px]">EV</span>
                        <span className={cn(
                          "font-data text-sm font-medium",
                          isBullish ? "text-darwin-green" : "text-darwin-red"
                        )}>
                          {formatEV(selectedSignal.ev)}
                        </span>
                      </div>
                    </div>
                    <div className="border-t border-darwin-border pt-2">
                      <FairValueEditor
                        fairValue={selectedFv.fairValue}
                        isCustom={selectedFv.isCustom}
                        onSave={selectedFv.setFairValue}
                        onReset={selectedFv.clearFairValue}
                      />
                    </div>
                  </div>
                )}

                {/* Analysis feed */}
                <div className="flex-1 overflow-y-auto">
                  <AnalysisFeed
                    entries={allEntries}
                    analyzing={analysis.isPending}
                  />
                  {allEntries.length === 0 && !analysis.isPending && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-darwin-text-muted">
                        Ask Darwin to analyze this market.
                      </p>
                    </div>
                  )}
                </div>

                {/* Query input */}
                <div className="border-t border-darwin-border p-3">
                  <QueryInterface
                    onSubmit={handleAnalyze}
                    loading={analysis.isPending}
                  />
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-darwin-text-muted px-4 text-center">
                  Click a panel to select it for analysis
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search modal */}
      <MarketSearchModal
        open={modalMode !== null}
        onClose={() => setModalMode(null)}
        onSelect={handleSelectMarket}
        currentMarketIds={currentMarketIds}
        markets={allMarkets}
        loading={marketsLoading}
        hasPanels={filledCount > 0}
      />
    </div>
  )
}
