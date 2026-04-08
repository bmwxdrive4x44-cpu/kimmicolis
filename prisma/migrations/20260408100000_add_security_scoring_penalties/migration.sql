-- AddColumn qrExpiresAt, withdrawalPin, injectionBlocked to Colis
ALTER TABLE "Colis" ADD COLUMN "qrExpiresAt" TIMESTAMP(3),
ADD COLUMN "withdrawalPin" TEXT,
ADD COLUMN "injectionBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "blockReason" TEXT;

-- AddColumn assignmentDeadline, relaisConfirmed, transporteurConfirmed to Mission
ALTER TABLE "Mission" ADD COLUMN "assignmentDeadline" TIMESTAMP(3),
ADD COLUMN "relaisConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "transporteurConfirmed" BOOLEAN NOT NULL DEFAULT false;

-- AddColumn escrowedEarnings, totalPenalties to TransporterWallet
ALTER TABLE "TransporterWallet" ADD COLUMN "escrowedEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalPenalties" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable TransporterScore
CREATE TABLE "TransporterScore" (
    "id" TEXT NOT NULL,
    "transporteurId" TEXT NOT NULL,
    "successRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "avgCompletionTime" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cancellationRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
    "totalCancellations" INTEGER NOT NULL DEFAULT 0,
    "totalLate" INTEGER NOT NULL DEFAULT 0,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransporterScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on TransporterScore
CREATE UNIQUE INDEX "TransporterScore_transporteurId_key" ON "TransporterScore"("transporteurId");
CREATE INDEX "TransporterScore_score_idx" ON "TransporterScore"("score");
CREATE INDEX "TransporterScore_transporteurId_idx" ON "TransporterScore"("transporteurId");

-- CreateTable TransporterPenalty
CREATE TABLE "TransporterPenalty" (
    "id" TEXT NOT NULL,
    "transporteurId" TEXT NOT NULL,
    "colisId" TEXT,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3),
    "waivedAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "waiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransporterPenalty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on TransporterPenalty
CREATE INDEX "TransporterPenalty_transporteurId_createdAt_idx" ON "TransporterPenalty"("transporteurId", "createdAt");
CREATE INDEX "TransporterPenalty_status_idx" ON "TransporterPenalty"("status");
CREATE INDEX "TransporterPenalty_colisId_idx" ON "TransporterPenalty"("colisId");

-- CreateTable QrSecurityLog
CREATE TABLE "QrSecurityLog" (
    "id" TEXT NOT NULL,
    "colisId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "scanLocation" TEXT,
    "scannerRole" TEXT,
    "pinAttempts" INTEGER NOT NULL DEFAULT 0,
    "pinVerified" BOOLEAN NOT NULL DEFAULT false,
    "tokenValid" BOOLEAN NOT NULL DEFAULT true,
    "expiryStatus" TEXT,
    "fraudFlagRaised" BOOLEAN NOT NULL DEFAULT false,
    "fraudReason" TEXT,
    "scanTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrSecurityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex on QrSecurityLog
CREATE INDEX "QrSecurityLog_colisId_idx" ON "QrSecurityLog"("colisId");
CREATE INDEX "QrSecurityLog_fraudFlagRaised_idx" ON "QrSecurityLog"("fraudFlagRaised");
CREATE INDEX "QrSecurityLog_scanTimestamp_idx" ON "QrSecurityLog"("scanTimestamp");
