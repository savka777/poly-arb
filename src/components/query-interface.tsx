"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface QueryInterfaceProps {
  onSubmit: (query: string) => void
  loading?: boolean
  disabled?: boolean
}

export function QueryInterface({
  onSubmit,
  loading,
  disabled,
}: QueryInterfaceProps) {
  const [query, setQuery] = useState("")

  function handleSubmit() {
    const trimmed = query.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setQuery("")
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            handleSubmit()
          }
        }}
        placeholder="Ask Darwin about this market..."
        disabled={disabled || loading}
        className="flex-1 rounded-sm border border-darwin-border bg-darwin-card px-3 py-2 text-sm text-darwin-text placeholder:text-darwin-text-muted focus:outline-none focus:ring-1 focus:ring-darwin-blue disabled:opacity-50"
      />
      <Button
        onClick={handleSubmit}
        disabled={disabled || loading || !query.trim()}
        className="rounded-sm bg-darwin-blue px-4 py-2 text-sm font-medium text-white hover:bg-darwin-blue/80 disabled:opacity-50"
      >
        {loading ? "Analyzing..." : "Analyze"}
      </Button>
    </div>
  )
}
