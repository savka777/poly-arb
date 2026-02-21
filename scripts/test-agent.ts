/**
 * test-agent.ts — Run the LangGraph agent on mock data with a real LLM call.
 *
 * Usage:
 *   USE_MOCK_DATA=true npx tsx scripts/test-agent.ts
 *
 * This tests:
 *   1. Mock news fetch (no Valyu API needed)
 *   2. Real LLM call via Vertex AI (estimateProbabilityNode)
 *   3. EV calculation + threshold check
 *   4. Signal generation + SQLite persistence
 */

import { getMockMarkets } from '../src/data/mock';
import { runEventPod } from '../src/agent/graph';
import type { Market } from '../src/lib/types';

async function testSingleMarket(market: Market) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`MARKET: ${market.question}`);
  console.log(`  ID:          ${market.id}`);
  console.log(`  Price:       ${market.probability}`);
  console.log(`  End date:    ${market.endDate}`);
  console.log(`  Category:    ${market.category}`);
  console.log(`${'='.repeat(70)}`);

  const startMs = Date.now();

  try {
    const result = await runEventPod(market);
    const elapsedMs = Date.now() - startMs;

    console.log(`\n  [elapsed: ${elapsedMs}ms]`);
    console.log(`\n  TOOL CALLS:`);
    for (const tc of result.toolCalls) {
      console.log(`    - ${tc.name}`);
      console.log(`      input:  ${JSON.stringify(tc.input)}`);
      console.log(`      output: ${JSON.stringify(tc.output)}`);
    }

    console.log(`\n  REASONING: ${result.reasoning}`);

    if (result.signal) {
      const s = result.signal;
      console.log(`\n  SIGNAL GENERATED:`);
      console.log(`    ID:            ${s.id}`);
      console.log(`    Darwin Est:    ${s.darwinEstimate}`);
      console.log(`    Market Price:  ${s.marketPrice}`);
      console.log(`    EV:            ${s.ev > 0 ? '+' : ''}${s.ev.toFixed(4)}`);
      console.log(`    Direction:     ${s.direction}`);
      console.log(`    Confidence:    ${s.confidence}`);
      console.log(`    News Events:   ${s.newsEvents.length}`);
      for (const ne of s.newsEvents) {
        console.log(`      - ${ne}`);
      }
    } else {
      console.log(`\n  NO SIGNAL (divergence below threshold or no news)`);
    }
  } catch (e) {
    const elapsedMs = Date.now() - startMs;
    console.log(`\n  ERROR after ${elapsedMs}ms:`);
    console.log(`    ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof Error && e.stack) {
      console.log(`    ${e.stack.split('\n').slice(1, 4).join('\n    ')}`);
    }
  }
}

async function main() {
  console.log('Darwin Capital — Agent Test');
  console.log(`USE_MOCK_DATA: ${process.env.USE_MOCK_DATA}`);
  console.log(`GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  console.log(`VERTEX_REGION: ${process.env.VERTEX_REGION}`);
  console.log(`EV_THRESHOLD: ${process.env.EV_THRESHOLD || '0.05 (default)'}`);

  const markets = getMockMarkets();
  console.log(`\nFound ${markets.length} mock markets.`);

  // Test just the first two markets to save time/cost
  const testMarkets = markets.slice(0, 2);
  console.log(`Testing ${testMarkets.length} markets...\n`);

  for (const market of testMarkets) {
    await testSingleMarket(market);
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('DONE');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
