import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Supabase: MUST use direct connection (port 5432) to avoid "prepared statement" errors
// The pooler (port 6543) doesn't support prepared statements which Prisma uses
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl && process.env.NODE_ENV !== 'test') {
  // During build time (no DB URL available), we use a placeholder to allow compilation.
  // At runtime, if DATABASE_URL is missing, queries will fail with a clear connection error.
  if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[db] DATABASE_URL is not set. Database operations will fail at runtime.');
  }
}

// Use placeholder URL during build phase only; runtime requires a real URL.
const resolvedUrl =
  databaseUrl || 'postgresql://localhost:5432/placeholder_build_only?schema=public'

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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
