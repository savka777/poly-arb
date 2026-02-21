import { NextResponse } from "next/server"
import { fetchPriceHistory } from "@/data/polymarket"
import type { PricePoint } from "@/data/polymarket"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get("tokenId")
  const interval = (searchParams.get("interval") ?? "all") as "1d" | "1w" | "1m" | "all"
  const fidelity = parseInt(searchParams.get("fidelity") ?? "60", 10)

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

  const response: { prices: PricePoint[] } = { prices: result.data }
  return NextResponse.json(response)
}
