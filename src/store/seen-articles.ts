import { db, schema } from '@/db'
import { eq, and, lt } from 'drizzle-orm'

type ArticleSource = 'rss' | 'news'

const MAX_ROWS = 10_000
const MAX_AGE_HOURS = 48

/** Check if an article key has been seen before. */
export function hasSeenArticle(key: string, source: ArticleSource): boolean {
  const row = db
    .select({ key: schema.seenArticles.key })
    .from(schema.seenArticles)
    .where(
      and(
        eq(schema.seenArticles.key, key),
        eq(schema.seenArticles.source, source),
      ),
    )
    .limit(1)
    .get()
  return row !== undefined
}

/** Mark an article key as seen. */
export function markArticleSeen(key: string, source: ArticleSource): void {
  db.insert(schema.seenArticles)
    .values({ key, source, createdAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run()
}

/** Load all seen keys for a source into a Set (used on startup). */
export function loadSeenKeys(source: ArticleSource): Set<string> {
  const rows = db
    .select({ key: schema.seenArticles.key })
    .from(schema.seenArticles)
    .where(eq(schema.seenArticles.source, source))
    .all()
  return new Set(rows.map((r) => r.key))
}

/** Prune old entries to keep the table bounded. */
export function pruneSeenArticles(): number {
  const cutoff = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString()
  const result = db
    .delete(schema.seenArticles)
    .where(lt(schema.seenArticles.createdAt, cutoff))
    .run()
  return result.changes
}
