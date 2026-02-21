import { NextResponse } from "next/server"
import type { AnalyzeResponse, AnalyzeRequest, Signal } from "@/lib/types"
import { MOCK_MARKETS, MOCK_SIGNALS, MOCK_TOOL_CALLS } from "@/lib/mock-data"

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeRequest
  const { marketId } = body

  const market = MOCK_MARKETS.find((m) => m.id === marketId)
  if (!market) {
    return NextResponse.json(
      { error: "Market not found", status: 404 },
      { status: 404 }
    )
  }

  // Simulate 1.5s analysis latency
  await new Promise((resolve) => setTimeout(resolve, 1500))

  const existing = MOCK_SIGNALS.find((s) => s.marketId === marketId)
  const signal: Signal | null = existing
    ? {
        ...existing,
        id: `signal-new-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }
    : {
        id: `signal-new-${Date.now()}`,
        marketId: market.id,
        marketQuestion: market.question,
        darwinEstimate: market.probability + 0.08,
        marketPrice: market.probability,
        ev: 0.08,
        direction: "yes",
        reasoning:
          "On-demand analysis found moderate evidence of news-price lag. Recent developments suggest a slight upward adjustment is warranted.",
        newsEvents: ["Recent policy announcement relevant to this market"],
        confidence: "medium",
        createdAt: new Date().toISOString(),
        expiresAt: market.endDate,
      }

  const response: AnalyzeResponse = {
    signal,
    reasoning: signal.reasoning,
    toolCalls: MOCK_TOOL_CALLS.map((tc) => ({
      ...tc,
      id: `tc-new-${Date.now()}-${tc.id}`,
      timestamp: new Date().toISOString(),
    })),
  }

  return NextResponse.json(response)
}
