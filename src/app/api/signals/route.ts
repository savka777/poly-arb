import { NextResponse } from 'next/server';
import type { SignalsResponse } from '@/lib/types';
import { getSignals } from '@/store/signals';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const confidence = searchParams.get('confidence') as
    | 'low'
    | 'medium'
    | 'high'
    | null;
  const minEv = searchParams.get('minEv')
    ? parseFloat(searchParams.get('minEv')!)
    : undefined;

  const signals = getSignals({
    confidence: confidence || undefined,
    minEv,
  });

  const response: SignalsResponse = {
    signals,
    total: signals.length,
  };

  return NextResponse.json(response);
}
