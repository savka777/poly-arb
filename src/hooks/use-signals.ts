'use client';

import { useQuery } from '@tanstack/react-query';
import type { SignalsResponse } from '@/lib/types';

export function useSignals() {
  return useQuery<SignalsResponse>({
    queryKey: ['signals'],
    queryFn: async () => {
      const res = await fetch('/api/signals');
      if (!res.ok) throw new Error('Failed to fetch signals');
      return res.json();
    },
    refetchInterval: parseInt(
      process.env.NEXT_PUBLIC_POLL_INTERVAL_MS || '30000',
      10,
    ),
  });
}
