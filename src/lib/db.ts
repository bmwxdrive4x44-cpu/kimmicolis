import { PrismaClient } from '@/generated/prisma'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const runtimeDatabaseUrl = process.env.DATABASE_URL

if (!runtimeDatabaseUrl && process.env.NODE_ENV !== 'test') {
  if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
    console.warn('[db] DATABASE_URL is not set. Database operations will fail at runtime.');
  }
}

// Use placeholder URL during build phase only; runtime requires a real DATABASE_URL.
const resolvedUrl =
  runtimeDatabaseUrl || 'postgresql://localhost:5432/placeholder_build_only?schema=public'

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
