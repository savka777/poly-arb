import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const signals = sqliteTable('signals', {
  id: text('id').primaryKey(),
  marketId: text('market_id').notNull(),
  marketQuestion: text('market_question').notNull(),
  darwinEstimate: real('darwin_estimate').notNull(),
  marketPrice: real('market_price').notNull(),
  ev: real('ev').notNull(),
  direction: text('direction', { enum: ['yes', 'no'] }).notNull(),
  reasoning: text('reasoning').notNull(),
  newsEvents: text('news_events').notNull(), // JSON string
  confidence: text('confidence', { enum: ['low', 'medium', 'high'] }).notNull(),
  createdAt: text('created_at').notNull(),
  expiresAt: text('expires_at').notNull(),
  evNet: real('ev_net'),
  costs: text('costs'), // JSON string
  features: text('features'), // JSON string
  tradeable: integer('tradeable', { mode: 'boolean' }),
  pHatLb: real('p_hat_lb'),
});

export const markets = sqliteTable('markets', {
  id: text('id').primaryKey(),
  question: text('question').notNull(),
  probability: real('probability').notNull(),
  volume: real('volume').notNull(),
  liquidity: real('liquidity').notNull(),
  endDate: text('end_date').notNull(),
  url: text('url').notNull(),
  category: text('category'),
  lastUpdated: text('last_updated').notNull(),
  volume24hr: real('volume_24hr'),
  spread: real('spread'),
  clobTokenId: text('clob_token_id'),
  eventId: text('event_id'),
  eventTitle: text('event_title'),
  tags: text('tags'), // JSON array
  oneDayPriceChange: real('one_day_price_change'),
  syncedAt: text('synced_at'),
});

export const watchlist = sqliteTable('watchlist', {
  marketId: text('market_id').primaryKey(),
  addedAt: text('added_at').notNull(),
});
