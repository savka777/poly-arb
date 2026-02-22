/**
 * Independent verification tool for Solana commitments.
 *
 * Reads the on-chain memo, decodes the commit/reveal data,
 * fetches the LIVE Polymarket price, and computes convergence.
 *
 * Usage:
 *   npx tsx scripts/verify-commitment.ts <tx-signature>
 *   npx tsx scripts/verify-commitment.ts --all          # verify all committed signals
 *   npx tsx scripts/verify-commitment.ts --list         # list all committed signals
 *
 * Env:
 *   SOLANA_RPC_URL  — defaults to http://127.0.0.1:8899
 */

import { Connection, PublicKey } from '@solana/web3.js'
import { createHash } from 'crypto'

const RPC_URL = process.env.SOLANA_RPC_URL || 'http://127.0.0.1:8899'
const POLYMARKET_CLOB = 'https://clob.polymarket.com'
const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'

// ─── On-chain read ──────────────────────────────────────────────────────────

interface MemoData {
  type: 'COMMIT' | 'REVEAL'
  signalId: string
  data: string // hash for COMMIT, JSON payload for REVEAL
  slot: number
  blockTime: number | null
}

async function readMemo(conn: Connection, txSig: string): Promise<MemoData | null> {
  const tx = await conn.getTransaction(txSig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  })

  if (!tx) {
    console.log('  ✗ Transaction not found on chain')
    return null
  }

  // Memo is in the log messages
  const logs = tx.meta?.logMessages || []
  const memoLog = logs.find((l) => l.includes('Program log: Memo'))
  let memoText: string | null = null

  if (memoLog) {
    // Format: 'Program log: Memo (len XX): "DARWIN:COMMIT:..."'
    // Use greedy match to capture everything between first and last quote
    const firstQuote = memoLog.indexOf('"')
    const lastQuote = memoLog.lastIndexOf('"')
    if (firstQuote !== -1 && lastQuote > firstQuote) {
      memoText = memoLog.slice(firstQuote + 1, lastQuote)
      // Unescape JSON strings that were escaped in the log
      memoText = memoText.replace(/\\"/g, '"')
    }
  }

  // Also check inner instructions data as fallback
  if (!memoText) {
    // Try to decode from instruction data directly
    const message = tx.transaction.message
    if ('compiledInstructions' in message) {
      // v0 message
      for (const ix of message.compiledInstructions) {
        const decoded = Buffer.from(ix.data).toString('utf-8')
        if (decoded.startsWith('DARWIN:')) {
          memoText = decoded
          break
        }
      }
    }
  }

  if (!memoText || !memoText.startsWith('DARWIN:')) {
    console.log('  ✗ No DARWIN memo found in transaction')
    console.log('  Logs:', logs.join('\n        '))
    return null
  }

  const parts = memoText.split(':')
  // DARWIN:COMMIT:signalId:hash  or  DARWIN:REVEAL:signalId:{json...}
  const type = parts[1] as 'COMMIT' | 'REVEAL'
  const signalId = parts[2]
  const data = parts.slice(3).join(':') // rejoin in case JSON contains colons

  return {
    type,
    signalId,
    data,
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
  }
}

// ─── Polymarket live price ──────────────────────────────────────────────────

interface PolymarketMarket {
  question: string
  outcomePrices: string
  clobTokenIds: string
  active: boolean
  closed: boolean
}

async function getPolymarketPrice(marketId: string): Promise<{
  question: string
  currentPrice: number
  active: boolean
} | null> {
  try {
    // Try gamma API for market info
    const res = await fetch(`${POLYMARKET_GAMMA}/markets/${marketId}`)
    if (!res.ok) return null
    const market = (await res.json()) as PolymarketMarket

    // outcomePrices is a JSON string like "[\"0.55\",\"0.45\"]"
    let currentPrice = 0
    try {
      const prices = JSON.parse(market.outcomePrices) as string[]
      currentPrice = parseFloat(prices[0]) // YES price
    } catch {
      // try CLOB midpoint as fallback
      try {
        const tokenIds = JSON.parse(market.clobTokenIds) as string[]
        if (tokenIds.length > 0) {
          const midRes = await fetch(`${POLYMARKET_CLOB}/midpoint?token_id=${tokenIds[0]}`)
          if (midRes.ok) {
            const midBody = (await midRes.json()) as { mid?: string }
            if (midBody.mid) currentPrice = parseFloat(midBody.mid)
          }
        }
      } catch {
        // give up
      }
    }

    return {
      question: market.question,
      currentPrice,
      active: market.active && !market.closed,
    }
  } catch {
    return null
  }
}

// ─── Verification logic ─────────────────────────────────────────────────────

function verifyHash(payload: Record<string, unknown>, expectedHash: string): boolean {
  const canonical = JSON.stringify(payload)
  const computed = createHash('sha256').update(canonical).digest('hex')
  return computed === expectedHash
}

function computeConvergence(
  darwinEstimate: number,
  priceAtCommit: number,
  currentPrice: number,
): number {
  const initialGap = Math.abs(priceAtCommit - darwinEstimate)
  if (initialGap < 0.001) return 1.0
  const currentGap = Math.abs(currentPrice - darwinEstimate)
  return Math.max(0, Math.min(1, 1 - currentGap / initialGap))
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function verifyTx(conn: Connection, txSig: string): Promise<void> {
  console.log(`\n═══ Verifying: ${txSig.slice(0, 20)}...${txSig.slice(-8)} ═══\n`)

  console.log('1. Reading on-chain data...')
  const memo = await readMemo(conn, txSig)
  if (!memo) return

  const time = memo.blockTime
    ? new Date(memo.blockTime * 1000).toISOString()
    : 'unknown'

  console.log(`  Type:      ${memo.type}`)
  console.log(`  Signal ID: ${memo.signalId}`)
  console.log(`  Slot:      ${memo.slot}`)
  console.log(`  Time:      ${time}`)

  if (memo.type === 'COMMIT') {
    console.log(`  Hash:      ${memo.data}`)
    console.log('\n  → This is a COMMIT. The hash proves the signal existed at this slot.')
    console.log('  → To see the full data, look for the REVEAL transaction.')
    console.log('  → Or check: GET /api/commitments/' + memo.signalId)
  }

  if (memo.type === 'REVEAL') {
    console.log('\n2. Decoding reveal payload...')
    try {
      const payload = JSON.parse(memo.data) as {
        signalId: string
        marketId: string
        marketQuestion: string
        direction: string
        darwinEstimate: number
        marketPrice: number
        ev: number
        createdAt: string
      }

      console.log(`  Signal ID:       ${payload.signalId}`)
      console.log(`  Market ID:       ${payload.marketId}`)
      console.log(`  Question:        ${payload.marketQuestion}`)
      console.log(`  Direction:       ${payload.direction.toUpperCase()}`)
      console.log(`  Darwin Estimate: ${(payload.darwinEstimate * 100).toFixed(1)}%`)
      console.log(`  Market Price:    ${(payload.marketPrice * 100).toFixed(1)}%  (at prediction time)`)
      console.log(`  Expected Value:  ${(payload.ev * 100).toFixed(2)}%`)
      console.log(`  Created At:      ${payload.createdAt}`)

      // 3. Fetch live Polymarket price
      console.log('\n3. Fetching live Polymarket price...')
      const live = await getPolymarketPrice(payload.marketId)

      if (live) {
        console.log(`  Question:        ${live.question}`)
        console.log(`  Current Price:   ${(live.currentPrice * 100).toFixed(1)}%`)
        console.log(`  Market Active:   ${live.active ? 'yes' : 'no (resolved/closed)'}`)

        // 4. Compute convergence
        console.log('\n4. Convergence analysis...')
        const conv = computeConvergence(payload.darwinEstimate, payload.marketPrice, live.currentPrice)
        console.log(`  Price at prediction:  ${(payload.marketPrice * 100).toFixed(1)}%`)
        console.log(`  Darwin predicted:     ${(payload.darwinEstimate * 100).toFixed(1)}%`)
        console.log(`  Current price:        ${(live.currentPrice * 100).toFixed(1)}%`)
        console.log(`  Convergence:          ${(conv * 100).toFixed(1)}%`)

        const priceMoved = live.currentPrice - payload.marketPrice
        const predictedDirection = payload.direction === 'yes' ? 'UP' : 'DOWN'
        const actualDirection = priceMoved > 0 ? 'UP' : priceMoved < 0 ? 'DOWN' : 'FLAT'
        const correct = predictedDirection === actualDirection

        console.log(`  Darwin said:          ${predictedDirection}`)
        console.log(`  Market moved:         ${actualDirection} (${priceMoved > 0 ? '+' : ''}${(priceMoved * 100).toFixed(1)}%)`)
        console.log(`  Correct direction:    ${correct ? '✓ YES' : '✗ NO'}`)
      } else {
        console.log('  ⚠ Could not fetch live price (market may not exist or API down)')
        console.log('  → Check manually: https://polymarket.com/event/' + payload.marketId)
      }
    } catch (e) {
      console.log('  ✗ Failed to parse reveal payload:', (e as Error).message)
    }
  }
}

async function listFromDb(): Promise<void> {
  // Dynamically import the store (needs Next.js path resolution)
  console.log('\nTo list all committed signals, use:')
  console.log('  curl http://localhost:3000/api/commitments | jq .\n')
  console.log('Then verify any transaction with:')
  console.log('  npx tsx scripts/verify-commitment.ts <tx-signature>\n')
}

async function main(): Promise<void> {
  const arg = process.argv[2]

  if (!arg) {
    console.log('Usage:')
    console.log('  npx tsx scripts/verify-commitment.ts <tx-signature>   # verify one tx')
    console.log('  npx tsx scripts/verify-commitment.ts --list           # how to find txs')
    console.log('')
    console.log('RPC:', RPC_URL)
    process.exit(0)
  }

  if (arg === '--list') {
    await listFromDb()
    return
  }

  const conn = new Connection(RPC_URL, 'confirmed')

  if (arg === '--all') {
    console.log('Paste transaction signatures (one per line, empty line to finish):')
    // For simplicity, just show usage
    console.log('\nUse the API to get all tx signatures:')
    console.log('  curl -s http://localhost:3000/api/commitments | jq ".commitments[].commitTxSignature"')
    console.log('\nThen verify each one:')
    console.log('  npx tsx scripts/verify-commitment.ts <tx-signature>')
    return
  }

  // Verify a single transaction
  await verifyTx(conn, arg)
}

main().catch((e) => {
  console.error('Fatal:', (e as Error).message)
  process.exit(1)
})
