"use client"

import { cn } from "@/lib/utils"
import { RotateCcw } from "lucide-react"
import type { ChartType, TimeFrame } from "@/lib/chart-types"
import type { PanelSettingsControls } from "@/hooks/use-panel-settings"

interface ChartToolbarProps {
  settings: PanelSettingsControls["settings"]
  controls: PanelSettingsControls
  compact?: boolean
  showOverrideIndicators?: boolean
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "candlestick", label: "Candle" },
  { value: "area", label: "Area" },
]

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
  { value: "1m", label: "1M" },
  { value: "all", label: "ALL" },
]

function OverrideDot({ visible }: { visible: boolean }) {
  if (!visible) return null
  return (
    <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-darwin-blue" />
  )
}

export function ChartToolbar({
  settings,
  controls,
  compact = false,
  showOverrideIndicators = true,
}: ChartToolbarProps) {
  const { isOverridden, hasAnyOverride, setLocal, resetAll } = controls
  const btnSize = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"

  return (
    <div className="flex items-center gap-1 border-b border-darwin-border px-2 py-1">
      {/* Chart type */}
      <div className="flex items-center gap-0.5">
        {CHART_TYPES.map((ct) => (
          <button
            key={ct.value}
            onClick={() => setLocal("chartType", ct.value)}
            className={cn(
              "relative font-medium uppercase transition-colors",
              btnSize,
              settings.chartType === ct.value
                ? "bg-darwin-elevated text-darwin-text"
                : "text-darwin-text-muted hover:text-darwin-text-secondary"
            )}
          >
            {ct.label}
            {showOverrideIndicators && (
              <OverrideDot visible={isOverridden("chartType")} />
            )}
          </button>
        ))}
      </div>

      <span className="mx-1 text-darwin-border">|</span>

      {/* Time frame */}
      <div className="flex items-center gap-0.5">
        {TIME_FRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setLocal("timeFrame", tf.value)}
            className={cn(
              "relative font-medium uppercase transition-colors",
              btnSize,
              settings.timeFrame === tf.value
                ? "bg-darwin-elevated text-darwin-text"
                : "text-darwin-text-muted hover:text-darwin-text-secondary"
            )}
          >
            {tf.label}
            {showOverrideIndicators && (
              <OverrideDot visible={isOverridden("timeFrame")} />
            )}
          </button>
        ))}
      </div>

      <span className="mx-1 text-darwin-border">|</span>

      {/* Volume toggle */}
      <button
        onClick={() => setLocal("showVolume", !settings.showVolume)}
        className={cn(
          "relative font-medium uppercase transition-colors",
          btnSize,
          settings.showVolume
            ? "bg-darwin-elevated text-darwin-text"
            : "text-darwin-text-muted hover:text-darwin-text-secondary"
        )}
      >
        Vol
        {showOverrideIndicators && (
          <OverrideDot visible={isOverridden("showVolume")} />
        )}
      </button>

      <span className="mx-1 text-darwin-border">|</span>

      {/* Overlay toggles */}
      <button
        onClick={() =>
          setLocal("overlay.darwinEstimate", !settings.overlays.darwinEstimate)
        }
        className={cn(
          "relative font-medium uppercase transition-colors",
          btnSize,
          settings.overlays.darwinEstimate
            ? "text-darwin-green"
            : "text-darwin-text-muted hover:text-darwin-text-secondary"
        )}
      >
        Darwin
        {showOverrideIndicators && (
          <OverrideDot visible={isOverridden("overlay.darwinEstimate")} />
        )}
      </button>

      <button
        onClick={() =>
          setLocal("overlay.fairValue", !settings.overlays.fairValue)
        }
        className={cn(
          "relative font-medium uppercase transition-colors",
          btnSize,
          settings.overlays.fairValue
            ? "text-darwin-warning"
            : "text-darwin-text-muted hover:text-darwin-text-secondary"
        )}
      >
        FV
        {showOverrideIndicators && (
          <OverrideDot visible={isOverridden("overlay.fairValue")} />
        )}
      </button>

      {/* Spacer + reset */}
      <div className="flex-1" />
      {hasAnyOverride && (
        <button
          onClick={resetAll}
          className="flex items-center gap-1 text-[10px] text-darwin-text-muted transition-colors hover:text-darwin-text"
          title="Reset to global settings"
        >
          <RotateCcw className="h-3 w-3" />
          {!compact && "Reset"}
        </button>
      )}
    </div>
  )
}
