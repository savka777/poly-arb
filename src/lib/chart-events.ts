type Handler<T = unknown> = (data: T) => void

export interface CrosshairEvent {
  sourceId: string
  time: number | null
  price: number | null
}

export interface TimeFrameEvent {
  sourceId: string
  timeFrame: string
}

type EventMap = {
  crosshair: CrosshairEvent
  timeframe: TimeFrameEvent
}

class ChartEventBus {
  private listeners = new Map<string, Set<Handler<never>>>()

  on<K extends keyof EventMap>(event: K, handler: Handler<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const handlers = this.listeners.get(event)!
    handlers.add(handler as Handler<never>)
    return () => {
      handlers.delete(handler as Handler<never>)
    }
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const handler of handlers) {
      (handler as Handler<EventMap[K]>)(data)
    }
  }
}

export const chartEventBus = new ChartEventBus()
