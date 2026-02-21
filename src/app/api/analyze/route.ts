import { NextResponse } from "next/server"
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types"
import { fetchMarketById } from "@/data/polymarket"
import { runEventPod } from "@/agent/graph"
import { logActivity } from "@/store/activity-log"
import { config } from "@/lib/config"

// ─── Rate limiting ──────────────────────────────────────────────────────────

const activeAnalyses = new Set<string>()
const recentTimestamps: number[] = []

function isRateLimited(marketId: string): string | null {
  if (activeAnalyses.has(marketId)) {
    return `Analysis already in progress for market ${marketId}`
  }

  const now = Date.now()
  const windowStart = now - 60_000
  // Remove timestamps outside the window
  while (recentTimestamps.length > 0 && recentTimestamps[0] < windowStart) {
    recentTimestamps.shift()
  }

  if (recentTimestamps.length >= config.rateLimit.maxAnalysesPerMinute) {
    return `Rate limit exceeded: max ${config.rateLimit.maxAnalysesPerMinute} analyses per minute`
  }

  if (activeAnalyses.size >= config.rateLimit.maxConcurrentAnalyses) {
    return `Max concurrent analyses reached (${config.rateLimit.maxConcurrentAnalyses})`
  }

  return null
}

export async function POST(request: Request) {
  const body = (await request.json()) as AnalyzeRequest
  const { marketId } = body

  const rateLimitError = isRateLimited(marketId)
  if (rateLimitError) {
    return NextResponse.json(
      { error: rateLimitError, status: 429 },
      { status: 429 }
    )
  }

  // Fetch real market from Gamma API
  const marketResult = await fetchMarketById(marketId)
  if (!marketResult.ok) {
    return NextResponse.json(
      { error: `Market fetch failed: ${marketResult.error}`, status: 502 },
      { status: 502 }
    )
  }

  const market = marketResult.data

  activeAnalyses.add(marketId)
  recentTimestamps.push(Date.now())

  logActivity('analyze', 'info', `Manual analysis started: ${market.question.slice(0, 60)}`, { marketId })

  try {
    const { signal, reasoning, toolCalls } = await runEventPod(market)

    if (signal) {
      logActivity('analyze', 'info', `Signal found: ${signal.direction.toUpperCase()} EV=${signal.ev.toFixed(3)}`, {
        marketId,
        ev: signal.ev,
        direction: signal.direction,
      })
    } else {
      logActivity('analyze', 'info', `No signal for ${market.question.slice(0, 40)}`, { marketId })
    }

    const response: AnalyzeResponse = {
      signal,
      reasoning,
      toolCalls,
    }

    return NextResponse.json(response)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    logActivity('analyze', 'error', `Analysis failed: ${message}`, { marketId })
    const response: AnalyzeResponse = {
      signal: null,
      reasoning: `Pipeline error: ${message}`,
      toolCalls: [],
    }
    return NextResponse.json(response, { status: 500 })
  } finally {
    activeAnalyses.delete(marketId)
  }
}
