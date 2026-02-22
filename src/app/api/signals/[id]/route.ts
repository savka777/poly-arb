import { NextResponse } from "next/server"
import { getSignalById } from "@/store/signals"
import { fetchMarketById } from "@/data/polymarket"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const signal = getSignalById(id)
  if (!signal) {
    return NextResponse.json({ error: "Signal not found" }, { status: 404 })
  }

  const marketResult = await fetchMarketById(signal.marketId)
  const market = marketResult.ok ? marketResult.data : null

  return NextResponse.json({ signal, market })
}
