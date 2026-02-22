import { NextResponse } from 'next/server'
import { getCommittedSignals } from '@/store/signals'
import { getMarketById } from '@/store/markets'
import { getLivePrice } from '@/data/polymarket-ws'

function computeConvergence(
  darwinEstimate: number,
  marketPriceAtCommit: number,
  currentPrice: number,
): number {
  const initialGap = Math.abs(marketPriceAtCommit - darwinEstimate)
  if (initialGap < 0.001) return 1.0 // already aligned at commit time

  const currentGap = Math.abs(currentPrice - darwinEstimate)
  const convergence = 1 - currentGap / initialGap
  return Math.max(0, Math.min(1, convergence))
}

function getCurrentPrice(signal: { marketId: string; clobTokenId?: string }): number | null {
  // Try live WebSocket data first
  if (signal.clobTokenId) {
    const live = getLivePrice(signal.clobTokenId)
    if (live && live.price > 0) return live.price
  }

  // Fall back to SQLite market record
  const market = getMarketById(signal.marketId)
  if (market) return market.probability

  return null
}

export async function GET() {
  const signals = getCommittedSignals()

  const commitments = signals.map((signal) => {
    const market = getMarketById(signal.marketId)
    const currentMarketPrice = getCurrentPrice({
      marketId: signal.marketId,
      clobTokenId: market?.clobTokenId,
    })

    const marketPriceAtCommit = signal.marketPriceAtCommit ?? signal.marketPrice
    const convergence = currentMarketPrice !== null
      ? computeConvergence(signal.darwinEstimate, marketPriceAtCommit, currentMarketPrice)
      : null

    const cluster = signal.commitTxSignature?.startsWith('5') ? 'devnet' : 'devnet'

    return {
      signalId: signal.id,
      marketId: signal.marketId,
      marketQuestion: signal.marketQuestion,
      direction: signal.direction,
      darwinEstimate: signal.darwinEstimate,
      marketPriceAtCommit,
      currentMarketPrice,
      convergence,
      ev: signal.ev,
      commitHash: signal.commitHash,
      commitTxSignature: signal.commitTxSignature,
      explorerUrl: signal.commitTxSignature
        ? `https://explorer.solana.com/tx/${signal.commitTxSignature}?cluster=${cluster}`
        : null,
      revealTxSignature: signal.revealTxSignature,
      commitSlot: signal.commitSlot,
      createdAt: signal.createdAt,
    }
  })

  // Compute stats
  const withConvergence = commitments.filter((c) => c.convergence !== null)
  const avgConvergence = withConvergence.length > 0
    ? withConvergence.reduce((sum, c) => sum + c.convergence!, 0) / withConvergence.length
    : 0

  const correctDirection = commitments.filter((c) => {
    if (c.currentMarketPrice === null) return false
    const priceAtCommit = c.marketPriceAtCommit
    const priceMoved = c.currentMarketPrice - priceAtCommit
    if (c.direction === 'yes') return priceMoved > 0
    return priceMoved < 0
  }).length

  return NextResponse.json({
    commitments,
    total: commitments.length,
    stats: {
      totalCommitted: commitments.length,
      avgConvergence: Math.round(avgConvergence * 100) / 100,
      correctDirection,
    },
  })
}
