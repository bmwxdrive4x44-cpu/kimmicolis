import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const preferredRegion = ['cdg1', 'fra1'];

async function testPgWithOptions(url: string | null | undefined, label: string, options: any = {}) {
  if (!url) {
    return { ok: false, error: 'URL_NOT_SET', label };
  }

  const pool = new Pool({
    connectionString: url,
    ...options,
  });
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

function withNoVerifySslMode(url: string | null | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('sslmode', 'no-verify');
    return parsed.toString();
  } catch {
    return url;
  }
}

export async function GET() {
  const poolerStandard = await testPgWithOptions(process.env.DATABASE_URL, 'POOLER_STANDARD');
  const poolerNoReject = await testPgWithOptions(withNoVerifySslMode(process.env.DATABASE_URL), 'POOLER_NO_REJECT', {
    ssl: {
      rejectUnauthorized: false,
    },
  });

  return NextResponse.json({
    poolerStandard,
    poolerNoReject,
  });
}
