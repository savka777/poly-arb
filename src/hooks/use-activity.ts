import { useQuery } from '@tanstack/react-query';
import type { ActivityResponse } from '@/lib/types';

export function useActivity(limit = 50) {
  return useQuery<ActivityResponse>({
    queryKey: ['activity', limit],
    queryFn: async () => {
      const res = await fetch(`/api/activity?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch activity');
      return res.json();
    },
    refetchInterval: 5_000,
  });
}
