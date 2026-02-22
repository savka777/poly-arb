"use client"

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import type { ProbabilityPoint } from "@/lib/mock-timeseries"
import type { Direction } from "@/lib/types"

interface DivergenceChartProps {
  data: ProbabilityPoint[]
  direction: Direction | null
}

function formatDateTick(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function formatPercent(val: number): string {
  return `${(val * 100).toFixed(0)}%`
}

interface TooltipPayloadItem {
  dataKey: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="border px-3 py-2 text-xs font-data"
      style={{
        backgroundColor: "#1C2030",
        borderColor: "#2A2A3A",
      }}
    >
      <p className="mb-1 text-darwin-text-secondary">{label ? formatDateTick(label) : ""}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.dataKey === "marketPrice" ? "Market" : "Polyverse"}:{" "}
          {formatPercent(entry.value)}
        </p>
      ))}
    </div>
  )
}

export function DivergenceChart({ data, direction }: DivergenceChartProps) {
  const darwinColor = direction === "no" ? "#FF4444" : "#00D47E"
  const gradientId = `darwin-fill-${direction ?? "none"}`

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={darwinColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={darwinColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          stroke="#2A2A3A"
          strokeDasharray="3 3"
          vertical={false}
        />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatDateTick}
          tick={{ fill: "#555566", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={formatPercent}
          tick={{ fill: "#555566", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        {direction && (
          <Area
            type="monotone"
            dataKey="darwinEstimate"
            stroke={darwinColor}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 3, fill: darwinColor }}
          />
        )}
        <Line
          type="monotone"
          dataKey="marketPrice"
          stroke="#E8E8ED"
          strokeOpacity={0.6}
          strokeWidth={1.5}
          dot={false}
          activeDot={{ r: 3, fill: "#E8E8ED" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
