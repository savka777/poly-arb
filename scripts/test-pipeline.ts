#!/usr/bin/env npx tsx
/**
 * End-to-end pipeline test — real markets, real news, real LLM.
 *
 * Runs the full Darwin Capital pipeline:
 *   Polymarket → Valyu news → LLM probability estimate → divergence → signal
 *
 * Usage:
 *   npx tsx scripts/test-pipeline.ts        # default 3 markets
 *   npx tsx scripts/test-pipeline.ts 5      # override market count
 */

// ── Bootstrap env BEFORE any app imports ─────────────────────────────────────
// esbuild (used by tsx) hoists require() calls to the top even in CJS mode,
// so static `import` statements would cause config.ts to load before .env is
// parsed. We use dynamic import() inside main() to guarantee correct ordering.

import { readFileSync } from 'fs';
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (key) process.env[key] = val;
  }
} catch { /* .env not found — rely on process.env */ }

// Force real data
process.env.USE_MOCK_DATA = 'false';

// ── Types only (erased at compile time, no runtime hoisting) ─────────────────
import type { Market } from '../src/lib/types';

const DEFAULT_MARKET_COUNT = 3;

async function runPipeline(
  market: Market,
  index: number,
  total: number,
  runEventPod: (m: Market) => Promise<{ signal: import('../src/lib/types').Signal | null; reasoning: string; toolCalls: import('../src/lib/types').ToolCallRecord[] }>,
) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  MARKET ${index + 1}/${total}: ${market.question}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  ID:         ${market.id}`);
  console.log(`  Price:      ${(market.probability * 100).toFixed(1)}%`);
  console.log(`  Volume:     $${market.volume.toLocaleString()}`);
  console.log(`  Liquidity:  $${market.liquidity.toLocaleString()}`);
  console.log(`  End date:   ${market.endDate}`);
  console.log(`  URL:        ${market.url}`);

  const startMs = Date.now();

  try {
    const result = await runEventPod(market);
    const elapsedMs = Date.now() - startMs;

    // --- News articles ---
    const newsCalls = result.toolCalls.filter((tc) => tc.name === 'fetchRecentNews');
    const newsOutput = newsCalls[0]?.output as { count?: number; error?: string } | undefined;
    const newsCount = newsOutput?.count ?? 0;

    if (newsOutput?.error) {
      console.log(`\n  NEWS FETCH FAILED: ${newsOutput.error}`);
    } else {
      console.log(`\n  NEWS ARTICLES: ${newsCount} found`);
      if (result.signal) {
        for (const ne of result.signal.newsEvents) {
          console.log(`    - ${ne}`);
        }
      }
    }

    // Show pipeline error if it stopped early
    if (result.reasoning.startsWith('News fetch failed:') || result.reasoning.startsWith('No news')) {
      console.log(`  Pipeline stopped: ${result.reasoning}`);
    }

    // --- LLM estimate ---
    const estimateCalls = result.toolCalls.filter((tc) => tc.name === 'estimateEventProbability');
    const estimateOutput = estimateCalls[0]?.output as {
      probability?: number;
      reasoning?: string;
      confidence?: string;
      keyFactors?: string[];
      error?: string;
    } | undefined;

    if (estimateOutput && estimateOutput.probability !== undefined) {
      console.log(`\n  LLM ESTIMATE:`);
      console.log(`    Probability:  ${(estimateOutput.probability * 100).toFixed(1)}%`);
      console.log(`    Confidence:   ${estimateOutput.confidence}`);
      console.log(`    Reasoning:    ${estimateOutput.reasoning}`);
      if (estimateOutput.keyFactors) {
        console.log(`    Key factors:`);
        for (const f of estimateOutput.keyFactors) {
          console.log(`      - ${f}`);
        }
      }
    }

    // --- Divergence ---
    const divCalls = result.toolCalls.filter((tc) => tc.name === 'calculatePriceDivergence');
    const divOutput = divCalls[0]?.output as {
      value?: number;
      direction?: string;
      significant?: boolean;
    } | undefined;

    if (divOutput && divOutput.value !== undefined) {
      console.log(`\n  DIVERGENCE:`);
      console.log(`    Market price:    ${(market.probability * 100).toFixed(1)}%`);
      console.log(`    Darwin estimate: ${estimateOutput?.probability !== undefined ? (estimateOutput.probability * 100).toFixed(1) + '%' : 'N/A'}`);
      console.log(`    EV:              ${divOutput.value > 0 ? '+' : ''}${(divOutput.value * 100).toFixed(2)}%`);
      console.log(`    Direction:       buy ${divOutput.direction?.toUpperCase()}`);
      console.log(`    Significant:     ${divOutput.significant ? 'YES' : 'no'}`);
    }

    // --- Signal ---
    if (result.signal) {
      const s = result.signal;
      console.log(`\n  SIGNAL GENERATED:`);
      console.log(`    ID:         ${s.id}`);
      console.log(`    Direction:  buy ${s.direction.toUpperCase()}`);
      console.log(`    EV:         ${s.ev > 0 ? '+' : ''}${(s.ev * 100).toFixed(2)}%`);
      console.log(`    Confidence: ${s.confidence}`);
    } else {
      console.log(`\n  NO SIGNAL (divergence below threshold or insufficient data)`);
    }

    console.log(`\n  [completed in ${elapsedMs}ms]`);
  } catch (e) {
    const elapsedMs = Date.now() - startMs;
    console.error(`\n  ERROR after ${elapsedMs}ms:`);
    console.error(`    ${e instanceof Error ? e.message : String(e)}`);
    if (e instanceof Error && e.stack) {
      console.error(`    ${e.stack.split('\n').slice(1, 3).join('\n    ')}`);
    }
  }
}

async function main() {
  // Dynamic imports — loaded AFTER env is set (avoids esbuild require hoisting)
  const { fetchMarkets } = await import('../src/data/polymarket');
  const { runEventPod } = await import('../src/agent/graph');
  const { isOk } = await import('../src/lib/result');
  const { config } = await import('../src/lib/config');

  const marketCount = parseInt(process.argv[2] ?? '', 10) || DEFAULT_MARKET_COUNT;

  console.log('Darwin Capital — End-to-End Pipeline Test');
  console.log('=========================================');
  console.log(`USE_MOCK_DATA:        ${process.env.USE_MOCK_DATA}`);
  console.log(`GOOGLE_CLOUD_PROJECT: ${process.env.GOOGLE_CLOUD_PROJECT}`);
  console.log(`VERTEX_REGION:        ${process.env.VERTEX_REGION}`);
  console.log(`EV_THRESHOLD:         ${process.env.EV_THRESHOLD || '0.05 (default)'}`);
  console.log(`Markets to analyze:   ${marketCount}`);
  console.log('');
  console.log('Active Market Filters:');
  console.log(`  Min liquidity:      $${config.marketFilters.minLiquidity}`);
  console.log(`  Min volume:         $${config.marketFilters.minVolume}`);
  console.log(`  Probability range:  ${config.marketFilters.minProbability} – ${config.marketFilters.maxProbability}`);
  console.log(`  Enabled strategies: ${config.strategies.enabled.join(', ')}`);

  // Step 1: Fetch live markets from Polymarket
  console.log('\nFetching markets from Polymarket Gamma API...');
  const marketsResult = await fetchMarkets({ limit: 50 });

  if (!isOk(marketsResult)) {
    console.error(`Failed to fetch markets: ${marketsResult.error}`);
    process.exit(1);
  }

  const markets = marketsResult.data;
  console.log(`Fetched ${markets.length} markets (sorted by volume).`);

  if (markets.length === 0) {
    console.error('No markets returned — cannot run pipeline.');
    process.exit(1);
  }

  // Step 2: Pick top N markets by volume
  const selected = markets.slice(0, marketCount);
  console.log(`\nRunning full pipeline on ${selected.length} markets...`);

  // Step 3: Run agent on each market
  for (let i = 0; i < selected.length; i++) {
    await runPipeline(selected[i], i, selected.length, runEventPod);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('DONE — Pipeline test complete.');
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(1);
});
