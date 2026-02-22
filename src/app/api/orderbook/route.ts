import { NextResponse } from "next/server"
import { fetchOrderBook } from "@/data/polymarket"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tokenId = searchParams.get("tokenId")

  if (!tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 })
  }

  const result = await fetchOrderBook(tokenId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 })
  }

  return NextResponse.json(result.data)
}
