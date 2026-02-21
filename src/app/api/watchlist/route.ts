import { NextResponse } from "next/server"
import {
  addToWatchlist,
  removeFromWatchlist,
  getWatchlist,
} from "@/store/watchlist"

export async function GET() {
  const marketIds = getWatchlist()
  return NextResponse.json({ marketIds })
}

export async function POST(request: Request) {
  const body = (await request.json()) as { marketId?: string }
  if (!body.marketId) {
    return NextResponse.json(
      { error: "marketId is required" },
      { status: 400 }
    )
  }
  addToWatchlist(body.marketId)
  return NextResponse.json({ ok: true, marketId: body.marketId })
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as { marketId?: string }
  if (!body.marketId) {
    return NextResponse.json(
      { error: "marketId is required" },
      { status: 400 }
    )
  }
  removeFromWatchlist(body.marketId)
  return NextResponse.json({ ok: true, marketId: body.marketId })
}
