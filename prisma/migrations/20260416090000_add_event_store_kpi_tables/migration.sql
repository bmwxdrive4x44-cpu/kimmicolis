-- Event-driven KPI system: Event Store + precomputed KPI tables

CREATE TABLE IF NOT EXISTS "Event" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Event_aggregateType_aggregateId_createdAt_idx"
  ON "Event" ("aggregateType", "aggregateId", "createdAt");

CREATE INDEX IF NOT EXISTS "Event_type_createdAt_idx"
  ON "Event" ("type", "createdAt");

CREATE TABLE IF NOT EXISTS "KpiTransporter" (
  "transporteurId" TEXT PRIMARY KEY,
  "missionsTotal" INTEGER NOT NULL DEFAULT 0,
  "missionsActive" INTEGER NOT NULL DEFAULT 0,
  "missionsAssigned" INTEGER NOT NULL DEFAULT 0,
  "missionsInProgress" INTEGER NOT NULL DEFAULT 0,
  "missionsCompleted" INTEGER NOT NULL DEFAULT 0,
  "earningsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "KpiEnseigne" (
  "enseigneId" TEXT PRIMARY KEY,
  "parcelsTotal" INTEGER NOT NULL DEFAULT 0,
  "parcelsDelivered" INTEGER NOT NULL DEFAULT 0,
  "pendingPayment" INTEGER NOT NULL DEFAULT 0,
  "readyForDeposit" INTEGER NOT NULL DEFAULT 0,
  "inTransit" INTEGER NOT NULL DEFAULT 0,
  "arrivedRelay" INTEGER NOT NULL DEFAULT 0,
  "revenueDelivered" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "revenueCommitted" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "KpiRelais" (
  "relaisId" TEXT PRIMARY KEY,
  "pendingActions" INTEGER NOT NULL DEFAULT 0,
  "stockDeparture" INTEGER NOT NULL DEFAULT 0,
  "stockArrival" INTEGER NOT NULL DEFAULT 0,
  "handoversCompleted" INTEGER NOT NULL DEFAULT 0,
  "cashOnHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "commissionsTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
