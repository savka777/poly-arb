"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface LegendEntry {
  id: string
  label: string
  color: string
  price?: number | null
  removable?: boolean
}

interface ChartLegendProps {
  primary: LegendEntry
  overlays: LegendEntry[]
  onRemoveOverlay?: (id: string) => void
}

function formatLegendPrice(price: number | null | undefined): string {
  if (price == null) return "—"
  return `${(price * 100).toFixed(1)}%`
}

export function ChartLegend({ primary, overlays, onRemoveOverlay }: ChartLegendProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (overlays.length === 0) return null

  return (
    <div className="absolute left-2 top-2 z-10 flex flex-col gap-0.5 pointer-events-auto">
      {/* Primary */}
      <div className="flex items-center gap-1.5 bg-[#111118cc] backdrop-blur-sm px-2 py-1 text-[11px]">
        <span
          className="inline-block h-[2px] w-3 shrink-0"
          style={{ backgroundColor: primary.color }}
        />
        <span className="text-darwin-text truncate max-w-[180px]">{primary.label}</span>
        <span className="font-data text-darwin-text-secondary ml-auto">
          {formatLegendPrice(primary.price)}
        </span>
      </div>

      {/* Overlays */}
      {overlays.map((o) => (
        <div
          key={o.id}
          className="flex items-center gap-1.5 bg-[#111118cc] backdrop-blur-sm px-2 py-1 text-[11px] group"
          onMouseEnter={() => setHoveredId(o.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <span
            className="inline-block h-[2px] w-3 shrink-0"
            style={{ backgroundColor: o.color }}
          />
          <span className="truncate max-w-[180px]" style={{ color: o.color }}>
            {o.label}
          </span>
          <span className="font-data text-darwin-text-secondary ml-auto">
            {formatLegendPrice(o.price)}
          </span>
          {o.removable !== false && onRemoveOverlay && (
            <button
              onClick={() => onRemoveOverlay(o.id)}
              className={cn(
                "ml-1 p-0.5 text-darwin-text-muted hover:text-darwin-red transition-opacity",
                hoveredId === o.id ? "opacity-100" : "opacity-0"
              )}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
