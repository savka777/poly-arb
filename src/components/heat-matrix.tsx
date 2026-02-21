"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { formatProbability, formatEV } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Market, Signal } from "@/lib/types"

interface HeatMatrixProps {
  markets: Market[]
  signalMap: Map<string, Signal>
}

function evToColor(ev: number): string {
  const abs = Math.min(Math.abs(ev), 0.5)
  const intensity = abs / 0.5
  if (ev > 0) {
    const r = Math.round(10 + intensity * 0)
    const g = Math.round(10 + intensity * 212)
    const b = Math.round(15 + intensity * 56)
    return `rgb(${r},${g},${b})`
  }
  const r = Math.round(10 + intensity * 255)
  const g = Math.round(10 + intensity * 20)
  const b = Math.round(15 + intensity * 20)
  return `rgb(${r},${g},${b})`
}

function evToTextColor(ev: number): string {
  const abs = Math.abs(ev)
  if (abs > 0.08) return "#FFFFFF"
  return "#888899"
}

// --- Squarified treemap layout ---

interface TreemapRect {
  x: number
  y: number
  w: number
  h: number
}

interface TreemapItem {
  id: string
  value: number
  rect: TreemapRect
}

function squarify(
  items: { id: string; value: number }[],
  bounds: TreemapRect
): TreemapItem[] {
  if (items.length === 0) return []

  const totalValue = items.reduce((s, i) => s + i.value, 0)
  if (totalValue <= 0) return []

  const result: TreemapItem[] = []
  layoutStrip(items, bounds, totalValue, result)
  return result
}

function layoutStrip(
  items: { id: string; value: number }[],
  bounds: TreemapRect,
  totalValue: number,
  result: TreemapItem[]
) {
  if (items.length === 0) return
  if (items.length === 1) {
    result.push({ id: items[0].id, value: items[0].value, rect: bounds })
    return
  }

  const { x, y, w, h } = bounds
  const totalArea = w * h
  const isWide = w >= h

  let strip: { id: string; value: number }[] = []
  let stripValue = 0
  let bestAspect = Infinity
  let splitIndex = 0

  for (let i = 0; i < items.length; i++) {
    const candidate = [...strip, items[i]]
    const candidateValue = stripValue + items[i].value
    const stripFraction = candidateValue / totalValue
    const stripSize = isWide ? w * stripFraction : h * stripFraction

    // Calculate worst aspect ratio in this strip
    let worstAspect = 0
    for (const item of candidate) {
      const itemFraction = item.value / candidateValue
      const itemCross = isWide ? h * itemFraction : w * itemFraction
      const aspect = Math.max(stripSize / itemCross, itemCross / stripSize)
      worstAspect = Math.max(worstAspect, aspect)
    }

    if (worstAspect <= bestAspect) {
      bestAspect = worstAspect
      strip = candidate
      stripValue = candidateValue
      splitIndex = i + 1
    } else {
      break
    }
  }

  // Lay out the strip
  const stripFraction = stripValue / totalValue
  const stripSize = isWide ? w * stripFraction : h * stripFraction
  let offset = 0

  for (const item of strip) {
    const itemFraction = item.value / stripValue
    const itemCross = isWide ? h * itemFraction : w * itemFraction

    const rect: TreemapRect = isWide
      ? { x, y: y + offset, w: stripSize, h: itemCross }
      : { x: x + offset, y, w: itemCross, h: stripSize }

    result.push({ id: item.id, value: item.value, rect })
    offset += itemCross
  }

  // Recurse for remaining items
  const remaining = items.slice(splitIndex)
  if (remaining.length > 0) {
    const remainingValue = totalValue - stripValue
    const newBounds: TreemapRect = isWide
      ? { x: x + stripSize, y, w: w - stripSize, h }
      : { x, y: y + stripSize, w, h: h - stripSize }
    layoutStrip(remaining, newBounds, remainingValue, result)
  }
}

type SortBy = "ev" | "category" | "volume"

export function HeatMatrix({ markets, signalMap }: HeatMatrixProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>("ev")
  const [dims, setDims] = useState({ w: 800, h: 600 })

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setDims({ w: width, h: height })
    })
    obs.observe(node)
    return () => obs.disconnect()
  }, [])

  const signalMarkets = useMemo(() => {
    const items = markets
      .filter((m) => signalMap.has(m.id))
      .map((m) => ({ market: m, signal: signalMap.get(m.id)! }))

    switch (sortBy) {
      case "ev":
        return items.sort((a, b) => Math.abs(b.signal.ev) - Math.abs(a.signal.ev))
      case "category":
        return items.sort((a, b) => (a.market.category ?? "").localeCompare(b.market.category ?? ""))
      case "volume":
        return items.sort((a, b) => b.market.volume - a.market.volume)
    }
  }, [markets, signalMap, sortBy])

  const treemapLayout = useMemo(() => {
    const items = signalMarkets.map(({ market, signal }) => ({
      id: market.id,
      // Use |EV| as weight, with a floor so tiny signals still get a visible cell
      value: Math.max(Math.abs(signal.ev), 0.01),
    }))
    return squarify(items, { x: 0, y: 0, w: dims.w, h: dims.h })
  }, [signalMarkets, dims])

  const marketById = useMemo(() => {
    const map = new Map<string, { market: Market; signal: Signal }>()
    for (const item of signalMarkets) {
      map.set(item.market.id, item)
    }
    return map
  }, [signalMarkets])

  const categories = useMemo(() => {
    const cats = new Map<string, number>()
    for (const { market } of signalMarkets) {
      const cat = market.category ?? "Other"
      cats.set(cat, (cats.get(cat) ?? 0) + 1)
    }
    return cats
  }, [signalMarkets])

  if (signalMarkets.length === 0) {
    return (
      <div className="border border-darwin-border bg-darwin-card p-6 text-center">
        <p className="text-sm text-darwin-text-muted">Waiting for signals...</p>
      </div>
    )
  }

  const hovered = hoveredId ? marketById.get(hoveredId) : null

  return (
    <div className="border border-darwin-border bg-darwin-card flex flex-col" style={{ height: "calc(100vh - 160px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darwin-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-darwin-text uppercase tracking-wider">
            Alpha Heat Map
          </h3>
          <span className="text-[10px] text-darwin-text-muted">
            {signalMarkets.length} signals
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["ev", "category", "volume"] as SortBy[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setSortBy(mode)}
              className={cn(
                "px-2 py-0.5 text-[10px] uppercase transition-colors",
                sortBy === mode
                  ? "bg-darwin-hover text-darwin-text"
                  : "text-darwin-text-muted hover:text-darwin-text-secondary"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Treemap */}
      <div ref={containerRef} className="relative flex-1 min-h-0">
        {/* Tooltip overlay */}
        {hovered && (
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-darwin-card/95 backdrop-blur-sm border-b border-darwin-border">
            <span className="text-xs text-darwin-text truncate max-w-[60%]">
              {hovered.market.question}
            </span>
            <div className="flex items-center gap-3 font-data text-xs">
              <span className="text-darwin-text-muted">
                Mkt {formatProbability(hovered.signal.marketPrice)}
              </span>
              <span className="text-darwin-text">
                Darwin {formatProbability(hovered.signal.darwinEstimate)}
              </span>
              <span className={hovered.signal.ev > 0 ? "text-darwin-green" : "text-darwin-red"}>
                {formatEV(hovered.signal.ev)}
              </span>
            </div>
          </div>
        )}

        {treemapLayout.map((cell) => {
          const item = marketById.get(cell.id)
          if (!item) return null
          const { signal, market } = item
          const isHovered = hoveredId === cell.id
          const cellW = cell.rect.w
          const cellH = cell.rect.h
          const minDim = Math.min(cellW, cellH)

          return (
            <div
              key={cell.id}
              className={cn(
                "absolute flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-opacity duration-100",
                isHovered ? "opacity-100 ring-1 ring-inset ring-white/40 z-10" : "opacity-90 hover:opacity-100"
              )}
              style={{
                left: cell.rect.x,
                top: cell.rect.y,
                width: cellW - 1,
                height: cellH - 1,
                backgroundColor: evToColor(signal.ev),
              }}
              onMouseEnter={() => setHoveredId(cell.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* EV value */}
              {minDim > 28 && (
                <span
                  className="font-data font-semibold leading-none"
                  style={{
                    color: evToTextColor(signal.ev),
                    fontSize: Math.max(10, Math.min(20, minDim * 0.25)),
                  }}
                >
                  {formatEV(signal.ev)}
                </span>
              )}
              {/* Market name — only if cell is big enough */}
              {cellW > 80 && cellH > 44 && (
                <span
                  className="mt-1 px-1 text-center leading-tight truncate max-w-full"
                  style={{
                    color: evToTextColor(signal.ev),
                    fontSize: Math.max(8, Math.min(11, minDim * 0.12)),
                    opacity: 0.7,
                  }}
                >
                  {market.question.length > 40 ? market.question.slice(0, 38) + "…" : market.question}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between border-t border-darwin-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <div className="h-2 w-8" style={{ background: "linear-gradient(to right, #FF1414, #0A0A0F, #00D47E)" }} />
          <span className="text-[9px] text-darwin-text-muted ml-1">Bearish → Neutral → Bullish</span>
        </div>
        <div className="flex items-center gap-2">
          {[...categories.entries()].slice(0, 4).map(([cat, count]) => (
            <span key={cat} className="text-[9px] text-darwin-text-muted">
              {cat} ({count})
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
