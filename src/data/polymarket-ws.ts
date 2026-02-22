import WebSocket from 'ws'
import type { LiveMarketData, LiveUpdate } from '@/lib/types'

const WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market'
const CLOB_BASE = 'https://clob.polymarket.com'
const HEARTBEAT_INTERVAL_MS = 10_000
const MAX_RECONNECT_DELAY_MS = 30_000
const BATCH_SIZE = 100
const FALLBACK_TRIGGER_MS = 10_000   // start polling after 10s disconnected
const FALLBACK_POLL_MS = 15_000      // poll every 15s while in fallback
const FALLBACK_CONCURRENCY = 10      // parallel midpoint fetches

// ─── State ──────────────────────────────────────────────────────────────────

type UpdateCallback = (update: LiveUpdate) => void

interface WsState {
  ws: WebSocket | null
  running: boolean
  tokenIds: Set<string>
  liveData: Map<string, LiveMarketData>
  callbacks: Set<UpdateCallback>
  heartbeatHandle: ReturnType<typeof setInterval> | null
  reconnectAttempt: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
  // Fallback polling
  disconnectedAt: number | null
  fallbackTriggerTimer: ReturnType<typeof setTimeout> | null
  fallbackPollHandle: ReturnType<typeof setInterval> | null
  fallbackActive: boolean
}

const state: WsState = {
  ws: null,
  running: false,
  tokenIds: new Set(),
  liveData: new Map(),
  callbacks: new Set(),
  heartbeatHandle: null,
  reconnectAttempt: 0,
  reconnectTimer: null,
  disconnectedAt: null,
  fallbackTriggerTimer: null,
  fallbackPollHandle: null,
  fallbackActive: false,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emit(update: LiveUpdate): void {
  for (const cb of state.callbacks) {
    try {
      cb(update)
    } catch {
      // callback errors shouldn't crash the WS loop
    }
  }
}

function sendSubscribe(tokenIds: string[]): void {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return

  // Subscribe in batches to avoid oversized frames
  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE)
    state.ws.send(JSON.stringify({
      assets_ids: batch,
      type: 'market',
    }))
  }
}

function sendUnsubscribe(tokenIds: string[]): void {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return

  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    const batch = tokenIds.slice(i, i + BATCH_SIZE)
    state.ws.send(JSON.stringify({
      assets_ids: batch,
      type: 'market',
      action: 'unsubscribe',
    }))
  }
}

function getOrCreateLiveData(tokenId: string): LiveMarketData {
  let data = state.liveData.get(tokenId)
  if (!data) {
    data = {
      tokenId,
      price: 0,
      bestBid: null,
      bestAsk: null,
      spread: null,
      lastTradePrice: null,
      lastTradeSize: null,
      lastTradeSide: null,
      updatedAt: Date.now(),
    }
    state.liveData.set(tokenId, data)
  }
  return data
}

function computeSpread(bid: number | null, ask: number | null): number | null {
  if (bid === null || ask === null) return null
  return ask - bid
}

// ─── Message Handling ───────────────────────────────────────────────────────

interface WsMessage {
  event_type?: string
  asset_id?: string
  price?: string | number
  side?: string
  size?: string | number
  best_bid?: string | number
  best_ask?: string | number
  // book snapshots
  bids?: Array<{ price: string | number; size: string | number }>
  asks?: Array<{ price: string | number; size: string | number }>
}

function handleMessage(raw: string): void {
  let msgs: WsMessage[]
  try {
    const parsed = JSON.parse(raw) as WsMessage | WsMessage[]
    msgs = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return
  }

  for (const msg of msgs) {
    const tokenId = msg.asset_id
    if (!tokenId) continue

    const data = getOrCreateLiveData(tokenId)
    const now = Date.now()
    let updateType: LiveUpdate['type'] | null = null

    switch (msg.event_type) {
      case 'price_change': {
        const price = Number(msg.price)
        if (!isNaN(price) && price > 0) {
          data.price = price
          data.updatedAt = now
          updateType = 'price_change'
        }
        break
      }

      case 'last_trade_price': {
        const price = Number(msg.price)
        if (!isNaN(price) && price > 0) {
          data.lastTradePrice = price
          data.price = price
          data.lastTradeSize = msg.size !== undefined ? Number(msg.size) : null
          data.lastTradeSide = typeof msg.side === 'string' ? msg.side : null
          data.updatedAt = now
          updateType = 'last_trade_price'
        }
        break
      }

      case 'best_bid_ask': {
        const bid = msg.best_bid !== undefined ? Number(msg.best_bid) : null
        const ask = msg.best_ask !== undefined ? Number(msg.best_ask) : null
        if (bid !== null && !isNaN(bid)) data.bestBid = bid
        if (ask !== null && !isNaN(ask)) data.bestAsk = ask
        data.spread = computeSpread(data.bestBid, data.bestAsk)
        if (data.bestBid !== null && data.bestAsk !== null) {
          data.price = (data.bestBid + data.bestAsk) / 2
        }
        data.updatedAt = now
        updateType = 'best_bid_ask'
        break
      }

      case 'book': {
        if (Array.isArray(msg.bids) && msg.bids.length > 0) {
          data.bestBid = Number(msg.bids[0].price)
        }
        if (Array.isArray(msg.asks) && msg.asks.length > 0) {
          data.bestAsk = Number(msg.asks[0].price)
        }
        data.spread = computeSpread(data.bestBid, data.bestAsk)
        if (data.bestBid !== null && data.bestAsk !== null) {
          data.price = (data.bestBid + data.bestAsk) / 2
        }
        data.updatedAt = now
        updateType = 'book'
        break
      }
    }

    if (updateType) {
      emit({
        type: updateType,
        tokenId,
        data: { ...data },
        timestamp: now,
      })
    }
  }
}

// ─── REST Fallback Polling ───────────────────────────────────────────────────

async function fetchMidpoint(tokenId: string): Promise<number | null> {
  try {
    const res = await fetch(`${CLOB_BASE}/midpoint?token_id=${tokenId}`)
    if (!res.ok) return null
    const body = (await res.json()) as { mid?: string }
    const mid = Number(body.mid)
    return isNaN(mid) ? null : mid
  } catch {
    return null
  }
}

async function pollFallbackBatch(tokenIds: string[]): Promise<void> {
  // Process in chunks with concurrency limit
  for (let i = 0; i < tokenIds.length; i += FALLBACK_CONCURRENCY) {
    const chunk = tokenIds.slice(i, i + FALLBACK_CONCURRENCY)
    const results = await Promise.allSettled(
      chunk.map(async (tokenId) => {
        const mid = await fetchMidpoint(tokenId)
        return { tokenId, mid }
      }),
    )

    const now = Date.now()
    for (const result of results) {
      if (result.status !== 'fulfilled') continue
      const { tokenId, mid } = result.value
      if (mid === null) continue

      const data = getOrCreateLiveData(tokenId)
      const changed = Math.abs(data.price - mid) > 0.0001
      data.price = mid
      data.updatedAt = now

      if (changed) {
        emit({
          type: 'price_change',
          tokenId,
          data: { ...data },
          timestamp: now,
        })
      }
    }
  }
}

function startFallbackPolling(): void {
  if (state.fallbackActive) return
  state.fallbackActive = true

  console.log('[polymarket-ws] WS down >10s — starting REST fallback polling')

  // Immediate first poll
  const ids = Array.from(state.tokenIds)
  pollFallbackBatch(ids).catch(() => {
    // swallow — individual fetch errors are already handled
  })

  state.fallbackPollHandle = setInterval(() => {
    const currentIds = Array.from(state.tokenIds)
    if (currentIds.length === 0) return
    pollFallbackBatch(currentIds).catch(() => {})
  }, FALLBACK_POLL_MS)
}

function stopFallbackPolling(): void {
  if (state.fallbackTriggerTimer) {
    clearTimeout(state.fallbackTriggerTimer)
    state.fallbackTriggerTimer = null
  }
  if (state.fallbackPollHandle) {
    clearInterval(state.fallbackPollHandle)
    state.fallbackPollHandle = null
  }
  if (state.fallbackActive) {
    console.log('[polymarket-ws] Stopping REST fallback polling')
    state.fallbackActive = false
  }
  state.disconnectedAt = null
}

function scheduleFallbackTrigger(): void {
  if (state.fallbackTriggerTimer) return
  if (state.fallbackActive) return

  state.disconnectedAt = Date.now()
  state.fallbackTriggerTimer = setTimeout(() => {
    state.fallbackTriggerTimer = null
    if (state.running && !isConnected()) {
      startFallbackPolling()
    }
  }, FALLBACK_TRIGGER_MS)
}

// ─── Connection Management ──────────────────────────────────────────────────

function startHeartbeat(): void {
  stopHeartbeat()
  state.heartbeatHandle = setInterval(() => {
    if (state.ws && state.ws.readyState === WebSocket.OPEN) {
      state.ws.ping()
    }
  }, HEARTBEAT_INTERVAL_MS)
}

function stopHeartbeat(): void {
  if (state.heartbeatHandle) {
    clearInterval(state.heartbeatHandle)
    state.heartbeatHandle = null
  }
}

function scheduleReconnect(): void {
  if (!state.running) return
  if (state.reconnectTimer) return

  const delay = Math.min(
    1000 * Math.pow(2, state.reconnectAttempt),
    MAX_RECONNECT_DELAY_MS,
  )
  state.reconnectAttempt++

  console.log(`[polymarket-ws] Reconnecting in ${delay}ms (attempt ${state.reconnectAttempt})`)

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null
    if (state.running) connect()
  }, delay)
}

function connect(): void {
  if (state.ws) {
    state.ws.removeAllListeners()
    if (state.ws.readyState === WebSocket.OPEN || state.ws.readyState === WebSocket.CONNECTING) {
      state.ws.close()
    }
    state.ws = null
  }

  const ws = new WebSocket(WS_URL)
  state.ws = ws

  ws.on('open', () => {
    console.log('[polymarket-ws] Connected')
    state.reconnectAttempt = 0
    startHeartbeat()
    stopFallbackPolling()

    // Re-subscribe to all tracked token IDs
    const ids = Array.from(state.tokenIds)
    if (ids.length > 0) {
      sendSubscribe(ids)
      console.log(`[polymarket-ws] Subscribed to ${ids.length} tokens`)
    }
  })

  ws.on('message', (raw: WebSocket.Data) => {
    handleMessage(raw.toString())
  })

  ws.on('close', (code: number, reason: Buffer) => {
    console.log(`[polymarket-ws] Disconnected: ${code} ${reason.toString()}`)
    stopHeartbeat()
    scheduleFallbackTrigger()
    scheduleReconnect()
  })

  ws.on('error', (error: Error) => {
    console.error(`[polymarket-ws] Error: ${error.message}`)
    // 'close' will fire after 'error', triggering reconnect
  })

  ws.on('pong', () => {
    // heartbeat acknowledged
  })
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function startPolymarketWS(tokenIds: string[]): void {
  if (state.running) return

  state.running = true
  for (const id of tokenIds) {
    state.tokenIds.add(id)
  }

  console.log(`[polymarket-ws] Starting with ${tokenIds.length} tokens`)
  connect()
}

export function stopPolymarketWS(): void {
  state.running = false
  stopHeartbeat()
  stopFallbackPolling()

  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer)
    state.reconnectTimer = null
  }

  if (state.ws) {
    state.ws.removeAllListeners()
    if (state.ws.readyState === WebSocket.OPEN) {
      state.ws.close()
    }
    state.ws = null
  }

  state.liveData.clear()
  state.tokenIds.clear()
  state.callbacks.clear()
  state.reconnectAttempt = 0

  console.log('[polymarket-ws] Stopped')
}

export function subscribeMarkets(tokenIds: string[]): void {
  const newIds = tokenIds.filter((id) => !state.tokenIds.has(id))
  if (newIds.length === 0) return

  for (const id of newIds) {
    state.tokenIds.add(id)
  }

  sendSubscribe(newIds)
}

export function unsubscribeMarkets(tokenIds: string[]): void {
  const toRemove = tokenIds.filter((id) => state.tokenIds.has(id))
  if (toRemove.length === 0) return

  for (const id of toRemove) {
    state.tokenIds.delete(id)
    state.liveData.delete(id)
  }

  sendUnsubscribe(toRemove)
}

export function getLivePrice(tokenId: string): LiveMarketData | undefined {
  return state.liveData.get(tokenId)
}

export function getAllLiveData(): Map<string, LiveMarketData> {
  return new Map(state.liveData)
}

/** Register a callback for live updates. Returns an unsubscribe function. */
export function onUpdate(callback: UpdateCallback): () => void {
  state.callbacks.add(callback)
  return () => {
    state.callbacks.delete(callback)
  }
}

/** Check if the WebSocket is currently connected */
export function isConnected(): boolean {
  return state.ws !== null && state.ws.readyState === WebSocket.OPEN
}
