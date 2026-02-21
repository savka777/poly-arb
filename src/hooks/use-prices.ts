import { useQuery, useQueries } from "@tanstack/react-query"
import type { PricePoint } from "@/data/polymarket"
import type { OhlcPoint } from "@/lib/ohlc"
import type { Market } from "@/lib/types"

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

export function useOverlayPrices(
  markets: Market[],
  interval: "1d" | "1w" | "1m" | "all" = "all"
) {
  return useQueries({
    queries: markets.map((m) => ({
      queryKey: ["prices", m.clobTokenId, interval],
      queryFn: async () => {
        const params = new URLSearchParams({
          tokenId: m.clobTokenId!,
          interval,
          fidelity: "60",
        })
        const res = await fetch(`/api/prices?${params}`)
        if (!res.ok) throw new Error("Failed to fetch prices")
        const data: PricesResponse = await res.json()
        return { marketId: m.id, prices: data.prices }
      },
      enabled: !!m.clobTokenId,
      staleTime: 60_000,
    })),
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
