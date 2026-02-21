import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface WatchlistResponse {
  marketIds: string[]
}

export function useWatchlist() {
  return useQuery<WatchlistResponse>({
    queryKey: ["watchlist"],
    queryFn: async () => {
      const res = await fetch("/api/watchlist")
      if (!res.ok) throw new Error("Failed to fetch watchlist")
      return res.json()
    },
  })
}

export function useToggleWatchlist() {
  const queryClient = useQueryClient()

  return useMutation<void, Error, { marketId: string; watchlisted: boolean }>({
    mutationFn: async ({ marketId, watchlisted }) => {
      const method = watchlisted ? "DELETE" : "POST"
      const res = await fetch("/api/watchlist", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId }),
      })
      if (!res.ok) throw new Error("Failed to update watchlist")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] })
    },
  })
}
