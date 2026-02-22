import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  PublicKey,
} from '@solana/web3.js'
import bs58 from 'bs58'
import { createHash } from 'crypto'
import { config } from '@/lib/config'
import { ok, err } from '@/lib/result'
import { getUncommittedSignals, updateSignalCommitment, updateSignalReveal } from '@/store/signals'
import { logActivity } from '@/store/activity-log'
import type { Signal } from '@/lib/types'
import type { Result } from '@/lib/types'

// Memo program ID (SPL Memo v2)
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')

// ─── Lazy-init Proxy (same pattern as model/db) ─────────────────────────────

interface SolanaState {
  connection: Connection
  keypair: Keypair
}

let _solana: SolanaState | null = null

function getSolana(): SolanaState {
  if (!_solana) {
    if (!config.solana.keypair) {
      throw new Error('SOLANA_KEYPAIR not configured')
    }
    const secretKey = bs58.decode(config.solana.keypair)
    const keypair = Keypair.fromSecretKey(secretKey)
    const connection = new Connection(config.solana.rpcUrl, 'confirmed')
    _solana = { connection, keypair }
  }
  return _solana
}

// ─── Commit Payload ─────────────────────────────────────────────────────────

export interface SignalCommitPayload {
  signalId: string
  marketId: string
  marketQuestion: string
  direction: 'yes' | 'no'
  darwinEstimate: number
  marketPrice: number
  ev: number
  createdAt: string
}

function buildPayload(signal: Signal): SignalCommitPayload {
  return {
    signalId: signal.id,
    marketId: signal.marketId,
    marketQuestion: signal.marketQuestion,
    direction: signal.direction,
    darwinEstimate: Math.round(signal.darwinEstimate * 10000) / 10000,
    marketPrice: Math.round(signal.marketPrice * 10000) / 10000,
    ev: Math.round(signal.ev * 10000) / 10000,
    createdAt: signal.createdAt,
  }
}

// ─── Hash ───────────────────────────────────────────────────────────────────

export function hashSignal(payload: SignalCommitPayload): string {
  const canonical = JSON.stringify(payload)
  return createHash('sha256').update(canonical).digest('hex')
}

// ─── Verify ─────────────────────────────────────────────────────────────────

export function verifyCommitment(payload: SignalCommitPayload, hash: string): boolean {
  return hashSignal(payload) === hash
}

// ─── Send Memo Transaction ─────────────────────────────────────────────────

async function sendMemo(memoText: string): Promise<Result<{ txSignature: string; slot: number }>> {
  try {
    const { connection, keypair } = getSolana()

    const memoInstruction = new TransactionInstruction({
      keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memoText, 'utf-8'),
    })

    const transaction = new Transaction().add(memoInstruction)

    const txSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
    )

    // Get the slot for timestamp proof
    const txInfo = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    })
    const slot = txInfo?.slot ?? 0

    return ok({ txSignature, slot })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return err(`Memo transaction failed: ${msg}`)
  }
}

// ─── Commit ─────────────────────────────────────────────────────────────────

export async function commitSignal(
  signal: Signal,
): Promise<Result<{ txSignature: string; hash: string; slot: number }>> {
  const payload = buildPayload(signal)
  const hash = hashSignal(payload)
  const memoText = `DARWIN:COMMIT:${signal.id}:${hash}`

  const result = await sendMemo(memoText)
  if (!result.ok) return result

  return ok({
    txSignature: result.data.txSignature,
    hash,
    slot: result.data.slot,
  })
}

// ─── Reveal ─────────────────────────────────────────────────────────────────

export async function revealSignal(
  signal: Signal,
): Promise<Result<{ txSignature: string }>> {
  const payload = buildPayload(signal)
  const payloadJson = JSON.stringify(payload)
  const memoText = `DARWIN:REVEAL:${signal.id}:${payloadJson}`

  const result = await sendMemo(memoText)
  if (!result.ok) return result

  return ok({ txSignature: result.data.txSignature })
}

// ─── Get Payload for Signal ─────────────────────────────────────────────────

export function getSignalPayload(signal: Signal): SignalCommitPayload {
  return buildPayload(signal)
}

// ─── Startup Recovery ───────────────────────────────────────────────────────

export async function commitUncommittedSignals(): Promise<void> {
  const uncommitted = getUncommittedSignals()
  if (uncommitted.length === 0) return

  logActivity('orchestrator', 'info', `Found ${uncommitted.length} uncommitted signals — committing to Solana`)

  for (const signal of uncommitted) {
    try {
      const result = await commitSignal(signal)
      if (result.ok) {
        updateSignalCommitment(signal.id, {
          txSignature: result.data.txSignature,
          hash: result.data.hash,
          slot: result.data.slot,
          marketPriceAtCommit: signal.marketPrice,
        })
        logActivity('orchestrator', 'info', `Committed signal ${signal.id} to Solana: ${result.data.txSignature}`)
      } else {
        logActivity('orchestrator', 'error', `Failed to commit signal ${signal.id}: ${result.error}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      logActivity('orchestrator', 'error', `Error committing signal ${signal.id}: ${msg}`)
    }
  }
}
