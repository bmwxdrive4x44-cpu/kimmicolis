ALTER TABLE "Colis"
  ADD COLUMN IF NOT EXISTS "qrToken" TEXT,
  ADD COLUMN IF NOT EXISTS "custody" TEXT NOT NULL DEFAULT 'CLIENT',
  ADD COLUMN IF NOT EXISTS "expectedDeliveryAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "delayed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "TrackingHistory"
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "relaisId" TEXT;

ALTER TABLE "ActionLog"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" TEXT;

CREATE TABLE IF NOT EXISTS "DeliveryProof" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "colisId" TEXT NOT NULL,
  "receiverName" TEXT NOT NULL,
  "codeVerified" BOOLEAN NOT NULL DEFAULT true,
  "photoUrl" TEXT,
  "relaisId" TEXT,
  "deliveredById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryProof_colisId_fkey" FOREIGN KEY ("colisId") REFERENCES "Colis"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Colis_qrToken_key" ON "Colis"("qrToken");
CREATE UNIQUE INDEX IF NOT EXISTS "DeliveryProof_colisId_key" ON "DeliveryProof"("colisId");
CREATE UNIQUE INDEX IF NOT EXISTS "ActionLog_eventId_key" ON "ActionLog"("eventId");
CREATE INDEX IF NOT EXISTS "ActionLog_entityType_entityId_action_idx" ON "ActionLog"("entityType", "entityId", "action");