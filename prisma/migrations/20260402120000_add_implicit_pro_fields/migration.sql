ALTER TABLE "User"
  ADD COLUMN "eligibleProImplicit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "eligibleProSince" TIMESTAMP(3),
  ADD COLUMN "proLastEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN "weeklyValidShipments" INTEGER NOT NULL DEFAULT 0;
