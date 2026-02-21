/**
 * RSS Feed Registry — categorized list of news feeds to monitor.
 *
 * Every active event on Polymarket can potentially be affected by breaking news.
 * We cast a wide net: politics, crypto, finance, sports, world, tech, science.
 *
 * All feeds are free, no API keys required.
 */

export interface FeedSource {
  url: string
  category: string
  name: string
  /** Expected update frequency in minutes (rough guide for prioritization) */
  freshnessMin: number
}

export const FEEDS: FeedSource[] = [
  // ─── Google News (aggregates thousands of sources) ────────────────────────
  { url: 'https://news.google.com/rss', category: 'general', name: 'Google News Top', freshnessMin: 5 },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB', category: 'business', name: 'Google News Business', freshnessMin: 5 },
  { url: 'https://news.google.com/rss/search?q=politics+when:1d&hl=en-US&gl=US&ceid=US:en', category: 'politics', name: 'Google News Politics', freshnessMin: 5 },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB', category: 'tech', name: 'Google News Tech', freshnessMin: 10 },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB', category: 'science', name: 'Google News Science', freshnessMin: 15 },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNREpxYW5RU0FtVnVHZ0pWVXlnQVAB', category: 'sports', name: 'Google News Sports', freshnessMin: 5 },
  { url: 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB', category: 'health', name: 'Google News Health', freshnessMin: 15 },
  { url: 'https://news.google.com/rss/search?q=entertainment+when:1d&hl=en-US&gl=US&ceid=US:en', category: 'entertainment', name: 'Google News Entertainment', freshnessMin: 15 },
  { url: 'https://news.google.com/rss/topics/CAAqIQgKIhtDQkFTRGdvSUwyMHZNR3QwTlRFU0FtVnVLQUFQAQ', category: 'world', name: 'Google News World', freshnessMin: 5 },

  // ─── Wire Services (fastest for breaking) ──────────────────────────────────
  { url: 'https://feeds.bbci.co.uk/news/rss.xml', category: 'general', name: 'BBC News Top', freshnessMin: 5 },
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world', name: 'BBC World', freshnessMin: 5 },
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', category: 'business', name: 'BBC Business', freshnessMin: 10 },
  { url: 'https://feeds.bbci.co.uk/news/politics/rss.xml', category: 'politics', name: 'BBC Politics', freshnessMin: 10 },
  { url: 'https://feeds.bbci.co.uk/sport/rss.xml', category: 'sports', name: 'BBC Sport', freshnessMin: 5 },
  { url: 'https://feeds.bbci.co.uk/news/technology/rss.xml', category: 'tech', name: 'BBC Tech', freshnessMin: 15 },
  { url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'science', name: 'BBC Science', freshnessMin: 15 },

  // ─── Wire Services ──────────────────────────────────────────────────────────
  { url: 'https://www.cbsnews.com/latest/rss/main', category: 'general', name: 'CBS News', freshnessMin: 5 },

  // ─── US Politics ───────────────────────────────────────────────────────────
  { url: 'https://www.axios.com/feeds/feed.rss', category: 'politics', name: 'Axios', freshnessMin: 10 },
  { url: 'https://thehill.com/feed/', category: 'politics', name: 'The Hill', freshnessMin: 10 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', category: 'politics', name: 'NYT Politics', freshnessMin: 10 },

  // ─── Finance / Markets ────────────────────────────────────────────────────
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', category: 'business', name: 'CNBC Top', freshnessMin: 5 },
  { url: 'https://www.cnbc.com/id/10000664/device/rss/rss.html', category: 'business', name: 'CNBC Finance', freshnessMin: 5 },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', category: 'business', name: 'MarketWatch', freshnessMin: 5 },
  { url: 'https://feeds.bloomberg.com/markets/news.rss', category: 'business', name: 'Bloomberg Markets', freshnessMin: 5 },
  { url: 'https://www.ft.com/?format=rss', category: 'business', name: 'Financial Times', freshnessMin: 10 },

  // ─── Crypto ────────────────────────────────────────────────────────────────
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', category: 'crypto', name: 'CoinDesk', freshnessMin: 5 },
  { url: 'https://cointelegraph.com/rss', category: 'crypto', name: 'CoinTelegraph', freshnessMin: 5 },
  { url: 'https://decrypt.co/feed', category: 'crypto', name: 'Decrypt', freshnessMin: 10 },
  { url: 'https://www.theblock.co/rss.xml', category: 'crypto', name: 'The Block', freshnessMin: 10 },
  { url: 'https://bitcoinmagazine.com/.rss/full/', category: 'crypto', name: 'Bitcoin Magazine', freshnessMin: 15 },
  { url: 'https://www.dlnews.com/arc/outboundfeeds/rss/', category: 'crypto', name: 'DL News', freshnessMin: 10 },

  // ─── Sports ────────────────────────────────────────────────────────────────
  { url: 'https://www.espn.com/espn/rss/news', category: 'sports', name: 'ESPN Top', freshnessMin: 5 },
  { url: 'https://www.espn.com/espn/rss/nfl/news', category: 'sports', name: 'ESPN NFL', freshnessMin: 10 },
  { url: 'https://www.espn.com/espn/rss/nba/news', category: 'sports', name: 'ESPN NBA', freshnessMin: 10 },
  { url: 'https://www.espn.com/espn/rss/soccer/news', category: 'sports', name: 'ESPN Soccer', freshnessMin: 10 },
  { url: 'https://www.espn.com/espn/rss/mlb/news', category: 'sports', name: 'ESPN MLB', freshnessMin: 10 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml', category: 'sports', name: 'NYT Sports', freshnessMin: 15 },

  // ─── World / Geopolitics ──────────────────────────────────────────────────
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'world', name: 'Al Jazeera', freshnessMin: 10 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', category: 'world', name: 'NYT World', freshnessMin: 10 },
  { url: 'https://www.theguardian.com/world/rss', category: 'world', name: 'Guardian World', freshnessMin: 10 },
  { url: 'https://feeds.npr.org/1004/rss.xml', category: 'world', name: 'NPR World', freshnessMin: 15 },

  // ─── Tech ──────────────────────────────────────────────────────────────────
  { url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech', name: 'Ars Technica', freshnessMin: 15 },
  { url: 'https://techcrunch.com/feed/', category: 'tech', name: 'TechCrunch', freshnessMin: 15 },
  { url: 'https://www.theverge.com/rss/index.xml', category: 'tech', name: 'The Verge', freshnessMin: 15 },

  // ─── Science / Health / Climate ────────────────────────────────────────────
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Science.xml', category: 'science', name: 'NYT Science', freshnessMin: 30 },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml', category: 'science', name: 'NYT Climate', freshnessMin: 30 },

  // ─── General / Top Stories ─────────────────────────────────────────────────
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', category: 'general', name: 'NYT Home', freshnessMin: 10 },
  { url: 'https://feeds.npr.org/1001/rss.xml', category: 'general', name: 'NPR News', freshnessMin: 10 },
  { url: 'https://www.theguardian.com/uk/rss', category: 'general', name: 'Guardian UK', freshnessMin: 10 },
  { url: 'https://abcnews.go.com/abcnews/topstories', category: 'general', name: 'ABC News', freshnessMin: 10 },
  { url: 'https://feeds.washingtonpost.com/rss/national', category: 'general', name: 'WaPo National', freshnessMin: 10 },
]

/** Category → feeds lookup for targeted polling */
export function getFeedsByCategory(category: string): FeedSource[] {
  return FEEDS.filter((f) => f.category === category)
}

/** Get all unique categories */
export function getFeedCategories(): string[] {
  return [...new Set(FEEDS.map((f) => f.category))].sort()
}
