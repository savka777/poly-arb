import { NextRequest, NextResponse } from 'next/server';
import { getRecentScoutEvents, getLatestScoutEvent } from '@/store/scout-events';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const events = getRecentScoutEvents(isNaN(limit) ? 10 : limit);
  const latest = getLatestScoutEvent();
  return NextResponse.json({
    events,
    latestAt: latest?.timestamp ?? null,
  });
}
