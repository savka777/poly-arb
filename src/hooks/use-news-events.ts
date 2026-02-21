import { useQuery } from "@tanstack/react-query"
import type { NewsEvent } from "@/lib/types"

interface NewsEventsResponse {
  events: NewsEvent[]
  total: number
}

export function useNewsEvents(limit = 20) {
  return useQuery<NewsEventsResponse>({
    queryKey: ["news-events", limit],
    queryFn: async () => {
      const res = await fetch(`/api/news-events?limit=${limit}`)
      if (!res.ok) throw new Error("Failed to fetch news events")
      return res.json()
    },
    refetchInterval: 30_000,
  })
}
