import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export function addToWatchlist(marketId: string): void {
  db.insert(schema.watchlist)
    .values({ marketId, addedAt: new Date().toISOString() })
    .onConflictDoNothing()
    .run();
}

export function removeFromWatchlist(marketId: string): void {
  db.delete(schema.watchlist)
    .where(eq(schema.watchlist.marketId, marketId))
    .run();
}

export function getWatchlist(): string[] {
  const rows = db.select().from(schema.watchlist).all();
  return rows.map((r: typeof schema.watchlist.$inferSelect) => r.marketId);
}

export function isWatchlisted(marketId: string): boolean {
  const rows = db
    .select()
    .from(schema.watchlist)
    .where(eq(schema.watchlist.marketId, marketId))
    .all();
  return rows.length > 0;
}
