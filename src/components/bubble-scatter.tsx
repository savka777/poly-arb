"use client"

import { useMemo, useState, useRef, useCallback } from "react"
import { formatProbability, formatEV, formatVolume } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Market, Signal } from "@/lib/types"

interface BubbleScatterProps {
  markets: Market[]
  signalMap: Map<string, Signal>
}

const PADDING = { top: 40, right: 40, bottom: 50, left: 50 }

function evToColor(ev: number, alpha: number = 0.8): string {
  if (ev > 0) return `rgba(0, 212, 126, ${alpha})`
  return `rgba(255, 68, 68, ${alpha})`
}

export function BubbleScatter({ markets, signalMap }: BubbleScatterProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [dims, setDims] = useState({ w: 800, h: 500 })

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
    return markets
      .filter((m) => signalMap.has(m.id))
      .map((m) => ({ market: m, signal: signalMap.get(m.id)! }))
  }, [markets, signalMap])

  // Scale helpers
  const plotW = dims.w - PADDING.left - PADDING.right
  const plotH = dims.h - PADDING.top - PADDING.bottom

  const maxVol = useMemo(() => {
    if (signalMarkets.length === 0) return 1
    return Math.max(...signalMarkets.map((s) => s.market.volume), 1)
  }, [signalMarkets])

  const scaleX = useCallback((v: number) => PADDING.left + v * plotW, [plotW])
  const scaleY = useCallback((v: number) => PADDING.top + (1 - v) * plotH, [plotH])
  const scaleR = useCallback((vol: number) => {
    const normalized = vol / maxVol
    return 6 + normalized * 30
  }, [maxVol])

  // SVG-level hover: find nearest bubble by distance to avoid per-element jitter
  const handleSvgMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg || signalMarkets.length === 0) return
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      let closestId: string | null = null
      let closestDist = Infinity

      for (const { market, signal } of signalMarkets) {
        const cx = scaleX(signal.marketPrice)
        const cy = scaleY(signal.darwinEstimate)
        const r = Math.max(scaleR(market.volume), 14)
        const dx = mx - cx
        const dy = my - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist <= r && dist < closestDist) {
          closestDist = dist
          closestId = market.id
        }
      }

      setHoveredId(closestId)
    },
    [signalMarkets, scaleX, scaleY, scaleR]
  )

  const handleSvgMouseLeave = useCallback(() => setHoveredId(null), [])

  const hovered = hoveredId
    ? signalMarkets.find((s) => s.market.id === hoveredId)
    : null

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1.0]

  if (signalMarkets.length === 0) {
    return (
      <div className="border border-darwin-border bg-darwin-card p-6 text-center">
        <p className="text-sm text-darwin-text-muted">Waiting for signals...</p>
      </div>
    )
  }

  return (
    <div className="border border-darwin-border bg-darwin-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-darwin-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h3 className="text-xs font-medium text-darwin-text uppercase tracking-wider">
            Mispricing Scatter
          </h3>
          <span className="text-[10px] text-darwin-text-muted">
            {signalMarkets.length} markets — off-diagonal = alpha
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-darwin-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-darwin-green/80" />
            Bullish
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-darwin-red/80" />
            Bearish
          </span>
          <span>Size = volume</span>
        </div>
      </div>

      {/* SVG scatter plot */}
      <div ref={containerRef} className="relative" style={{ height: 460 }}>
        {/* Tooltip — absolute overlay, no layout shift */}
        {hovered && (
          <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-darwin-card/95 backdrop-blur-sm border-b border-darwin-border">
            <span className="text-xs text-darwin-text truncate max-w-[50%]">
              {hovered.market.question}
            </span>
            <div className="flex items-center gap-4 font-data text-xs">
              <span className="text-darwin-text-muted">
                Mkt {formatProbability(hovered.signal.marketPrice)}
              </span>
              <span className="text-darwin-text">
                Polyverse {formatProbability(hovered.signal.darwinEstimate)}
              </span>
              <span className={hovered.signal.ev > 0 ? "text-darwin-green" : "text-darwin-red"}>
                {formatEV(hovered.signal.ev)}
              </span>
              <span className="text-darwin-text-muted">
                {formatVolume(hovered.market.volume)}
              </span>
            </div>
          </div>
        )}
        <svg
          ref={svgRef}
          width={dims.w}
          height={dims.h}
          className="absolute inset-0 cursor-crosshair"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
          {/* Grid */}
          {gridLines.map((v) => (
            <g key={`grid-${v}`}>
              {/* Horizontal */}
              <line
                x1={PADDING.left}
                y1={scaleY(v)}
                x2={dims.w - PADDING.right}
                y2={scaleY(v)}
                stroke="rgba(42, 42, 58, 0.3)"
                strokeWidth={1}
              />
              {/* Vertical */}
              <line
                x1={scaleX(v)}
                y1={PADDING.top}
                x2={scaleX(v)}
                y2={dims.h - PADDING.bottom}
                stroke="rgba(42, 42, 58, 0.3)"
                strokeWidth={1}
              />
              {/* X labels */}
              <text
                x={scaleX(v)}
                y={dims.h - PADDING.bottom + 18}
                textAnchor="middle"
                className="fill-[#555566] text-[10px]"
                style={{ fontFamily: "var(--font-jetbrains), monospace" }}
              >
                {(v * 100).toFixed(0)}%
              </text>
              {/* Y labels */}
              <text
                x={PADDING.left - 10}
                y={scaleY(v) + 4}
                textAnchor="end"
                className="fill-[#555566] text-[10px]"
                style={{ fontFamily: "var(--font-jetbrains), monospace" }}
              >
                {(v * 100).toFixed(0)}%
              </text>
            </g>
          ))}

          {/* Diagonal line — efficient market */}
          <line
            x1={scaleX(0)}
            y1={scaleY(0)}
            x2={scaleX(1)}
            y2={scaleY(1)}
            stroke="rgba(136, 136, 160, 0.25)"
            strokeWidth={1}
            strokeDasharray="6 4"
          />
          <text
            x={scaleX(0.85) + 6}
            y={scaleY(0.85) - 8}
            className="fill-[#555566] text-[9px]"
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
          >
            Fair Value
          </text>

          {/* Axis labels */}
          <text
            x={dims.w / 2}
            y={dims.h - 6}
            textAnchor="middle"
            className="fill-[#888899] text-[11px]"
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
          >
            Market Price
          </text>
          <text
            x={14}
            y={dims.h / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${dims.h / 2})`}
            className="fill-[#888899] text-[11px]"
            style={{ fontFamily: "var(--font-jetbrains), monospace" }}
          >
            Polyverse Estimate
          </text>

          {/* Bubbles */}
          {signalMarkets.map(({ market, signal }) => {
            const cx = scaleX(signal.marketPrice)
            const cy = scaleY(signal.darwinEstimate)
            const r = scaleR(market.volume)
            const isHovered = hoveredId === market.id

            return (
              <g key={market.id} className="pointer-events-none">
                {/* Glow on hover */}
                {isHovered && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={r + 4}
                    fill="none"
                    stroke={evToColor(signal.ev, 0.5)}
                    strokeWidth={2}
                  />
                )}
                {/* Line to diagonal showing mispricing */}
                {isHovered && (
                  <line
                    x1={cx}
                    y1={cy}
                    x2={cx}
                    y2={scaleY(signal.marketPrice)}
                    stroke={evToColor(signal.ev, 0.4)}
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={evToColor(signal.ev, isHovered ? 0.9 : 0.6)}
                  stroke={evToColor(signal.ev, 1)}
                  strokeWidth={isHovered ? 2 : 1}
                />
                {/* EV label inside large bubbles */}
                {r > 16 && (
                  <text
                    x={cx}
                    y={cy + 3}
                    textAnchor="middle"
                    className="fill-white text-[9px] font-medium"
                    style={{ fontFamily: "var(--font-jetbrains), monospace" }}
                  >
                    {formatEV(signal.ev)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
