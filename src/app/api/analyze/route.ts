import { NextResponse } from 'next/server';
import type { AnalyzeRequest, AnalyzeResponse } from '@/lib/types';
import { fetchMarketDetail } from '@/data/polymarket';
import { runEventPod } from '@/agent/graph';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: AnalyzeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', status: 400 },
      { status: 400 },
    );
  }

  if (!body.marketId) {
    return NextResponse.json(
      { error: 'marketId is required', status: 400 },
      { status: 400 },
    );
  }

  const marketResult = await fetchMarketDetail(body.marketId);
  if (!marketResult.ok) {
    return NextResponse.json(
      { error: marketResult.error, status: 404 },
      { status: 404 },
    );
  }

  const result = await runEventPod(marketResult.data);

  const response: AnalyzeResponse = {
    signal: result.signal,
    reasoning: result.reasoning,
    toolCalls: result.toolCalls,
  };

  return NextResponse.json(response);
}
