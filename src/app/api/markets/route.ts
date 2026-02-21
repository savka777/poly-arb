import { NextResponse } from "next/server"
import type { MarketsResponse } from "@/lib/types"
import { fetchMarkets } from "@/data/polymarket"
import { MOCK_MARKETS } from "@/lib/mock-data"

export async function GET() {
  const result = await fetchMarkets({ limit: 50, active: true })

  const markets = result.ok ? result.data : MOCK_MARKETS

  const response: MarketsResponse = {
    markets,
    total: markets.length,
    lastFetchedAt: new Date().toISOString(),
  }
  return NextResponse.json(response)
}
