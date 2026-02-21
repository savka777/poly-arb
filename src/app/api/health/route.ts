import { NextResponse } from 'next/server';
import type { HealthResponse } from '@/lib/types';
import { getSignalCount, getLatestSignalTimestamp } from '@/store/signals';

export const dynamic = 'force-dynamic';

const startTime = Date.now();

export async function GET() {
  const response: HealthResponse = {
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    lastScanAt: getLatestSignalTimestamp(),
    signalCount: getSignalCount(),
  };

  return NextResponse.json(response);
}
