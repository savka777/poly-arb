import { db, schema } from '@/db';
import { eq, desc, gte, lt, count, and } from 'drizzle-orm';
import type { Signal, CostBreakdown } from '@/lib/types';

function rowToSignal(row: typeof schema.signals.$inferSelect): Signal {
  const signal: Signal = {
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

  if (row.evNet != null) signal.evNet = row.evNet;
  if (row.costs) signal.costs = JSON.parse(row.costs) as CostBreakdown;
  if (row.features) signal.features = JSON.parse(row.features) as { zNews: number; zTime: number };
  if (row.tradeable != null) signal.tradeable = row.tradeable;
  if (row.pHatLb != null) signal.pHatLB = row.pHatLb;

  return signal;
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
    evNet: signal.evNet ?? null,
    costs: signal.costs ? JSON.stringify(signal.costs) : null,
    features: signal.features ? JSON.stringify(signal.features) : null,
    tradeable: signal.tradeable ?? null,
    pHatLb: signal.pHatLB ?? null,
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
  const result = db.select({ value: count() }).from(schema.signals).get();
  return result?.value ?? 0;
}

export function hasRecentSignal(marketId: string, ttlMs: number): boolean {
  const cutoff = new Date(Date.now() - ttlMs).toISOString();
  const row = db
    .select({ id: schema.signals.id })
    .from(schema.signals)
    .where(
      and(
        eq(schema.signals.marketId, marketId),
        gte(schema.signals.createdAt, cutoff),
      ),
    )
    .limit(1)
    .get();
  return row !== undefined;
}

export function pruneExpiredSignals(): number {
  const now = new Date().toISOString();
  const result = db
    .delete(schema.signals)
    .where(lt(schema.signals.expiresAt, now))
    .run();
  return result.changes;
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
