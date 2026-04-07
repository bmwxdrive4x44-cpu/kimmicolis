-- CreateTable "TransporterPreferences"
CREATE TABLE "TransporterPreferences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "preferredCities" TEXT,
  "preferredRoutes" TEXT,
  "excludedCities" TEXT,
  "autoAssignEnabled" BOOLEAN NOT NULL DEFAULT false,
  "autoAssignSchedule" TEXT,
  "maxDailyMissions" INTEGER NOT NULL DEFAULT 10,
  "maxActiveParallel" INTEGER NOT NULL DEFAULT 5,
  "maxWeightKg" DOUBLE PRECISION,
  "maxDimensionCm" DOUBLE PRECISION,
  "acceptsCOD" BOOLEAN NOT NULL DEFAULT true,
  "acceptsPriority" BOOLEAN NOT NULL DEFAULT true,
  "acceptsBulk" BOOLEAN NOT NULL DEFAULT false,
  "scoreWeightDistance" INTEGER NOT NULL DEFAULT 30,
  "scoreWeightCapacity" INTEGER NOT NULL DEFAULT 25,
  "scoreWeightTiming" INTEGER NOT NULL DEFAULT 20,
  "scoreWeightEarnings" INTEGER NOT NULL DEFAULT 25,
  "availabilityWindows" TEXT,
  "lastAssignmentCheck" TIMESTAMP(3),
  "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "avgRating" DOUBLE PRECISION,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TransporterPreferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransporterPreferences_userId_key" ON "TransporterPreferences"("userId");

-- AddForeignKey
ALTER TABLE "TransporterPreferences" ADD CONSTRAINT "TransporterPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
