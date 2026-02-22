import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScoutEvent } from '@/lib/types';

interface ScoutResponse {
  events: ScoutEvent[];
  latestAt: string | null;
}

export function useScout(limit = 10) {
  return useQuery<ScoutResponse>({
    queryKey: ['scout', limit],
    queryFn: async () => {
      const res = await fetch(`/api/scout?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch scout events');
      return res.json();
    },
    refetchInterval: 5_000,
  });
}

interface ScoutConfigResponse {
  keywords: string[];
}

export function useScoutConfig() {
  const queryClient = useQueryClient();

  const query = useQuery<ScoutConfigResponse>({
    queryKey: ['scout-config'],
    queryFn: async () => {
      const res = await fetch('/api/scout/config');
      if (!res.ok) throw new Error('Failed to fetch scout config');
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (keywords: string[]) => {
      const res = await fetch('/api/scout/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      if (!res.ok) throw new Error('Failed to update scout config');
      return res.json() as Promise<ScoutConfigResponse>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout-config'] });
    },
  });

  return {
    keywords: query.data?.keywords ?? [],
    setKeywords: mutation.mutate,
  };
}

export function useScoutDismiss() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch('/api/scout/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Failed to dismiss scout event');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scout'] });
    },
  });
}
