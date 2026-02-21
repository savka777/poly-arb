import { NextResponse } from 'next/server';
import type { MarketDetailResponse } from '@/lib/types';
import { fetchMarketDetail } from '@/data/polymarket';
import { getSignalsByMarket } from '@/store/signals';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const result = await fetchMarketDetail(params.id);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: 404 },
      { status: 404 },
    );
  }

  const signals = getSignalsByMarket(params.id);

  const response: MarketDetailResponse = {
    market: result.data,
    signals,
  };

  return NextResponse.json(response);
}
