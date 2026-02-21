import { sqliteTable, text, real } from 'drizzle-orm/sqlite-core';

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
});
