import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const preferredRegion = ['cdg1', 'fra1'];

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1 AS ok`;
    return NextResponse.json({
      status: 'ok',
      node: process.env.NODE_ENV,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        status: 'error',
        error: message,
        node: process.env.NODE_ENV,
      },
      { status: 500 }
    );
  }
}
