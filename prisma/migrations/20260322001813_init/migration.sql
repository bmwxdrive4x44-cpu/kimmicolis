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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Relais" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "commerceName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "photos" TEXT,
    "commissionPetit" REAL NOT NULL DEFAULT 100,
    "commissionMoyen" REAL NOT NULL DEFAULT 200,
    "commissionGros" REAL NOT NULL DEFAULT 300,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Relais_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ligne" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "villeDepart" TEXT NOT NULL,
    "villeArrivee" TEXT NOT NULL,
    "tarifPetit" REAL NOT NULL,
    "tarifMoyen" REAL NOT NULL,
    "tarifGros" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
    "weight" REAL,
    "description" TEXT,
    "prixClient" REAL NOT NULL,
    "commissionPlateforme" REAL NOT NULL,
    "commissionRelais" REAL NOT NULL,
    "netTransporteur" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "qrCode" TEXT NOT NULL,
    "qrCodeImage" TEXT,
    "dateCreation" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateLimit" DATETIME,
    "deliveredAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "dateDepart" DATETIME NOT NULL,
    "placesColis" INTEGER NOT NULL DEFAULT 10,
    "placesUtilisees" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PROGRAMME',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trajet_transporteurId_fkey" FOREIGN KEY ("transporteurId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "colisId" TEXT NOT NULL,
    "transporteurId" TEXT NOT NULL,
    "trajetId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ASSIGNE',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Relais_userId_key" ON "Relais"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Colis_trackingNumber_key" ON "Colis"("trackingNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
