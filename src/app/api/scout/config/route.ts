import { NextRequest, NextResponse } from 'next/server';
import { getScoutKeywords, setScoutKeywords } from '@/store/scout-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ keywords: getScoutKeywords() });
}

export async function POST(request: NextRequest) {
  const body = await request.json() as { keywords?: unknown };
  if (!Array.isArray(body.keywords)) {
    return NextResponse.json({ error: 'keywords must be an array' }, { status: 400 });
  }
  const kws = (body.keywords as unknown[]).filter((k): k is string => typeof k === 'string');
  setScoutKeywords(kws);
  return NextResponse.json({ keywords: getScoutKeywords() });
}
