"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Search, X, Check, Loader2, PanelRight } from "lucide-react"
import { formatProbability, formatVolume } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Market } from "@/lib/types"

export type SelectMode = "overlay" | "new-pane"

interface MarketSearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (market: Market, mode: SelectMode) => void
  currentMarketIds: string[]
  markets: Market[]
  loading?: boolean
  /** When true, show "New pane" button on each row */
  hasPanels?: boolean
}

export function MarketSearchModal({
  open,
  onClose,
  onSelect,
  currentMarketIds,
  markets,
  loading,
  hasPanels = false,
}: MarketSearchModalProps) {
  const [query, setQuery] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery("")
      const t = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [open])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose]
  )

  const filtered = useMemo(() => {
    if (!query) return markets
    const q = query.toLowerCase()
    return markets.filter(
      (m) =>
        m.question.toLowerCase().includes(q) ||
        (m.category ?? "").toLowerCase().includes(q)
    )
  }, [markets, query])

  const alreadyAdded = useMemo(
    () => new Set(currentMarketIds),
    [currentMarketIds]
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh]"
      onClick={onClose}
    >
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative z-10 w-full max-w-xl border border-darwin-border bg-darwin-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-darwin-border px-4 py-3">
          <span className="text-sm font-medium text-darwin-text">
            {hasPanels ? "Overlay or add market" : "Add market"}
          </span>
          <button
            onClick={onClose}
            className="text-darwin-text-muted transition-colors hover:text-darwin-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2 border-b border-darwin-border px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-darwin-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search markets..."
            className="w-full bg-transparent text-sm text-darwin-text placeholder:text-darwin-text-muted outline-none"
          />
          {loading && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-darwin-text-muted" />
          )}
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {loading && markets.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-darwin-text-muted">
              Loading markets from Polymarket...
            </div>
          ) : (
            <>
              {/* Currently added */}
              {filtered.some((m) => alreadyAdded.has(m.id)) && (
                <>
                  <div className="px-4 pt-3 pb-1.5">
                    <span className="label-caps">Added markets</span>
                  </div>
                  {filtered
                    .filter((m) => alreadyAdded.has(m.id))
                    .map((market) => (
                      <MarketRow
                        key={market.id}
                        market={market}
                        added
                        onSelect={onSelect}
                        hasPanels={hasPanels}
                      />
                    ))}
                </>
              )}

              {/* Available */}
              {filtered.some((m) => !alreadyAdded.has(m.id)) && (
                <>
                  <div className="px-4 pt-3 pb-1.5">
                    <span className="label-caps">Available markets</span>
                  </div>
                  {filtered
                    .filter((m) => !alreadyAdded.has(m.id))
                    .map((market) => (
                      <MarketRow
                        key={market.id}
                        market={market}
                        added={false}
                        onSelect={onSelect}
                        hasPanels={hasPanels}
                      />
                    ))}
                </>
              )}

              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-darwin-text-muted">
                  No markets found
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MarketRow({
  market,
  added,
  onSelect,
  hasPanels,
}: {
  market: Market
  added: boolean
  onSelect: (m: Market, mode: SelectMode) => void
  hasPanels: boolean
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
        added
          ? "opacity-50 cursor-default"
          : "hover:bg-darwin-hover"
      )}
    >
      <button
        onClick={() => {
          if (!added) onSelect(market, hasPanels ? "overlay" : "new-pane")
        }}
        disabled={added}
        className="min-w-0 flex-1 text-left cursor-pointer disabled:cursor-default"
      >
        <p className="truncate text-sm text-darwin-text">{market.question}</p>
        <div className="mt-0.5 flex items-center gap-3">
          {market.category && (
            <span className="text-[11px] text-darwin-text-muted uppercase">
              {market.category}
            </span>
          )}
          <span className="font-data text-[11px] text-darwin-text-secondary">
            Vol {formatVolume(market.volume)}
          </span>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-data text-sm text-darwin-text">
          {formatProbability(market.probability)}
        </span>
        {added ? (
          <Check className="h-3.5 w-3.5 text-darwin-green" />
        ) : hasPanels ? (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onSelect(market, "new-pane")
            }}
            className="flex items-center gap-1 border border-darwin-border px-1.5 py-0.5 text-[10px] text-darwin-text-muted hover:text-darwin-text hover:border-darwin-text-muted transition-colors"
            title="Add as new panel"
          >
            <PanelRight className="h-2.5 w-2.5" />
            New pane
          </button>
        ) : null}
      </div>
    </div>
  )
}
