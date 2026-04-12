-- Idempotent production hotfix for ActionLog schema drift
-- Ensures columns required by current Prisma schema exist.

ALTER TABLE "ActionLog"
  ADD COLUMN IF NOT EXISTS "eventId" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" TEXT;

-- If duplicates were created before unique constraint existed,
-- keep the first event and nullify subsequent duplicates.
WITH ranked AS (
  SELECT
    id,
    "eventId",
    ROW_NUMBER() OVER (
      PARTITION BY "eventId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "ActionLog"
  WHERE "eventId" IS NOT NULL
)
UPDATE "ActionLog" a
SET "eventId" = NULL
FROM ranked r
WHERE a.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "ActionLog_eventId_key"
  ON "ActionLog"("eventId");

CREATE INDEX IF NOT EXISTS "ActionLog_entityType_entityId_action_idx"
  ON "ActionLog"("entityType", "entityId", "action");
