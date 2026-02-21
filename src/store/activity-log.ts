import { nanoid } from 'nanoid';
import type { ActivityEntry, ActivitySource, ActivityLevel } from '@/lib/types';

const MAX_ENTRIES = 200;
const entries: ActivityEntry[] = [];

export function logActivity(
  source: ActivitySource,
  level: ActivityLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  const entry: ActivityEntry = {
    id: nanoid(),
    timestamp: new Date().toISOString(),
    source,
    level,
    message,
    details,
  };

  entries.push(entry);

  // Ring buffer: drop oldest when over limit
  if (entries.length > MAX_ENTRIES) {
    entries.splice(0, entries.length - MAX_ENTRIES);
  }

  // Also log to console for dev visibility
  const prefix = `[${source}]`;
  if (level === 'error') {
    console.error(prefix, message);
  } else if (level === 'warn') {
    console.warn(prefix, message);
  } else {
    console.log(prefix, message);
  }
}

export function getActivityLog(limit = 50): ActivityEntry[] {
  const start = Math.max(0, entries.length - limit);
  return entries.slice(start).reverse(); // newest first
}

export function getActivityCount(): number {
  return entries.length;
}
