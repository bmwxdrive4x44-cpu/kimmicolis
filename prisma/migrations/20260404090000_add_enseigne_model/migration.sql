-- CreateTable
CREATE TABLE "Enseigne" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "legalName" TEXT,
  "website" TEXT,
  "logoUrl" TEXT,
  "monthlyVolume" INTEGER NOT NULL DEFAULT 0,
  "billingEmail" TEXT,
  "operationalCity" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Enseigne_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enseigne_userId_key" ON "Enseigne"("userId");

-- CreateIndex
CREATE INDEX "Enseigne_businessName_idx" ON "Enseigne"("businessName");

-- AddForeignKey
ALTER TABLE "Enseigne" ADD CONSTRAINT "Enseigne_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
