-- Idempotent production hotfix: align User and ContactMessage with current Prisma schema.

-- 1) User loyalty/pro fields
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "clientType" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN IF NOT EXISTS "eligibleProImplicit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "eligibleProSince" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "proLastEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "weeklyValidShipments" INTEGER NOT NULL DEFAULT 0;

-- 2) Contact messages table (if absent)
CREATE TABLE IF NOT EXISTS "ContactMessage" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "repliedAt" TIMESTAMP(3),
  "replyContent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- 3) ContactMessage columns/indexes (if table already existed with older shape)
ALTER TABLE "ContactMessage"
  ADD COLUMN IF NOT EXISTS "repliedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replyContent" TEXT,
  ADD COLUMN IF NOT EXISTS "isRead" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "ContactMessage_isRead_idx" ON "ContactMessage"("isRead");
