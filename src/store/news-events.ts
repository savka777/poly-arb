import type { NewsEvent } from '@/lib/types';

const MAX_EVENTS = 100;
const events: NewsEvent[] = [];

export function addNewsEvent(event: NewsEvent): void {
  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
}

export function getRecentNewsEvents(limit = 20): NewsEvent[] {
  return events.slice(0, limit);
}

export function getNewsEventCount(): number {
  return events.length;
}
