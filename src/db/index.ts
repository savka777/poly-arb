import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

export { schema };

let _db: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!_db) {
    const dbPath = path.resolve(process.cwd(), 'darwin.db');
    const sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    sqlite.pragma('journal_mode = WAL');

    // Ensure tables exist
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        market_id TEXT NOT NULL,
        market_question TEXT NOT NULL,
        darwin_estimate REAL NOT NULL,
        market_price REAL NOT NULL,
        ev REAL NOT NULL,
        direction TEXT NOT NULL CHECK(direction IN ('yes', 'no')),
        reasoning TEXT NOT NULL,
        news_events TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK(confidence IN ('low', 'medium', 'high')),
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS markets (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        probability REAL NOT NULL,
        volume REAL NOT NULL,
        liquidity REAL NOT NULL,
        end_date TEXT NOT NULL,
        url TEXT NOT NULL,
        category TEXT,
        last_updated TEXT NOT NULL
      );
    `);

    _db = drizzle(sqlite, { schema });
  }
  return _db;
}

// Proxy for backward-compatible `db` usage
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
