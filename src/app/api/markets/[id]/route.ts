import { NextResponse } from "next/server"
import type { MarketDetailResponse } from "@/lib/types"
import { MOCK_MARKETS, MOCK_SIGNALS } from "@/lib/mock-data"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const market = MOCK_MARKETS.find((m) => m.id === id)

  if (!market) {
    return NextResponse.json(
      { error: "Market not found", status: 404 },
      { status: 404 }
    )
  }

  const signals = MOCK_SIGNALS.filter((s) => s.marketId === id)

  const response: MarketDetailResponse = {
    market,
    signals,
  }
  return NextResponse.json(response)
}
