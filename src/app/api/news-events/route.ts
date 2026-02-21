import { NextRequest, NextResponse } from "next/server"
import { getRecentNewsEvents, getNewsEventCount } from "@/store/news-events"

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit")
  const limit = limitParam ? parseInt(limitParam, 10) : 20

  const events = getRecentNewsEvents(isNaN(limit) ? 20 : limit)

  return NextResponse.json({
    events,
    total: getNewsEventCount(),
  })
}
