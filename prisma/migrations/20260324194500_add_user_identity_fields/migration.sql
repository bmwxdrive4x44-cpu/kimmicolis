-- AlterTable
ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "address" TEXT;

-- Backfill firstName/lastName from legacy name when possible
UPDATE "User"
SET
  "firstName" = COALESCE(NULLIF(TRIM(SPLIT_PART("name", ' ', 1)), ''), "firstName"),
  "lastName" = COALESCE(
    NULLIF(
      TRIM(SUBSTRING("name" FROM LENGTH(SPLIT_PART("name", ' ', 1)) + 1)),
      ''
    ),
    "lastName"
  )
WHERE "name" IS NOT NULL;
