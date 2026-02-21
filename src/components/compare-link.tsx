"use client"

import Link from "next/link"
import { LayoutGrid } from "lucide-react"

interface CompareLinkProps {
  marketId?: string
}

export function CompareLink({ marketId }: CompareLinkProps) {
  const href = marketId ? `/compare?add=${marketId}` : "/compare"

  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-none border border-darwin-border px-2.5 py-1 text-xs text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
    >
      <LayoutGrid className="h-3.5 w-3.5" />
      {marketId ? "Add to Compare" : "Compare"}
    </Link>
  )
}
