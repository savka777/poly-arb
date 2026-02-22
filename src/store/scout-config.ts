// In-memory scout keyword filter.
// Empty array = match all news (default behavior preserved).
// Set via POST /api/scout/config; read by rss-watcher before market matching.

let keywords: string[] = []

export function getScoutKeywords(): string[] {
  return keywords
}

export function setScoutKeywords(kws: string[]): void {
  keywords = kws.map((k) => k.trim().toLowerCase()).filter(Boolean)
}
