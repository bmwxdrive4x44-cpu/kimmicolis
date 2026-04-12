import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export const runtime = 'nodejs';
export const preferredRegion = ['cdg1', 'fra1'];

function inferSupabaseProjectRefFromDirectUrl(): string | null {
  const explicitRef = process.env.SUPABASE_PROJECT_REF?.trim();
  if (explicitRef) return explicitRef;

  const directUrl = process.env.DIRECT_DATABASE_URL;
  if (directUrl) {
    try {
      const parsed = new URL(directUrl);
      const match = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
      if (match?.[1]) return match[1];
    } catch {
      // continue with other fallbacks
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  try {
    const parsed = new URL(supabaseUrl);
    const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function withPoolerUsernameFix(url: string | null | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const isPooler = parsed.hostname.includes('pooler.supabase.com') || parsed.port === '6543';
    const username = decodeURIComponent(parsed.username || '');

    if (isPooler && username === 'postgres') {
      const projectRef = inferSupabaseProjectRefFromDirectUrl();
      if (projectRef) {
        parsed.username = `postgres.${projectRef}`;
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function inferSupabasePasswordFromDirectUrl(): string | null {
  const directUrl = process.env.DIRECT_DATABASE_URL;
  if (!directUrl) return null;

  try {
    const parsed = new URL(directUrl);
    return decodeURIComponent(parsed.password || '') || null;
  } catch {
    return null;
  }
}

function withPoolerPasswordFromDirect(url: string | null | undefined) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    const directPassword = inferSupabasePasswordFromDirectUrl();
    if (directPassword) {
      parsed.password = directPassword;
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function buildPoolerUrlFromDirectUrl(url: string | null | undefined) {
  if (!url) return url;
  const projectRef = inferSupabaseProjectRefFromDirectUrl();
  const password = inferSupabasePasswordFromDirectUrl();
  if (!projectRef || !password) return url;

  try {
    const parsed = new URL(url);
    const dbName = parsed.pathname || '/postgres';
    const rebuilt = new URL(`postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-eu-west-1.pooler.supabase.com:6543${dbName}`);
    rebuilt.searchParams.set('sslmode', 'no-verify');
    rebuilt.searchParams.set('pgbouncer', 'true');
    rebuilt.searchParams.set('connection_limit', '1');
    return rebuilt.toString();
  } catch {
    return url;
  }
}

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
  // Neutralize ambient PG* variables so tests reflect the provided URLs only.
  delete process.env.PGHOST;
  delete process.env.PGPORT;
  delete process.env.PGUSER;
  delete process.env.PGPASSWORD;
  delete process.env.PGDATABASE;
  delete process.env.PGSSLMODE;

  const inferredProjectRef = inferSupabaseProjectRefFromDirectUrl();
  const fixedUrl = withNoVerifySslMode(
    buildPoolerUrlFromDirectUrl(
      withPoolerPasswordFromDirect(withPoolerUsernameFix(process.env.DATABASE_URL))
    )
  );
  let fixedUsername: string | null = null;
  try {
    fixedUsername = fixedUrl ? decodeURIComponent(new URL(fixedUrl).username || '') : null;
  } catch {
    fixedUsername = null;
  }

  const poolerStandard = await testPgWithOptions(process.env.DATABASE_URL, 'POOLER_STANDARD');
  const poolerNoReject = await testPgWithOptions(withNoVerifySslMode(process.env.DATABASE_URL), 'POOLER_NO_REJECT', {
    ssl: {
      rejectUnauthorized: false,
    },
  });
  const poolerFixedUserNoReject = await testPgWithOptions(
    fixedUrl,
    'POOLER_FIXED_USER_NO_REJECT',
    {
      ssl: {
        rejectUnauthorized: false,
      },
    }
  );

  return NextResponse.json({
    inferredProjectRef,
    fixedUsername,
    poolerStandard,
    poolerNoReject,
    poolerFixedUserNoReject,
  });
}
