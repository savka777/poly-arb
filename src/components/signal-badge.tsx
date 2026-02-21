import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SignalBadgeProps {
  confidence: "low" | "medium" | "high"
}

const styles = {
  high: {
    dot: "bg-darwin-green",
    text: "text-darwin-green",
    border: "border-darwin-green/30",
  },
  medium: {
    dot: "bg-darwin-warning",
    text: "text-darwin-warning",
    border: "border-darwin-warning/30",
  },
  low: {
    dot: "bg-darwin-text-muted",
    text: "text-darwin-text-muted",
    border: "border-darwin-text-muted/30",
  },
} as const

export function SignalBadge({ confidence }: SignalBadgeProps) {
  const style = styles[confidence]

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-sm px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider bg-transparent",
        style.text,
        style.border
      )}
    >
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", style.dot)} />
      {confidence}
    </Badge>
  )
}
