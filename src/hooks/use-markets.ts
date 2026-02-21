'use client';

import { useQuery } from '@tanstack/react-query';
import type { MarketsResponse } from '@/lib/types';

export function useMarkets() {
  return useQuery<MarketsResponse>({
    queryKey: ['markets'],
    queryFn: async () => {
      const res = await fetch('/api/markets');
      if (!res.ok) throw new Error('Failed to fetch markets');
      return res.json();
    },
    refetchInterval: parseInt(
      process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '30000',
      10,
    ),
  });
}
