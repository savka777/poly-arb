#!/usr/bin/env npx tsx
/**
 * Smoke test for all three external API wrappers.
 * Run: npx tsx scripts/test-apis.ts
 *
 * Requires VALYU_API_KEY in .env (or environment).
 */

// Load .env manually (no dotenv dependency needed)
import { readFileSync } from 'fs'
try {
  const env = readFileSync('.env', 'utf8')
  for (const line of env.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch { /* .env not found — rely on process.env */ }

import { fetchMarkets, fetchMarketById, fetchTokenPrice, fetchOrderBook } from '../src/data/polymarket'
import { searchNews, buildNewsQuery } from '../src/data/valyu'
import { isOk } from '../src/lib/result'

function pass(label: string, detail?: string) {
  console.log(`  ✓ ${label}${detail ? `: ${detail}` : ''}`)
}

function fail(label: string, error: string) {
  console.error(`  ✗ ${label}: ${error}`)
}

async function testGammaApi() {
  console.log('\n── Gamma API ─────────────────────────────────')

  // fetchMarkets
  const marketsResult = await fetchMarkets({ limit: 5 })
  if (!isOk(marketsResult)) {
    fail('fetchMarkets', marketsResult.error)
    return null
  }
  const markets = marketsResult.data
  pass('fetchMarkets', `${markets.length} markets returned`)

  if (markets.length === 0) {
    fail('fetchMarkets', 'returned 0 markets — nothing to test downstream')
    return null
  }

  const first = markets[0]
  console.log(`     First market: "${first.question.slice(0, 60)}..."`)
  console.log(`     probability=${first.probability.toFixed(4)}  liquidity=$${first.liquidity.toFixed(0)}  volume=$${first.volume.toFixed(0)}`)
  console.log(`     conditionId=${first.conditionId}`)
  console.log(`     tokenIds=[${first.tokenIds[0].slice(0, 20)}..., ${first.tokenIds[1].slice(0, 20)}...]`)

  // fetchMarketById
  const byIdResult = await fetchMarketById(first.id)
  if (!isOk(byIdResult)) {
    fail(`fetchMarketById(${first.id})`, byIdResult.error)
  } else {
    pass(`fetchMarketById(${first.id})`, `question="${byIdResult.data.question.slice(0, 40)}..."`)
  }

  return first
}

async function testClobApi(market: Awaited<ReturnType<typeof testGammaApi>>) {
  console.log('\n── CLOB API ──────────────────────────────────')

  if (!market) {
    console.log('  (skipped — no market from Gamma test)')
    return
  }

  const yesTokenId = market.tokenIds[0]

  // fetchTokenPrice
  const priceResult = await fetchTokenPrice(yesTokenId)
  if (!isOk(priceResult)) {
    fail(`fetchTokenPrice YES`, priceResult.error)
  } else {
    pass(`fetchTokenPrice YES`, `price=${priceResult.data.toFixed(4)}`)
  }

  // fetchOrderBook
  const bookResult = await fetchOrderBook(yesTokenId)
  if (!isOk(bookResult)) {
    fail(`fetchOrderBook YES`, bookResult.error)
  } else {
    const { bids, asks } = bookResult.data
    pass(`fetchOrderBook YES`, `${bids.length} bids, ${asks.length} asks`)
    if (bids[0]) console.log(`     best bid: $${bids[bids.length - 1]?.price.toFixed(4)} × ${bids[bids.length - 1]?.size.toFixed(2)}`)
    if (asks[asks.length - 1]) console.log(`     best ask: $${asks[asks.length - 1]?.price.toFixed(4)} × ${asks[asks.length - 1]?.size.toFixed(2)}`)
  }
}

async function testValyuApi(market: Awaited<ReturnType<typeof testGammaApi>>) {
  console.log('\n── Valyu API ─────────────────────────────────')

  const question = market?.question ?? 'Will Trump be impeached in 2026?'
  const query = buildNewsQuery(question)
  console.log(`  question: "${question.slice(0, 70)}"`)
  console.log(`  query:    "${query}"`)

  const result = await searchNews(query, 3)
  if (!isOk(result)) {
    fail('searchNews', result.error)
    return
  }

  const results = result.data
  pass('searchNews', `${results.length} results`)

  for (const r of results) {
    console.log(`\n     • ${r.title}`)
    console.log(`       source: ${r.source}`)
    console.log(`       content: ${r.content.slice(0, 120).replace(/\n/g, ' ')}...`)
  }
}

async function main() {
  console.log('Darwin Capital — API Smoke Test')
  console.log('================================')

  const market = await testGammaApi()
  await testClobApi(market)
  await testValyuApi(market)

  console.log('\n================================')
  console.log('Done.')
}

main().catch((e) => {
  console.error('Unhandled error:', e)
  process.exit(1)
})
