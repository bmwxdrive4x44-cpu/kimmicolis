import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Temporary diagnostic endpoint — REMOVE after debugging
// GET /api/health
export async function GET() {
  const dbUrlPartial = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@').substring(0, 80)
    : '(not set)';

  try {
    await db.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({
      db: 'ok',
      url: dbUrlPartial,
      node: process.env.NODE_ENV,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        db: 'error',
        url: dbUrlPartial,
        error: message,
        node: process.env.NODE_ENV,
      },
      { status: 500 }
    );
  }
}
