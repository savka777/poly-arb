import type { ScoutEvent } from '@/lib/types';

const MAX_EVENTS = 50;
const events: ScoutEvent[] = [];

// Tracks article URLs already surfaced as scout alerts.
// Prevents the same article from firing a second ScoutEvent even if the
// RSS watcher's per-session seenKeys is reset (e.g. high-traffic feeds).
const seenArticleUrls = new Set<string>();

export function isArticleUrlSeen(url: string): boolean {
  return url ? seenArticleUrls.has(url) : false;
}

export function markArticleUrlSeen(url: string): void {
  if (url) seenArticleUrls.add(url);
}

// Tracks events the user has dismissed from the notification panel.
const dismissedIds = new Set<string>();

export function dismissScoutEvent(id: string): void {
  dismissedIds.add(id);
}

export function addScoutEvent(event: ScoutEvent): void {
  events.unshift(event);
  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }
}

export function getRecentScoutEvents(limit = 10): ScoutEvent[] {
  return events.filter((e) => !dismissedIds.has(e.id)).slice(0, limit);
}

export function getLatestScoutEvent(): ScoutEvent | null {
  return events.find((e) => !dismissedIds.has(e.id)) ?? null;
}

export function getScoutEventCount(): number {
  return events.length;
}
