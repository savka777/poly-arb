"use client"

import { useState } from "react"
import { Pencil, Check, X, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

interface FairValueEditorProps {
  fairValue: number | null
  isCustom: boolean
  onSave: (v: number) => void
  onReset: () => void
  compact?: boolean
}

export function FairValueEditor({
  fairValue,
  isCustom,
  onSave,
  onReset,
  compact = false,
}: FairValueEditorProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")

  function startEdit() {
    setInputValue(fairValue !== null ? String(Math.round(fairValue * 100)) : "")
    setEditing(true)
  }

  function save() {
    const parsed = parseFloat(inputValue)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      onSave(parsed / 100)
    }
    setEditing(false)
  }

  function cancel() {
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={cn("text-darwin-text-muted", compact ? "text-[10px]" : "text-xs")}>
          Fair Value
        </span>
        <input
          type="number"
          min={0}
          max={100}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") cancel()
          }}
          className="w-14 bg-darwin-elevated px-1.5 py-0.5 font-data text-xs text-darwin-text outline-none focus:ring-1 focus:ring-darwin-blue"
          autoFocus
        />
        <span className="text-xs text-darwin-text-muted">%</span>
        <button onClick={save} className="p-0.5 text-darwin-green hover:text-darwin-green/80">
          <Check className="h-3 w-3" />
        </button>
        <button onClick={cancel} className="p-0.5 text-darwin-red hover:text-darwin-red/80">
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("text-darwin-text-muted", compact ? "text-[10px]" : "text-xs")}>
        Fair Value
      </span>
      <span className="font-data text-xs text-darwin-warning">
        {fairValue !== null ? `${(fairValue * 100).toFixed(0)}%` : "—"}
      </span>
      {isCustom && (
        <span className="text-[9px] text-darwin-text-muted">(custom)</span>
      )}
      <button
        onClick={startEdit}
        className="p-0.5 text-darwin-text-muted hover:text-darwin-text"
        title="Edit fair value"
      >
        <Pencil className="h-3 w-3" />
      </button>
      {isCustom && (
        <button
          onClick={onReset}
          className="p-0.5 text-darwin-text-muted hover:text-darwin-text"
          title="Reset to AI estimate"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
