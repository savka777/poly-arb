import { NextResponse } from "next/server"
import type { MarketsResponse } from "@/lib/types"
import { MOCK_MARKETS } from "@/lib/mock-data"

export async function GET() {
  const response: MarketsResponse = {
    markets: MOCK_MARKETS,
    total: MOCK_MARKETS.length,
    lastFetchedAt: new Date().toISOString(),
  }
  return NextResponse.json(response)
}
