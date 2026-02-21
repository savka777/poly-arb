import { NextResponse } from "next/server"
import type { HealthResponse } from "@/lib/types"
import { MOCK_SIGNALS } from "@/lib/mock-data"

const startTime = Date.now()

export async function GET() {
  const response: HealthResponse = {
    status: "ok",
    uptime: Math.floor((Date.now() - startTime) / 1000),
    lastScanAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    signalCount: MOCK_SIGNALS.length,
  }
  return NextResponse.json(response)
}
