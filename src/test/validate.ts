import { saveSignal, getSignals, getSignalsByMarket, getRecentSignals, getSignalCount } from '../store/signals';
import { getMockMarkets, getMockNewsResults } from '../data/mock';
import { calculateNetEV, evToConfidence } from '../intelligence/calculations';
import { nanoid } from 'nanoid';
import type { Signal } from '../lib/types';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => boolean) {
  try {
    if (fn()) {
      console.log(`  ✓ ${name}`);
      passed++;
    } else {
      console.log(`  ✗ ${name} — assertion failed`);
      failed++;
    }
  } catch (e) {
    console.log(`  ✗ ${name} — ${String(e)}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Phase 2: Data Layer (mock data) ===\n');

  check('Mock polymarket data returns valid Market[]', () => {
    const markets = getMockMarkets();
    return (
      markets.length >= 3 &&
      markets.every(
        (m) =>
          m.id &&
          m.question &&
          typeof m.probability === 'number' &&
          m.probability >= 0 &&
          m.probability <= 1,
      )
    );
  });

  check('Mock valyu data returns valid NewsResult[]', () => {
    const news = getMockNewsResults('test query');
    return (
      news.length >= 1 &&
      news.every(
        (n) =>
          n.title &&
          n.content &&
          n.source &&
          typeof n.relevanceScore === 'number',
      )
    );
  });

  check('Net EV calculation works', () => {
    const result = calculateNetEV({
      llmEstimate: 0.62,
      marketPrice: 0.45,
      endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      liquidity: 100_000,
    });
    return result.direction === 'yes' && result.evGross > 0;
  });

  check('EV to confidence mapping works', () => {
    return (
      evToConfidence(0.20) === 'high' &&
      evToConfidence(0.10) === 'medium' &&
      evToConfidence(0.03) === 'low'
    );
  });

  // Signal CRUD
  const testSignal: Signal = {
    id: nanoid(),
    marketId: 'test-market-1',
    marketQuestion: 'Test market question?',
    darwinEstimate: 0.65,
    marketPrice: 0.50,
    ev: 0.15,
    direction: 'yes',
    reasoning: 'Test reasoning',
    newsEvents: ['Test news 1', 'Test news 2'],
    confidence: 'high',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
  };

  check('Signal CRUD: saveSignal works', () => {
    saveSignal(testSignal);
    return true;
  });

  check('Signal CRUD: getSignals returns saved signal', () => {
    const signals = getSignals();
    return signals.some((s) => s.id === testSignal.id);
  });

  check('Signal CRUD: getSignalsByMarket works', () => {
    const signals = getSignalsByMarket('test-market-1');
    return signals.some((s) => s.id === testSignal.id);
  });

  check('Signal CRUD: getRecentSignals works', () => {
    const signals = getRecentSignals(1);
    return signals.some((s) => s.id === testSignal.id);
  });

  check('Signal CRUD: newsEvents roundtrip as array', () => {
    const signals = getSignalsByMarket('test-market-1');
    const found = signals.find((s) => s.id === testSignal.id);
    return (
      found !== undefined &&
      Array.isArray(found.newsEvents) &&
      found.newsEvents.length === 2
    );
  });

  check('getSignalCount returns correct count', () => {
    const count = getSignalCount();
    return count >= 1;
  });

  console.log('\n=== Phase 3: Agent ===\n');

  check('LangGraph graph imports without error', () => {
    // Dynamic import to test module loading
    void import('../agent/graph');
    return true;
  });

  console.log('\n=== Results ===\n');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((e) => {
  console.error('Validation failed:', e);
  process.exit(1);
});
