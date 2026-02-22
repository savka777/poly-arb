import { NextRequest, NextResponse } from 'next/server'
import { getSignalById } from '@/store/signals'
import { getMarketById } from '@/store/markets'
import { getLivePrice } from '@/data/polymarket-ws'
import { getSignalPayload, hashSignal, verifyCommitment } from '@/solana/commitment'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const signal = getSignalById(id)

  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  if (!signal.commitTxSignature) {
    return NextResponse.json({ error: 'Signal has not been committed to Solana' }, { status: 404 })
  }

  const payload = getSignalPayload(signal)
  const computedHash = hashSignal(payload)
  const verified = signal.commitHash ? verifyCommitment(payload, signal.commitHash) : false

  // Get current market price
  const market = getMarketById(signal.marketId)
  let currentMarketPrice: number | null = null
  if (market?.clobTokenId) {
    const live = getLivePrice(market.clobTokenId)
    if (live && live.price > 0) currentMarketPrice = live.price
  }
  if (currentMarketPrice === null && market) {
    currentMarketPrice = market.probability
  }

  const marketPriceAtCommit = signal.marketPriceAtCommit ?? signal.marketPrice
  let convergence: number | null = null
  if (currentMarketPrice !== null) {
    const initialGap = Math.abs(marketPriceAtCommit - signal.darwinEstimate)
    if (initialGap < 0.001) {
      convergence = 1.0
    } else {
      const currentGap = Math.abs(currentMarketPrice - signal.darwinEstimate)
      convergence = Math.max(0, Math.min(1, 1 - currentGap / initialGap))
    }
  }

  return NextResponse.json({
    signalId: signal.id,
    marketId: signal.marketId,
    marketQuestion: signal.marketQuestion,
    direction: signal.direction,
    darwinEstimate: signal.darwinEstimate,
    marketPriceAtCommit,
    currentMarketPrice,
    convergence,
    ev: signal.ev,
    payload,
    commitHash: signal.commitHash,
    computedHash,
    verified,
    commitTxSignature: signal.commitTxSignature,
    explorerUrl: `https://explorer.solana.com/tx/${signal.commitTxSignature}?cluster=devnet`,
    revealTxSignature: signal.revealTxSignature,
    revealExplorerUrl: signal.revealTxSignature
      ? `https://explorer.solana.com/tx/${signal.revealTxSignature}?cluster=devnet`
      : null,
    commitSlot: signal.commitSlot,
    createdAt: signal.createdAt,
  })
}
