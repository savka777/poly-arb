import { NextResponse } from "next/server"
import type { SignalsResponse } from "@/lib/types"
import { getSignals } from "@/store/signals"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const confidence = searchParams.get("confidence") as
    | "low"
    | "medium"
    | "high"
    | null
  const minEvStr = searchParams.get("minEv")
  const minEv = minEvStr ? parseFloat(minEvStr) : undefined

  const signals = getSignals({
    confidence: confidence ?? undefined,
    minEv: isNaN(minEv as number) ? undefined : minEv,
  })

  const response: SignalsResponse = {
    signals,
    total: signals.length,
  }
  return NextResponse.json(response)
}
