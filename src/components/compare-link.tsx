"use client"

import Link from "next/link"
import { LayoutGrid } from "lucide-react"

export function CompareLink() {
  return (
    <Link
      href="/compare"
      className="flex items-center gap-1.5 rounded-none border border-darwin-border px-2.5 py-1 text-xs text-darwin-text-secondary transition-colors hover:border-darwin-text-muted hover:text-darwin-text"
    >
      <LayoutGrid className="h-3.5 w-3.5" />
      Compare
    </Link>
  )
}
