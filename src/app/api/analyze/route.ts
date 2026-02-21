import { NextResponse } from "next/server"
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types"
import { fetchMarketById } from "@/data/polymarket"
import { runEventPod } from "@/agent/graph"

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeRequest
  const { marketId } = body

  // Fetch real market from Gamma API
  const marketResult = await fetchMarketById(marketId)
  if (!marketResult.ok) {
    return NextResponse.json(
      { error: `Market fetch failed: ${marketResult.error}`, status: 502 },
      { status: 502 }
    )
  }

  const market = marketResult.data

  try {
    // Run the real LangGraph pipeline
    const { signal, reasoning, toolCalls } = await runEventPod(market)

    const response: AnalyzeResponse = {
      signal,
      reasoning,
      toolCalls,
    }

    return NextResponse.json(response)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const response: AnalyzeResponse = {
      signal: null,
      reasoning: `Pipeline error: ${message}`,
      toolCalls: [],
    }
    return NextResponse.json(response, { status: 500 })
  }
}
