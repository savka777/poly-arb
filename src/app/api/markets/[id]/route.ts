import { NextResponse } from "next/server"
import type { MarketDetailResponse } from "@/lib/types"
import { fetchMarketById } from "@/data/polymarket"
import { getSignalsByMarket } from "@/store/signals"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const result = await fetchMarketById(id)

  if (!result.ok) {
    return NextResponse.json(
      { error: "Market not found", status: 404 },
      { status: 404 }
    )
  }

  const signals = getSignalsByMarket(id)

  const response: MarketDetailResponse = {
    market: result.data,
    signals,
  }
  return NextResponse.json(response)
}
