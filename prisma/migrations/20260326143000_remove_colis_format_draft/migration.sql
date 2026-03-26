-- Draft migration prepared for future rollout.
-- Do not apply until all runtime references to Colis.format are removed and Prisma schema/client are updated.

ALTER TABLE "Colis"
DROP COLUMN "format";
