-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
    "siret" TEXT,
    "image" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "Relais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "commerceName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photos" TEXT,
    "commissionPetit" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "commissionMoyen" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "commissionGros" DOUBLE PRECISION NOT NULL DEFAULT 300,
    "cashCollected" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashReversed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "Relais_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ligne" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "villeDepart" TEXT NOT NULL,
    "villeArrivee" TEXT NOT NULL,
    "tarifPetit" DOUBLE PRECISION NOT NULL,
    "tarifMoyen" DOUBLE PRECISION NOT NULL,
    "tarifGros" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateTable
CREATE TABLE "Colis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trackingNumber" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "relaisDepartId" TEXT NOT NULL,
    "relaisArriveeId" TEXT NOT NULL,
    "villeDepart" TEXT NOT NULL,
    "villeArrivee" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "description" TEXT,
    "prixClient" DOUBLE PRECISION NOT NULL,
    "commissionPlateforme" DOUBLE PRECISION NOT NULL,
    "commissionRelais" DOUBLE PRECISION NOT NULL,
    "netTransporteur" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "qrCode" TEXT NOT NULL,
    "qrCodeImage" TEXT,
    "photoProof" TEXT,
    "dateCreation" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLimit" TIMESTAMP,
    "deliveredAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "Colis_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Colis_relaisDepartId_fkey" FOREIGN KEY ("relaisDepartId") REFERENCES "Relais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Colis_relaisArriveeId_fkey" FOREIGN KEY ("relaisArriveeId") REFERENCES "Relais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trajet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transporteurId" TEXT NOT NULL,
    "villeDepart" TEXT NOT NULL,
    "villeArrivee" TEXT NOT NULL,
    "villesEtapes" TEXT,
    "dateDepart" TIMESTAMP NOT NULL,
    "placesColis" INTEGER NOT NULL DEFAULT 10,
    "placesUtilisees" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROGRAMME',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "Trajet_transporteurId_fkey" FOREIGN KEY ("transporteurId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colisId" TEXT NOT NULL,
    "transporteurId" TEXT NOT NULL,
    "trajetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNE',
    "assignedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "Mission_colisId_fkey" FOREIGN KEY ("colisId") REFERENCES "Colis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_transporteurId_fkey" FOREIGN KEY ("transporteurId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Mission_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrackingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colisId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingHistory_colisId_fkey" FOREIGN KEY ("colisId") REFERENCES "Colis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Relais_userId_key" ON "Relais"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Colis_trackingNumber_key" ON "Colis"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");

-- CreateTable
CREATE TABLE "TransporterApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "vehicle" TEXT NOT NULL,
    "license" TEXT NOT NULL,
    "experience" INTEGER NOT NULL,
    "regions" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL,
    CONSTRAINT "TransporterApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransporterWallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transporteurId" TEXT NOT NULL,
    "pendingEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "availableEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RelaisCash" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "relaisId" TEXT NOT NULL,
    "colisId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RelaisCash_relaisId_fkey" FOREIGN KEY ("relaisId") REFERENCES "Relais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RelaisCash_colisId_fkey" FOREIGN KEY ("colisId") REFERENCES "Colis" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "TransporterApplication_userId_key" ON "TransporterApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TransporterWallet_transporteurId_key" ON "TransporterWallet"("transporteurId");
