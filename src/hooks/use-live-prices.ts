'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { LiveMarketData } from '@/lib/types'

const RECONNECT_DELAY_MS = 3_000

export function useLivePrices(tokenIds: string[]): {
  prices: Map<string, LiveMarketData>
  connected: boolean
} {
  const [prices, setPrices] = useState<Map<string, LiveMarketData>>(new Map())
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Stable serialized key for tokenIds to avoid re-connecting on every render
  const tokenIdsKey = tokenIds.slice().sort().join(',')

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setConnected(false)
  }, [])

  useEffect(() => {
    if (!tokenIdsKey) {
      cleanup()
      setPrices(new Map())
      return
    }

    function connect(): void {
      cleanup()

      const url = `/api/live?tokenIds=${encodeURIComponent(tokenIdsKey)}`
      const es = new EventSource(url)
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
      }

      es.addEventListener('snapshot', (event: MessageEvent) => {
        try {
          const snapshot = JSON.parse(event.data) as LiveMarketData[]
          setPrices((prev) => {
            const next = new Map(prev)
            for (const data of snapshot) {
              next.set(data.tokenId, data)
            }
            return next
          })
        } catch {
          // invalid snapshot
        }
      })

      es.addEventListener('update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data) as LiveMarketData
          setPrices((prev) => {
            const next = new Map(prev)
            next.set(data.tokenId, data)
            return next
          })
        } catch {
          // invalid update
        }
      })

      es.onerror = () => {
        setConnected(false)
        es.close()
        eventSourceRef.current = null

        // Auto-reconnect
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null
          connect()
        }, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return cleanup
  }, [tokenIdsKey, cleanup])

  return { prices, connected }
}
