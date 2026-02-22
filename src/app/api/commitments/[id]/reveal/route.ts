import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { getSignalById, updateSignalReveal } from '@/store/signals'
import { revealSignal } from '@/solana/commitment'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!config.solana.enabled) {
    return NextResponse.json(
      { error: 'Solana commitments are not enabled' },
      { status: 503 },
    )
  }

  const signal = getSignalById(id)
  if (!signal) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }

  if (!signal.commitTxSignature) {
    return NextResponse.json(
      { error: 'Signal has not been committed yet — commit before revealing' },
      { status: 400 },
    )
  }

  if (signal.revealTxSignature) {
    return NextResponse.json(
      { error: 'Signal has already been revealed', revealTxSignature: signal.revealTxSignature },
      { status: 409 },
    )
  }

  const result = await revealSignal(signal)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  updateSignalReveal(signal.id, result.data.txSignature)

  return NextResponse.json({
    signalId: signal.id,
    revealTxSignature: result.data.txSignature,
    explorerUrl: `https://explorer.solana.com/tx/${result.data.txSignature}?cluster=devnet`,
  })
}
