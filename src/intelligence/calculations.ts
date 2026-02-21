import type { Direction } from '@/lib/types';

export function calculateEV(
  estimatedProbability: number,
  marketPrice: number,
): { ev: number; direction: Direction } {
  const ev = estimatedProbability - marketPrice;
  const direction: Direction = ev >= 0 ? 'yes' : 'no';
  return { ev, direction };
}

export function evToConfidence(ev: number): 'low' | 'medium' | 'high' {
  const absEv = Math.abs(ev);
  if (absEv >= 0.15) return 'high';
  if (absEv >= 0.08) return 'medium';
  return 'low';
}
