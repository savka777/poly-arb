"use client"

import { useMemo, useState } from "react"
import { formatProbability, formatEV, formatVolume } from "@/lib/format"
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
    const g = Math.round(10 + intensity * 160)
    const b = Math.round(15 + intensity * 50)
    return `rgb(${r},${g},${b})`
  }
  const r = Math.round(10 + intensity * 200)
  const g = Math.round(10 + intensity * 15)
  const b = Math.round(15 + intensity * 15)
  return `rgb(${r},${g},${b})`
}

function evToTextColor(ev: number): string {
  const abs = Math.abs(ev)
  if (abs > 0.08) return "#FFFFFF"
  return "#888899"
}

function evToAccentColor(ev: number): string {
  if (ev > 0) return "#00D47E"
  if (ev < 0) return "#FF4444"
  return "#888899"
}

type SortBy = "ev" | "volume"

interface CellProps {
  market: Market
  signal: Signal
  rank: number
  hoveredId: string | null
  setHoveredId: (id: string | null) => void
}

function Cell({ market, signal, rank, hoveredId, setHoveredId }: CellProps) {
  const isHovered = hoveredId === market.id
  return (
    <div
      className={cn(
        "relative flex flex-col justify-between p-2.5 cursor-pointer transition-all duration-75 overflow-hidden",
        isHovered
          ? "ring-1 ring-inset ring-white/30 z-10 brightness-110"
          : "hover:brightness-105"
      )}
      style={{
        backgroundColor: evToColor(signal.ev),
        minHeight: 82,
      }}
      onMouseEnter={() => setHoveredId(market.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="flex items-start justify-between gap-1">
        <span
          className="text-[9px] font-medium uppercase leading-tight line-clamp-2"
          style={{ color: evToTextColor(signal.ev), opacity: 0.8 }}
        >
          {market.question.length > 48
            ? market.question.slice(0, 46) + "…"
            : market.question}
        </span>
        <span
          className="shrink-0 text-[9px] font-data tabular-nums"
          style={{ color: evToTextColor(signal.ev), opacity: 0.4 }}
        >
          #{rank}
        </span>
      </div>

      <div className="mt-auto pt-1.5 flex items-end justify-between">
        <span
          className="font-data font-bold text-lg leading-none tabular-nums"
          style={{ color: evToAccentColor(signal.ev) }}
        >
          {formatEV(signal.ev)}
        </span>
        <div className="flex flex-col items-end gap-0.5">
          <span
            className="font-data text-[10px] tabular-nums leading-none"
            style={{ color: evToTextColor(signal.ev), opacity: 0.6 }}
          >
            {formatProbability(signal.marketPrice)}
          </span>
          <span
            className="font-data text-[10px] tabular-nums leading-none"
            style={{ color: evToTextColor(signal.ev), opacity: 0.4 }}
          >
            {market.category ?? "—"}
          </span>
        </div>
      </div>
    </div>
  )
}

function ColumnHeader({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-1 pb-1.5">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      <span className="text-[11px] font-medium text-darwin-text uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[10px] text-darwin-text-muted font-data">{count}</span>
    </div>
  )
}

export function HeatMatrix({ markets, signalMap }: HeatMatrixProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortBy>("ev")

  const { gainers, losers } = useMemo(() => {
    const items = markets
      .filter((m) => signalMap.has(m.id))
      .map((m) => ({ market: m, signal: signalMap.get(m.id)! }))

    const sortFn = sortBy === "ev"
      ? (a: { signal: Signal }, b: { signal: Signal }) => Math.abs(b.signal.ev) - Math.abs(a.signal.ev)
      : (a: { market: Market }, b: { market: Market }) => b.market.volume - a.market.volume

    const g = items.filter((i) => i.signal.ev > 0).sort(sortFn)
    const l = items.filter((i) => i.signal.ev <= 0).sort(sortFn)
    return { gainers: g, losers: l }
  }, [markets, signalMap, sortBy])

  const total = gainers.length + losers.length

  const hovered = hoveredId
    ? [...gainers, ...losers].find((s) => s.market.id === hoveredId)
    : null

  if (total === 0) {
    return (
      <div className="border border-darwin-border bg-darwin-card p-6 text-center">
        <p className="text-sm text-darwin-text-muted">Waiting for signals...</p>
      </div>
    )
  }

  return (
    <div className="border border-darwin-border bg-darwin-card flex flex-col" style={{ height: "calc(100vh - 160px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darwin-border px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-darwin-text uppercase tracking-wider">
            Top Movers
          </h3>
          <span className="text-[10px] text-darwin-text-muted">
            {total} signals
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(["ev", "volume"] as SortBy[]).map((mode) => (
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

      {/* Hover detail bar — fixed height, fades */}
      <div className={cn(
        "flex items-center justify-between border-b border-darwin-border px-4 py-2 shrink-0 transition-opacity duration-100",
        hovered ? "opacity-100" : "opacity-0 pointer-events-none"
      )} style={{ minHeight: 36 }}>
        {hovered && (
          <>
            <span className="text-xs text-darwin-text truncate max-w-[55%]">
              {hovered.market.question}
            </span>
            <div className="flex items-center gap-4 font-data text-xs">
              <span className="text-darwin-text-muted">
                Mkt {formatProbability(hovered.signal.marketPrice)}
              </span>
              <span className="text-darwin-text">
                Darwin {formatProbability(hovered.signal.darwinEstimate)}
              </span>
              <span className={hovered.signal.ev > 0 ? "text-darwin-green" : "text-darwin-red"}>
                {formatEV(hovered.signal.ev)}
              </span>
              <span className="text-darwin-text-muted">
                {formatVolume(hovered.market.volume)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Two-column split: Gainers | Losers */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex h-full">
          {/* Gainers */}
          <div className="flex-1 border-r border-darwin-border p-1.5 flex flex-col min-w-0">
            <ColumnHeader label="Bullish" count={gainers.length} color="#00D47E" />
            <div
              className="grid gap-[2px] flex-1 content-start"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
            >
              {gainers.map(({ market, signal }, idx) => (
                <Cell
                  key={market.id}
                  market={market}
                  signal={signal}
                  rank={idx + 1}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                />
              ))}
            </div>
          </div>

          {/* Losers */}
          <div className="flex-1 p-1.5 flex flex-col min-w-0">
            <ColumnHeader label="Bearish" count={losers.length} color="#FF4444" />
            <div
              className="grid gap-[2px] flex-1 content-start"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
            >
              {losers.map(({ market, signal }, idx) => (
                <Cell
                  key={market.id}
                  market={market}
                  signal={signal}
                  rank={idx + 1}
                  hoveredId={hoveredId}
                  setHoveredId={setHoveredId}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend footer */}
      <div className="flex items-center justify-center border-t border-darwin-border px-4 py-2 shrink-0">
        <div className="flex items-center gap-1">
          <div className="h-2 w-8" style={{ background: "linear-gradient(to right, #CC1111, #0A0A0F, #00A864)" }} />
          <span className="text-[9px] text-darwin-text-muted ml-1">Bearish → Neutral → Bullish</span>
        </div>
      </div>
    </div>
  )
}
