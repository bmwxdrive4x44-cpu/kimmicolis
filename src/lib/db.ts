import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// For Supabase: MUST use direct connection (port 5432) to avoid "prepared statement" errors
// The pooler (port 6543) doesn't support prepared statements which Prisma uses
const databaseUrl = process.env.DATABASE_URL

// During build time without a DATABASE_URL, use a placeholder to avoid constructor errors.
// The actual DB connection is only established at runtime when real requests are made.
const resolvedUrl = databaseUrl || 'postgresql://localhost:5432/placeholder?schema=public'

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
