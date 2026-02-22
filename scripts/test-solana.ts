/**
 * Test script for Solana commitment system.
 *
 * Phase 1: Offline tests (no SOL needed) — hash, payload, verify
 * Phase 2: On-chain test (needs funded devnet keypair) — commit + reveal
 *
 * Usage:
 *   npx tsx scripts/test-solana.ts          # offline tests only
 *   npx tsx scripts/test-solana.ts --chain  # include on-chain tests
 */

import { hashSignal, verifyCommitment, getSignalPayload, commitSignal, revealSignal } from '../src/solana/commitment'
import type { Signal } from '../src/lib/types'

const includeChain = process.argv.includes('--chain')

const testSignal: Signal = {
  id: 'test-' + Date.now(),
  marketId: 'test-market-001',
  marketQuestion: 'Will BTC exceed $100k by March 2026?',
  direction: 'yes',
  darwinEstimate: 0.7234,
  marketPrice: 0.5512,
  ev: 0.1189,
  reasoning: 'Strong momentum signals from institutional inflows',
  newsEvents: ['[Reuters] BTC ETF inflows hit record'],
  confidence: 'high',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
}

async function main() {
  console.log('=== Solana Commitment Tests ===\n')

  // 1. Payload construction
  console.log('1. Payload construction')
  const payload = getSignalPayload(testSignal)
  console.log('   Payload:', JSON.stringify(payload, null, 2))
  console.log('   ✓ Values rounded to 4dp:', payload.darwinEstimate, payload.marketPrice, payload.ev)

  // 2. Hashing
  console.log('\n2. Hashing')
  const hash = hashSignal(payload)
  console.log('   Hash:', hash)
  console.log('   Length:', hash.length, '(expected 64)')

  // 3. Determinism — same payload = same hash
  console.log('\n3. Determinism')
  const hash2 = hashSignal(payload)
  const match = hash === hash2
  console.log('   Same payload, same hash:', match ? '✓' : '✗ FAIL')

  // 4. Verification
  console.log('\n4. Verification')
  const verified = verifyCommitment(payload, hash)
  console.log('   Correct hash verifies:', verified ? '✓' : '✗ FAIL')

  const tamperedPayload = { ...payload, darwinEstimate: 0.9999 }
  const failedVerify = verifyCommitment(tamperedPayload, hash)
  console.log('   Tampered payload rejects:', !failedVerify ? '✓' : '✗ FAIL')

  // 5. Memo format
  console.log('\n5. Memo format')
  const commitMemo = `DARWIN:COMMIT:${testSignal.id}:${hash}`
  console.log('   Commit memo:', commitMemo)
  console.log('   Length:', commitMemo.length, 'bytes (max 566 for memo)')

  const revealMemo = `DARWIN:REVEAL:${testSignal.id}:${JSON.stringify(payload)}`
  console.log('   Reveal memo length:', revealMemo.length, 'bytes')

  if (!includeChain) {
    console.log('\n=== Offline tests passed ===')
    console.log('Run with --chain to test on-chain (needs funded devnet keypair)')
    return
  }

  // 6. On-chain commit
  console.log('\n6. On-chain commit')
  const commitResult = await commitSignal(testSignal)
  if (commitResult.ok) {
    console.log('   ✓ Committed!')
    console.log('   TX:', commitResult.data.txSignature)
    console.log('   Hash:', commitResult.data.hash)
    console.log('   Slot:', commitResult.data.slot)
    console.log('   Explorer: https://explorer.solana.com/tx/' + commitResult.data.txSignature + '?cluster=devnet')
  } else {
    console.log('   ✗ Failed:', commitResult.error)
    return
  }

  // 7. On-chain reveal
  console.log('\n7. On-chain reveal')
  const revealResult = await revealSignal(testSignal)
  if (revealResult.ok) {
    console.log('   ✓ Revealed!')
    console.log('   TX:', revealResult.data.txSignature)
    console.log('   Explorer: https://explorer.solana.com/tx/' + revealResult.data.txSignature + '?cluster=devnet')
  } else {
    console.log('   ✗ Failed:', revealResult.error)
  }

  console.log('\n=== All tests passed ===')
}

main().catch((e) => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
