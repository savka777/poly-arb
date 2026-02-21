'use client';

interface AlphaBarProps {
  darwinEstimate: number;
  marketPrice: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export function AlphaBar({
  darwinEstimate,
  marketPrice,
  showLabel = true,
  size = 'md',
}: AlphaBarProps) {
  const divergence = Number(darwinEstimate) - Number(marketPrice);
  const absDivergence = Math.abs(divergence);

  if (absDivergence < 0.02) return null;

  const barWidth = Math.min(absDivergence / 0.2, 1.0) * 100;
  const isBullish = divergence > 0;
  const label = `${isBullish ? '+' : ''}${(divergence * 100).toFixed(1)}%`;
  const heightClass = size === 'sm' ? 'h-1' : 'h-2';
  const barColor = isBullish ? 'bg-accent-green' : 'bg-accent-red';
  const textColor = isBullish ? 'text-accent-green' : 'text-accent-red';

  return (
    <div className="w-full">
      <div className={`w-full ${heightClass} bg-border-default rounded-sm overflow-hidden`}>
        <div
          className={`${heightClass} ${barColor} rounded-sm transition-all duration-300`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      {showLabel && (
        <p className={`text-xs font-mono ${textColor} mt-1 text-right`}>
          {label}
        </p>
      )}
    </div>
  );
}
