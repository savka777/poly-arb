import { NextResponse } from "next/server"
import { fetchPriceHistory } from "@/data/polymarket"
import type { PricePoint } from "@/data/polymarket"
import { aggregateToOhlc } from "@/lib/ohlc"
import type { OhlcPoint } from "@/lib/ohlc"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get("tokenId")
  const interval = (searchParams.get("interval") ?? "all") as "1d" | "1w" | "1m" | "all"
  const fidelity = parseInt(searchParams.get("fidelity") ?? "60", 10)
  const mode = searchParams.get("mode") ?? "raw"

  if (!tokenId) {
    return NextResponse.json(
      { error: "tokenId query parameter required", status: 400 },
      { status: 400 }
    )
  }

  const result = await fetchPriceHistory(tokenId, interval, fidelity)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: 502 },
      { status: 502 }
    )
  }

  if (mode === "ohlc") {
    const ohlcResult = aggregateToOhlc(result.data, interval)
    if (!ohlcResult.ok) {
      return NextResponse.json(
        { error: ohlcResult.error, status: 500 },
        { status: 500 }
      )
    }
    const response: { ohlc: OhlcPoint[] } = { ohlc: ohlcResult.data }
    return NextResponse.json(response)
  }

  const response: { prices: PricePoint[] } = { prices: result.data }
  return NextResponse.json(response)
}
