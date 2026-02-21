import { useQuery, keepPreviousData } from "@tanstack/react-query"
import type { MarketsResponse } from "@/lib/types"

const POLL_INTERVAL = parseInt(
  process.env.NEXT_PUBLIC_POLL_INTERVAL_MS ?? "30000",
  10
)

export interface UseMarketsOptions {
  page?: number
  limit?: number
  sort?: string
  category?: string
  search?: string
  marketIds?: string[]
}

export function useMarkets(opts: UseMarketsOptions = {}) {
  const page = opts.page ?? 1
  const limit = opts.limit ?? 50
  const sort = opts.sort ?? "volume24hr"
  const category = opts.category
  const search = opts.search
  const marketIds = opts.marketIds

  return useQuery<MarketsResponse>({
    queryKey: ["markets", page, limit, sort, category, search, marketIds],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("page", String(page))
      params.set("limit", String(limit))
      params.set("sort", sort)
      if (category) params.set("category", category)
      if (search) params.set("search", search)
      if (marketIds && marketIds.length > 0) {
        params.set("marketIds", marketIds.join(","))
      }

      const res = await fetch(`/api/markets?${params}`)
      if (!res.ok) throw new Error("Failed to fetch markets")
      return res.json()
    },
    refetchInterval: POLL_INTERVAL,
    placeholderData: keepPreviousData,
  })
}
