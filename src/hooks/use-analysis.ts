'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AnalyzeResponse } from '@/lib/types';

export function useAnalysis() {
  const queryClient = useQueryClient();

  return useMutation<AnalyzeResponse, Error, string>({
    mutationFn: async (marketId: string) => {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Analysis failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signals'] });
      queryClient.invalidateQueries({ queryKey: ['markets'] });
    },
  });
}
