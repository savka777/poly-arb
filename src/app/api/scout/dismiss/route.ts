import { NextRequest, NextResponse } from 'next/server';
import { dismissScoutEvent } from '@/store/scout-events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json() as { id?: unknown };
  if (typeof body.id !== 'string' || !body.id) {
    return NextResponse.json({ error: 'id must be a non-empty string' }, { status: 400 });
  }
  dismissScoutEvent(body.id);
  return NextResponse.json({ ok: true });
}
