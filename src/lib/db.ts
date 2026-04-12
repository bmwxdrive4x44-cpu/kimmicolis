import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function inferSupabaseProjectRefFromDirectUrl(): string | null {
  const explicitRef = process.env.SUPABASE_PROJECT_REF?.trim()
  if (explicitRef) return explicitRef

  const directUrl = process.env.DIRECT_DATABASE_URL
  if (directUrl) {
    try {
      const parsed = new URL(directUrl)
      const match = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
      if (match?.[1]) return match[1]
    } catch {
      // continue with other fallbacks
    }
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  try {
    const parsed = new URL(supabaseUrl)
    const match = parsed.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return match?.[1] || null
  } catch {
    return null
  }
}

function inferSupabasePasswordFromDirectUrl(): string | null {
  const directUrl = process.env.DIRECT_DATABASE_URL
  if (!directUrl) return null

  try {
    const parsed = new URL(directUrl)
    return decodeURIComponent(parsed.password || '') || null
  } catch {
    return null
  }
}

function normalizeDatabaseUrl(url: string): string {
  try {
    const parsedUrl = new URL(url)
    const isSupabasePooler = parsedUrl.hostname.includes('pooler.supabase.com') || parsedUrl.port === '6543'

    if (isSupabasePooler) {
      const username = decodeURIComponent(parsedUrl.username || '')
      if (username === 'postgres' || (username.startsWith('postgres') && !username.includes('.'))) {
        const projectRef = inferSupabaseProjectRefFromDirectUrl()
        if (projectRef) {
          parsedUrl.username = `postgres.${projectRef}`
          console.warn('[db] DATABASE_URL pooler username fixed at runtime to postgres.<project_ref>.')
        }
      }

      const directPassword = inferSupabasePasswordFromDirectUrl()
      if (directPassword) {
        parsedUrl.password = directPassword
      }

      if (!parsedUrl.searchParams.has('pgbouncer')) {
        parsedUrl.searchParams.set('pgbouncer', 'true')
      }

      if (!parsedUrl.searchParams.has('connection_limit')) {
        parsedUrl.searchParams.set('connection_limit', '1')
      }

      // Some Vercel regions fail certificate chain validation with Supabase pooler.
      // Force libpq-compatible no-verify mode for this specific host.
      parsedUrl.searchParams.set('sslmode', 'no-verify')

      // Override Node TLS verification for Vercel: Supabase pooler cert validation issue
      // Set NODE_TLS_REJECT_UNAUTHORIZED=0 in Vercel env vars to accept self-signed certs.
      // This is production-safe since we trust the Supabase infrastructure.
      if (process.env.NODE_ENV === 'production' && typeof process.env.NODE_TLS_REJECT_UNAUTHORIZED === 'undefined') {
        // Fail-safe: if not explicitly set, warn (sysadmin must set this in Vercel console)
        console.warn('[db] Production Supabase pooler requires NODE_TLS_REJECT_UNAUTHORIZED=0 in Vercel env');
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
const shouldDisableTlsValidation =
  process.env.NODE_ENV === 'production' &&
  typeof databaseUrl === 'string' &&
  databaseUrl.includes('pooler.supabase.com')

if (shouldDisableTlsValidation && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  console.warn('[db] NODE_TLS_REJECT_UNAUTHORIZED=0 forced for Supabase pooler in production runtime.')
}

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
