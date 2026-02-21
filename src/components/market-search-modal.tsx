"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { Search, X, Check, Loader2 } from "lucide-react"
import { formatProbability, formatVolume } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Market } from "@/lib/types"

interface MarketSearchModalProps {
  open: boolean
  onClose: () => void
  onSelect: (market: Market) => void
  currentMarketIds: string[]
  markets: Market[]
  loading?: boolean
}

export function MarketSearchModal({
  open,
  onClose,
  onSelect,
  currentMarketIds,
  markets,
  loading,
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
            Compare market
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
}: {
  market: Market
  added: boolean
  onSelect: (m: Market) => void
}) {
  return (
    <button
      onClick={() => {
        if (!added) onSelect(market)
      }}
      disabled={added}
      className={cn(
        "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors",
        added
          ? "opacity-50 cursor-default"
          : "hover:bg-darwin-hover cursor-pointer"
      )}
    >
      <div className="min-w-0 flex-1">
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
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-data text-sm text-darwin-text">
          {formatProbability(market.probability)}
        </span>
        {added && <Check className="h-3.5 w-3.5 text-darwin-green" />}
      </div>
    </button>
  )
}
