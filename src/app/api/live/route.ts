import { NextRequest } from 'next/server'
import {
  onUpdate,
  getAllLiveData,
  subscribeMarkets,
} from '@/data/polymarket-ws'
import type { LiveMarketData } from '@/lib/types'

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest): Response {
  const tokenIdsParam = request.nextUrl.searchParams.get('tokenIds')
  const tokenIds = tokenIdsParam
    ? tokenIdsParam.split(',').filter(Boolean)
    : []

  // Ensure these tokens are subscribed on the WS
  if (tokenIds.length > 0) {
    subscribeMarkets(tokenIds)
  }

  const tokenIdSet = new Set(tokenIds)

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      // Send initial snapshot of current state
      const allData = getAllLiveData()
      const snapshot: LiveMarketData[] = []
      for (const [id, data] of allData) {
        if (tokenIdSet.size === 0 || tokenIdSet.has(id)) {
          snapshot.push(data)
        }
      }

      if (snapshot.length > 0) {
        controller.enqueue(
          encoder.encode(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`),
        )
      }

      // Stream live updates
      const unsubscribe = onUpdate((update) => {
        if (tokenIdSet.size > 0 && !tokenIdSet.has(update.tokenId)) return

        try {
          controller.enqueue(
            encoder.encode(`event: update\ndata: ${JSON.stringify(update.data)}\n\n`),
          )
        } catch {
          // Stream closed
          unsubscribe()
        }
      })

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        unsubscribe()
        try {
          controller.close()
        } catch {
          // already closed
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
