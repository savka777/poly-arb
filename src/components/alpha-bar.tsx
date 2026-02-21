"use client"

import { cn } from "@/lib/utils"

interface AlphaBarProps {
  darwinEstimate: number
  marketPrice: number
  showLabel?: boolean
  size?: "sm" | "md"
  loading?: boolean
}

export function AlphaBar({
  darwinEstimate,
  marketPrice,
  showLabel = true,
  size = "md",
  loading = false,
}: AlphaBarProps) {
  const divergence = darwinEstimate - marketPrice
  const absDivergence = Math.abs(divergence)

  if (loading) {
    return (
      <div className="w-full">
        <div
          className={cn(
            "w-full rounded-sm bg-darwin-border overflow-hidden",
            size === "sm" ? "h-1" : "h-2"
          )}
        >
          <div className="h-full w-2/3 bg-darwin-text-muted/30 animate-pulse rounded-sm" />
        </div>
      </div>
    )
  }

  if (absDivergence < 0.02) return null

  const isBullish = divergence > 0
  const widthPercent = Math.min(absDivergence / 0.2, 1) * 100
  const label = `${isBullish ? "+" : ""}${(divergence * 100).toFixed(1)}%`

  return (
    <div className="w-full space-y-1">
      <div
        className={cn(
          "w-full rounded-sm overflow-hidden",
          size === "sm" ? "h-1" : "h-2",
          "bg-darwin-border"
        )}
      >
        <div
          className={cn(
            "h-full rounded-sm transition-all duration-700 ease-out",
            isBullish ? "bg-darwin-green" : "bg-darwin-red"
          )}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      {showLabel && (
        <span
          className={cn(
            "font-data text-xs",
            isBullish ? "text-darwin-green" : "text-darwin-red"
          )}
        >
          {label}
        </span>
      )}
    </div>
  )
}
