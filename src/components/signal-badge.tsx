'use client';

interface SignalBadgeProps {
  confidence: 'low' | 'medium' | 'high';
}

const badgeStyles = {
  high: 'bg-accent-green/20 text-accent-green',
  medium: 'bg-accent-warning/20 text-accent-warning',
  low: 'bg-text-muted/20 text-text-muted',
} as const;

const labels = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
} as const;

export function SignalBadge({ confidence }: SignalBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${badgeStyles[confidence]}`}
    >
      {labels[confidence]}
    </span>
  );
}
