import { NextResponse } from 'next/server';
import type { MarketsResponse } from '@/lib/types';
import { fetchMarkets } from '@/data/polymarket';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category') || undefined;
  const limit = searchParams.get('limit')
    ? parseInt(searchParams.get('limit')!, 10)
    : undefined;

  const result = await fetchMarkets({ category, limit });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, status: 500 },
      { status: 500 },
    );
  }

  const response: MarketsResponse = {
    markets: result.data,
    total: result.data.length,
    lastFetchedAt: new Date().toISOString(),
  };

  return NextResponse.json(response);
}
