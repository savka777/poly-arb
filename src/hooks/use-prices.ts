import { useQuery } from "@tanstack/react-query"
import type { PricePoint } from "@/data/polymarket"

interface PricesResponse {
  prices: PricePoint[]
}

export function usePrices(
  tokenId: string | undefined,
  interval: "1d" | "1w" | "1m" | "all" = "all"
) {
  return useQuery<PricesResponse>({
    queryKey: ["prices", tokenId, interval],
    queryFn: async () => {
      const params = new URLSearchParams({
        tokenId: tokenId!,
        interval,
        fidelity: "60",
      })
      const res = await fetch(`/api/prices?${params}`)
      if (!res.ok) throw new Error("Failed to fetch prices")
      return res.json()
    },
    enabled: !!tokenId,
    staleTime: 60_000,
  })
}
