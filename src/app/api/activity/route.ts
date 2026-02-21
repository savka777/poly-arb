import { NextResponse } from 'next/server';
import type { ActivityResponse } from '@/lib/types';
import { getActivityLog, getActivityCount } from '@/store/activity-log';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50));

  const entries = getActivityLog(limit);
  const total = getActivityCount();

  const response: ActivityResponse = { entries, total };
  return NextResponse.json(response);
}
