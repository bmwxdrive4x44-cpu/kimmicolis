import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function normalizeDatabaseUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const isSupabasePooler = parsedUrl.hostname.includes('pooler.supabase.com') || parsedUrl.port === '6543'

    if (isSupabasePooler) {
      if (!parsedUrl.searchParams.has('pgbouncer')) {
        parsedUrl.searchParams.set('pgbouncer', 'true')
      }

      if (!parsedUrl.searchParams.has('connection_limit')) {
        parsedUrl.searchParams.set('connection_limit', '1')
      }
    }

    return parsedUrl.toString()
  } catch {
    return url
  }
}

function isSupabaseDirect5432(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.hostname.endsWith('.supabase.co') && parsedUrl.port === '5432'
  } catch {
    return false
  }
}

// Runtime should use DATABASE_URL (typically Supabase pooler on Vercel).
// DIRECT_DATABASE_URL is mainly for Prisma CLI/migrations and must not be used by runtime in production.
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl && process.env.NODE_ENV !== 'test') {
  // During build time (no DB URL available), we use a placeholder to allow compilation.
  // At runtime, if DATABASE_URL is missing, queries will fail with a clear connection error.
  if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[db] DATABASE_URL is not set. Database operations will fail at runtime.');
  }
}

if (process.env.NODE_ENV === 'production' && databaseUrl && isSupabaseDirect5432(databaseUrl)) {
  throw new Error('[db] Invalid DATABASE_URL for production runtime: direct Supabase host :5432 detected. Use Supabase pooler :6543.')
}

// Use placeholder URL during build phase only; runtime requires a real DATABASE_URL.
// In production, if DATABASE_URL is absent, all DB queries will throw a connection error.
// This placeholder ONLY prevents a Prisma constructor validation error at build time.
const resolvedUrl =
  normalizeDatabaseUrl(
    databaseUrl || 'postgresql://localhost:5432/placeholder_build_only?schema=public'
  )

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: resolvedUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
}
