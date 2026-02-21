import { db, schema } from '@/db';
import { eq, desc, like, or, count, sql, inArray } from 'drizzle-orm';
import type { Market } from '@/lib/types';

type MarketRow = typeof schema.markets.$inferSelect;

function rowToMarket(row: MarketRow): Market {
  return {
    id: row.id,
    platform: 'polymarket',
    question: row.question,
    probability: row.probability,
    volume: row.volume,
    liquidity: row.liquidity,
    endDate: row.endDate,
    url: row.url,
    category: row.category ?? undefined,
    lastUpdated: row.lastUpdated,
    volume24hr: row.volume24hr ?? undefined,
    spread: row.spread ?? undefined,
    clobTokenId: row.clobTokenId ?? undefined,
    oneDayPriceChange: row.oneDayPriceChange ?? undefined,
    event: row.eventId && row.eventTitle
      ? { id: row.eventId, title: row.eventTitle }
      : undefined,
  };
}

function marketToRow(market: Market) {
  return {
    id: market.id,
    question: market.question,
    probability: market.probability,
    volume: market.volume,
    liquidity: market.liquidity,
    endDate: market.endDate,
    url: market.url,
    category: market.category ?? null,
    lastUpdated: market.lastUpdated,
    volume24hr: market.volume24hr ?? null,
    spread: market.spread ?? null,
    clobTokenId: market.clobTokenId ?? null,
    eventId: market.event?.id ?? null,
    eventTitle: market.event?.title ?? null,
    tags: null as string | null,
    oneDayPriceChange: market.oneDayPriceChange ?? null,
    syncedAt: new Date().toISOString(),
  };
}

export interface GetAllMarketsOptions {
  page?: number;
  limit?: number;
  sort?: 'volume24hr' | 'volume' | 'liquidity' | 'probability' | 'endDate';
  category?: string;
  search?: string;
  marketIds?: string[];
}

export function getAllMarkets(opts: GetAllMarketsOptions = {}): {
  markets: Market[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
} {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const offset = (page - 1) * limit;

  // When marketIds is provided, fetch exactly those markets (no pagination needed)
  if (opts.marketIds && opts.marketIds.length > 0) {
    const orderBy = getOrderBy(opts.sort);
    const rows = db
      .select()
      .from(schema.markets)
      .where(inArray(schema.markets.id, opts.marketIds))
      .orderBy(orderBy)
      .all();

    const markets = rows.map(rowToMarket);
    return {
      markets,
      total: markets.length,
      page: 1,
      pageSize: markets.length,
      totalPages: 1,
    };
  }

  // Build combined WHERE condition
  let where: ReturnType<typeof eq> | ReturnType<typeof sql> | undefined;

  if (opts.category) {
    where = eq(schema.markets.category, opts.category);
  }

  if (opts.search) {
    const searchPattern = `%${opts.search}%`;
    const searchCondition = or(
      like(schema.markets.question, searchPattern),
      like(schema.markets.category, searchPattern),
      like(schema.markets.eventTitle, searchPattern),
    );

    where = where
      ? sql`${where} AND ${searchCondition}`
      : searchCondition;
  }

  const totalResult = db
    .select({ value: count() })
    .from(schema.markets)
    .where(where)
    .get();
  const total = totalResult?.value ?? 0;

  const orderBy = getOrderBy(opts.sort);

  const rows = db
    .select()
    .from(schema.markets)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset)
    .all();

  return {
    markets: rows.map(rowToMarket),
    total,
    page,
    pageSize: limit,
    totalPages: Math.ceil(total / limit),
  };
}

function getOrderBy(sort?: string) {
  switch (sort) {
    case 'volume':
      return desc(schema.markets.volume);
    case 'liquidity':
      return desc(schema.markets.liquidity);
    case 'probability':
      return desc(schema.markets.probability);
    case 'endDate':
      return desc(schema.markets.endDate);
    case 'volume24hr':
    default:
      return desc(schema.markets.volume24hr);
  }
}

export function getMarketById(id: string): Market | null {
  const row = db
    .select()
    .from(schema.markets)
    .where(eq(schema.markets.id, id))
    .get();

  return row ? rowToMarket(row) : null;
}

export function getMarketsByKeywords(keywords: string[]): Market[] {
  if (keywords.length === 0) return [];

  const conditions = keywords.map(
    (kw) => like(schema.markets.question, `%${kw}%`),
  );

  const rows = db
    .select()
    .from(schema.markets)
    .where(or(...conditions))
    .limit(100)
    .all();

  return rows.map(rowToMarket);
}

export function saveMarket(market: Market): void {
  const row = marketToRow(market);
  db.insert(schema.markets)
    .values(row)
    .onConflictDoUpdate({
      target: schema.markets.id,
      set: row,
    })
    .run();
}

export function bulkUpsertMarkets(markets: Market[]): number {
  if (markets.length === 0) return 0;

  let inserted = 0;
  // Batch in groups of 50 to avoid SQLite variable limits
  const batchSize = 50;
  for (let i = 0; i < markets.length; i += batchSize) {
    const batch = markets.slice(i, i + batchSize);
    for (const market of batch) {
      const row = marketToRow(market);
      db.insert(schema.markets)
        .values(row)
        .onConflictDoUpdate({
          target: schema.markets.id,
          set: row,
        })
        .run();
      inserted++;
    }
  }
  return inserted;
}

export function getMarketCount(): number {
  const result = db.select({ value: count() }).from(schema.markets).get();
  return result?.value ?? 0;
}

export function getAllMarketsList(): Market[] {
  const rows = db
    .select()
    .from(schema.markets)
    .all();
  return rows.map(rowToMarket);
}
