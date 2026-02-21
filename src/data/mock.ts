import type { Market, NewsResult } from '@/lib/types';

export function getMockMarkets(): Market[] {
  return [
    {
      id: 'mock-fed-rate-cut-2026',

      platform: 'polymarket',
      question: 'Will the Federal Reserve cut interest rates before July 2026?',
      probability: 0.62,
      volume: 4_250_000,
      liquidity: 820_000,
      endDate: '2026-07-01T00:00:00Z',
      url: 'https://polymarket.com/event/fed-rate-cut-july-2026',
      category: 'economics',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'mock-us-recession-2026',
      platform: 'polymarket',
      question: 'Will the US enter a recession in 2026?',
      probability: 0.28,
      volume: 3_100_000,
      liquidity: 560_000,
      endDate: '2026-12-31T00:00:00Z',
      url: 'https://polymarket.com/event/us-recession-2026',
      category: 'economics',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'mock-trump-tariff-china',
      platform: 'polymarket',
      question: 'Will the US impose additional tariffs on China before June 2026?',
      probability: 0.74,
      volume: 2_800_000,
      liquidity: 410_000,
      endDate: '2026-06-01T00:00:00Z',
      url: 'https://polymarket.com/event/trump-tariff-china-2026',
      category: 'politics',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'mock-ukraine-ceasefire',
      platform: 'polymarket',
      question: 'Will there be a formal ceasefire in Ukraine before September 2026?',
      probability: 0.19,
      volume: 5_600_000,
      liquidity: 1_200_000,
      endDate: '2026-09-01T00:00:00Z',
      url: 'https://polymarket.com/event/ukraine-ceasefire-2026',
      category: 'geopolitics',
      lastUpdated: new Date().toISOString(),
    },
    {
      id: 'mock-btc-100k',
      platform: 'polymarket',
      question: 'Will Bitcoin exceed $100,000 before April 2026?',
      probability: 0.55,
      volume: 8_900_000,
      liquidity: 2_300_000,
      endDate: '2026-04-01T00:00:00Z',
      url: 'https://polymarket.com/event/btc-100k-april-2026',
      category: 'crypto',
      lastUpdated: new Date().toISOString(),
    },
  ];
}

export function getMockMarketDetail(id: string): Market | null {
  const markets = getMockMarkets();
  return markets.find((m) => m.id === id) ?? null;
}

export function getMockNewsResults(query: string): NewsResult[] {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('fed') || lowerQuery.includes('rate') || lowerQuery.includes('interest')) {
    return [
      {
        title: 'Fed Officials Signal Openness to Rate Cut Amid Cooling Inflation',
        content:
          'Several Federal Reserve governors indicated in recent speeches that slowing inflation data could warrant a rate cut as early as Q2 2026. Core PCE fell to 2.3% in January, below consensus expectations of 2.5%.',
        source: 'Reuters',
        relevanceScore: 0.95,
      },
      {
        title: 'January Jobs Report Shows Labor Market Softening',
        content:
          'The US economy added 142,000 jobs in January 2026, below the 185,000 forecast. The unemployment rate ticked up to 4.3%, adding to the case for monetary easing.',
        source: 'Bloomberg',
        relevanceScore: 0.88,
      },
      {
        title: 'Treasury Yields Drop as Markets Price in Earlier Rate Cuts',
        content:
          'The 2-year Treasury yield fell 12 basis points to 3.82% as futures markets now price a 78% probability of a June rate cut, up from 55% last week.',
        source: 'Financial Times',
        relevanceScore: 0.82,
      },
    ];
  }

  if (lowerQuery.includes('recession')) {
    return [
      {
        title: 'Leading Economic Indicators Fall for Third Consecutive Month',
        content:
          'The Conference Board Leading Economic Index declined 0.4% in January, marking the third straight monthly decline. However, consumer spending remains resilient.',
        source: 'CNBC',
        relevanceScore: 0.91,
      },
      {
        title: 'Manufacturing PMI Contracts to 47.2 in February',
        content:
          'The ISM Manufacturing PMI fell to 47.2, deeper into contraction territory. New orders sub-index dropped to 44.8, the lowest since March 2023.',
        source: 'Wall Street Journal',
        relevanceScore: 0.87,
      },
      {
        title: 'Goldman Sachs Raises Recession Probability to 35%',
        content:
          'Goldman Sachs economists raised their 12-month recession probability estimate from 25% to 35%, citing weakening manufacturing data and tightening credit conditions.',
        source: 'Bloomberg',
        relevanceScore: 0.84,
      },
    ];
  }

  if (lowerQuery.includes('tariff') || lowerQuery.includes('china') || lowerQuery.includes('trade')) {
    return [
      {
        title: 'White House Announces Review of China Trade Policy',
        content:
          'The Trump administration announced a comprehensive review of trade relations with China, with senior officials suggesting additional tariffs on technology and EV imports could be imposed within 90 days.',
        source: 'Reuters',
        relevanceScore: 0.93,
      },
      {
        title: 'China Retaliates with Tariffs on US Agricultural Exports',
        content:
          'Beijing imposed 25% tariffs on $18 billion worth of US agricultural products in response to recent semiconductor export restrictions, escalating trade tensions.',
        source: 'Financial Times',
        relevanceScore: 0.89,
      },
      {
        title: 'US Trade Deficit with China Widens to $32B in January',
        content:
          'The US trade deficit with China expanded to $32 billion in January, providing ammunition for hawks in the administration pushing for stronger trade measures.',
        source: 'CNBC',
        relevanceScore: 0.78,
      },
    ];
  }

  if (lowerQuery.includes('ukraine') || lowerQuery.includes('ceasefire') || lowerQuery.includes('russia')) {
    return [
      {
        title: 'Diplomatic Talks Between US and Russia Stall Over Territory',
        content:
          'Peace negotiations mediated by the US have stalled as Russia insists on retaining control of occupied territories. Ukrainian President Zelensky rejected the proposal as "surrender terms."',
        source: 'Associated Press',
        relevanceScore: 0.94,
      },
      {
        title: 'EU Announces New Sanctions Package Targeting Russian Energy',
        content:
          'The European Union approved its 15th sanctions package against Russia, targeting remaining energy imports and financial institutions. The move signals continued Western resolve.',
        source: 'BBC News',
        relevanceScore: 0.81,
      },
      {
        title: 'Ukraine Launches Counteroffensive in Zaporizhzhia Region',
        content:
          'Ukrainian forces began a new offensive operation in the Zaporizhzhia region, recapturing several settlements. Military analysts say the operation reduces near-term ceasefire probability.',
        source: 'The Guardian',
        relevanceScore: 0.88,
      },
    ];
  }

  // Default fallback for any other query
  return [
    {
      title: `Latest Developments: ${query}`,
      content: `Recent analysis suggests significant developments related to "${query}" that could affect prediction market pricing. Multiple sources report shifting fundamentals.`,
      source: 'Reuters',
      relevanceScore: 0.75,
    },
    {
      title: `Expert Analysis on ${query}`,
      content: `Leading analysts have updated their forecasts regarding "${query}", with consensus estimates shifting based on new data released this week.`,
      source: 'Bloomberg',
      relevanceScore: 0.7,
    },
    {
      title: `Market Implications of ${query}`,
      content: `Financial markets are beginning to price in new information related to "${query}". Prediction market volumes have increased 40% over the past week.`,
      source: 'Financial Times',
      relevanceScore: 0.65,
    },
  ];
}
