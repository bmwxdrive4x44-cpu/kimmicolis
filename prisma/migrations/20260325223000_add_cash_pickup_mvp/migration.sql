CREATE TABLE IF NOT EXISTS "CashPickup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "relaisId" TEXT NOT NULL,
  "collectorId" TEXT,
  "expectedAmount" DOUBLE PRECISION NOT NULL,
  "collectedAmount" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "scheduledAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "receiptRef" TEXT,
  "relayValidationCodeHash" TEXT,
  "collectorCodeHash" TEXT,
  "proofPhotoUrl" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CashPickup_relaisId_fkey" FOREIGN KEY ("relaisId") REFERENCES "Relais"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CashPickup_receiptRef_key" ON "CashPickup"("receiptRef");
CREATE INDEX IF NOT EXISTS "CashPickup_relaisId_createdAt_idx" ON "CashPickup"("relaisId", "createdAt");
CREATE INDEX IF NOT EXISTS "CashPickup_status_scheduledAt_idx" ON "CashPickup"("status", "scheduledAt");
