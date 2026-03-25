-- Add compliance & security fields to Relais
ALTER TABLE "Relais" ADD COLUMN IF NOT EXISTS "cautionAmount" DOUBLE PRECISION;
ALTER TABLE "Relais" ADD COLUMN IF NOT EXISTS "cautionStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Relais" ADD COLUMN IF NOT EXISTS "cautionPaidAt" TIMESTAMP(3);
ALTER TABLE "Relais" ADD COLUMN IF NOT EXISTS "activationDate" TIMESTAMP(3);
ALTER TABLE "Relais" ADD COLUMN IF NOT EXISTS "firstActivityDate" TIMESTAMP(3);
ALTER TABLE "Relais" ADD COLUMN IF NOT EXISTS "complianceScore" DOUBLE PRECISION NOT NULL DEFAULT 100;

-- Add audit fields to RelaisCash
ALTER TABLE "RelaisCash" ADD COLUMN IF NOT EXISTS "declaredAmount" DOUBLE PRECISION;
ALTER TABLE "RelaisCash" ADD COLUMN IF NOT EXISTS "verifiedAmount" DOUBLE PRECISION;
ALTER TABLE "RelaisCash" ADD COLUMN IF NOT EXISTS "variancePercent" DOUBLE PRECISION;
ALTER TABLE "RelaisCash" ADD COLUMN IF NOT EXISTS "auditDate" TIMESTAMP(3);
ALTER TABLE "RelaisCash" ADD COLUMN IF NOT EXISTS "auditedBy" TEXT;
ALTER TABLE "RelaisCash" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create RelaisSanction table
CREATE TABLE IF NOT EXISTS "RelaisSanction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "relaisId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reduction" DOUBLE PRECISION,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "appliedBy" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelaisSanction_relaisId_fkey" FOREIGN KEY ("relaisId") REFERENCES "Relais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create RelaisAudit table (immutable log)
CREATE TABLE IF NOT EXISTS "RelaisAudit" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "relaisId" TEXT NOT NULL,
  "auditDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "declaredTotal" DOUBLE PRECISION NOT NULL,
  "verifiedTotal" DOUBLE PRECISION NOT NULL,
  "variance" DOUBLE PRECISION NOT NULL,
  "discrepancies" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "auditedBy" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RelaisAudit_relaisId_fkey" FOREIGN KEY ("relaisId") REFERENCES "Relais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "RelaisSanction_relaisId_startDate_idx" ON "RelaisSanction"("relaisId", "startDate");
CREATE INDEX IF NOT EXISTS "RelaisSanction_endDate_idx" ON "RelaisSanction"("endDate");
CREATE INDEX IF NOT EXISTS "RelaisAudit_relaisId_auditDate_idx" ON "RelaisAudit"("relaisId", "auditDate");
CREATE INDEX IF NOT EXISTS "RelaisAudit_status_idx" ON "RelaisAudit"("status");
CREATE INDEX IF NOT EXISTS "RelaisCash_relaisId_createdAt_idx" ON "RelaisCash"("relaisId", "createdAt");
CREATE INDEX IF NOT EXISTS "RelaisCash_auditedBy_idx" ON "RelaisCash"("auditedBy");
