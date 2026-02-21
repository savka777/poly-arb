import { NextResponse } from "next/server"
import type { SignalsResponse } from "@/lib/types"
import { MOCK_SIGNALS } from "@/lib/mock-data"

export async function GET() {
  const response: SignalsResponse = {
    signals: MOCK_SIGNALS,
    total: MOCK_SIGNALS.length,
  }
  return NextResponse.json(response)
}
