import { useQuery } from "@tanstack/react-query"
import type { MarketDetailResponse } from "@/lib/types"

const POLL_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "30000",
  10
)

export function useMarket(id: string) {
  return useQuery<MarketDetailResponse>({
    queryKey: ["market", id],
    queryFn: async () => {
      const res = await fetch(`/api/markets/${id}`)
      if (!res.ok) throw new Error("Failed to fetch market")
      return res.json()
    },
    refetchInterval: POLL_INTERVAL,
    enabled: !!id,
  })
}
