import { formatDistanceToNow, format, differenceInDays } from "date-fns"

export function relativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`
}

export function formatEV(ev: number): string {
  const sign = ev >= 0 ? "+" : ""
  return `${sign}${(ev * 100).toFixed(1)}%`
}

export function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`
  return `$${v.toFixed(0)}`
}

export function formatEndDate(dateStr: string): string {
  const days = differenceInDays(new Date(dateStr), new Date())
  if (days <= 0) return "Expired"
  if (days <= 7) return `${days}d left`
  return format(new Date(dateStr), "MMM d, yyyy")
}
