import { useQuery } from "@tanstack/react-query"
import type { PricePoint } from "@/data/polymarket"
import type { OhlcPoint } from "@/lib/ohlc"

interface PricesResponse {
  prices: PricePoint[]
}

interface OhlcResponse {
  ohlc: OhlcPoint[]
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

export function useOhlc(
  tokenId: string | undefined,
  interval: "1d" | "1w" | "1m" | "all" = "all"
) {
  return useQuery<OhlcResponse>({
    queryKey: ["ohlc", tokenId, interval],
    queryFn: async () => {
      const params = new URLSearchParams({
        tokenId: tokenId!,
        interval,
        fidelity: "60",
        mode: "ohlc",
      })
      const res = await fetch(`/api/prices?${params}`)
      if (!res.ok) throw new Error("Failed to fetch OHLC data")
      return res.json()
    },
    enabled: !!tokenId,
    staleTime: 60_000,
  })
}
