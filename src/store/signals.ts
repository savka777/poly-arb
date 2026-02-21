import { db, schema } from '@/db';
import { eq, desc, gte } from 'drizzle-orm';
import type { Signal } from '@/lib/types';

function rowToSignal(row: typeof schema.signals.$inferSelect): Signal {
  return {
    id: row.id,
    marketId: row.marketId,
    marketQuestion: row.marketQuestion,
    darwinEstimate: row.darwinEstimate,
    marketPrice: row.marketPrice,
    ev: row.ev,
    direction: row.direction,
    reasoning: row.reasoning,
    newsEvents: JSON.parse(row.newsEvents) as string[],
    confidence: row.confidence,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  };
}

function signalToRow(signal: Signal) {
  return {
    id: signal.id,
    marketId: signal.marketId,
    marketQuestion: signal.marketQuestion,
    darwinEstimate: signal.darwinEstimate,
    marketPrice: signal.marketPrice,
    ev: signal.ev,
    direction: signal.direction,
    reasoning: signal.reasoning,
    newsEvents: JSON.stringify(signal.newsEvents),
    confidence: signal.confidence,
    createdAt: signal.createdAt,
    expiresAt: signal.expiresAt,
  };
}

export function saveSignal(signal: Signal): void {
  db.insert(schema.signals)
    .values(signalToRow(signal))
    .onConflictDoUpdate({
      target: schema.signals.id,
      set: signalToRow(signal),
    })
    .run();
}

export function getSignals(filters?: {
  confidence?: 'low' | 'medium' | 'high';
  minEv?: number;
}): Signal[] {
  let rows = db
    .select()
    .from(schema.signals)
    .orderBy(desc(schema.signals.createdAt))
    .all();

  if (filters?.confidence) {
    rows = rows.filter((r) => r.confidence === filters.confidence);
  }
  if (filters?.minEv !== undefined) {
    rows = rows.filter((r) => Math.abs(r.ev) >= filters.minEv!);
  }

  return rows.map(rowToSignal);
}

export function getSignalsByMarket(marketId: string): Signal[] {
  const rows = db
    .select()
    .from(schema.signals)
    .where(eq(schema.signals.marketId, marketId))
    .orderBy(desc(schema.signals.createdAt))
    .all();

  return rows.map(rowToSignal);
}

export function getRecentSignals(hours: number): Signal[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = db
    .select()
    .from(schema.signals)
    .where(gte(schema.signals.createdAt, cutoff))
    .orderBy(desc(schema.signals.createdAt))
    .all();

  return rows.map(rowToSignal);
}

export function getSignalCount(): number {
  const rows = db.select().from(schema.signals).all();
  return rows.length;
}

export function getLatestSignalTimestamp(): string | null {
  const row = db
    .select()
    .from(schema.signals)
    .orderBy(desc(schema.signals.createdAt))
    .limit(1)
    .all();

  return row.length > 0 ? row[0].createdAt : null;
}
