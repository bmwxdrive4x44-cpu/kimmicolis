import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const preferredRegion = ['cdg1', 'fra1'];

async function testPgDirect(url: string | null | undefined, label: string) {
  if (!url) {
    return { ok: false, error: 'URL_NOT_SET', label };
  }

  const pool = new Pool({ connectionString: url });
  try {
    const result = await pool.query('SELECT 1 AS ok');
    return { ok: true, label, result: result.rows };
  } catch (error) {
    return {
      ok: false,
      label,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await pool.end();
  }
}

export async function GET() {
  const poolerResult = await testPgDirect(process.env.DATABASE_URL, 'POOLER');
  const directResult = await testPgDirect(process.env.DIRECT_DATABASE_URL, 'DIRECT');

  return NextResponse.json({
    pooler: poolerResult,
    direct: directResult,
  });
}
