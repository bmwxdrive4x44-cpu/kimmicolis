-- Kimmicolis Database Initialization Script
-- Execute this in Supabase SQL Editor: https://supabase.com/dashboard/project/iyvlbajgpywblhavmnmf/sql/new

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT UNIQUE NOT NULL,
  "password" TEXT,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "phone" TEXT,
  "siret" TEXT,
  "image" TEXT,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Relais table
CREATE TABLE IF NOT EXISTS "Relais" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT UNIQUE NOT NULL,
  "commerceName" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "ville" TEXT NOT NULL,
  "latitude" FLOAT,
  "longitude" FLOAT,
  "photos" TEXT,
  "commissionPetit" FLOAT DEFAULT 100,
  "commissionMoyen" FLOAT DEFAULT 200,
  "commissionGros" FLOAT DEFAULT 300,
  "status" TEXT DEFAULT 'PENDING',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Ligne table
CREATE TABLE IF NOT EXISTS "Ligne" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "villeDepart" TEXT NOT NULL,
  "villeArrivee" TEXT NOT NULL,
  "tarifPetit" FLOAT NOT NULL,
  "tarifMoyen" FLOAT NOT NULL,
  "tarifGros" FLOAT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Colis table
CREATE TABLE IF NOT EXISTS "Colis" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "trackingNumber" TEXT UNIQUE NOT NULL,
  "clientId" TEXT NOT NULL,
  "relaisDepartId" TEXT NOT NULL,
  "relaisArriveeId" TEXT NOT NULL,
  "villeDepart" TEXT NOT NULL,
  "villeArrivee" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "weight" FLOAT,
  "description" TEXT,
  "prixClient" FLOAT NOT NULL,
  "commissionPlateforme" FLOAT NOT NULL,
  "commissionRelais" FLOAT NOT NULL,
  "netTransporteur" FLOAT NOT NULL,
  "status" TEXT DEFAULT 'CREATED',
  "qrCode" TEXT NOT NULL,
  "qrCodeImage" TEXT,
  "dateCreation" TIMESTAMP DEFAULT NOW(),
  "dateLimit" TIMESTAMP,
  "deliveredAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE,
  FOREIGN KEY ("relaisDepartId") REFERENCES "Relais"("id") ON DELETE CASCADE,
  FOREIGN KEY ("relaisArriveeId") REFERENCES "Relais"("id") ON DELETE CASCADE
);

-- Trajet table
CREATE TABLE IF NOT EXISTS "Trajet" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "transporteurId" TEXT NOT NULL,
  "villeDepart" TEXT NOT NULL,
  "villeArrivee" TEXT NOT NULL,
  "villesEtapes" TEXT,
  "dateDepart" TIMESTAMP NOT NULL,
  "placesColis" INT DEFAULT 10,
  "placesUtilisees" INT DEFAULT 0,
  "status" TEXT DEFAULT 'PROGRAMME',
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("transporteurId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Mission table
CREATE TABLE IF NOT EXISTS "Mission" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "colisId" TEXT NOT NULL,
  "transporteurId" TEXT NOT NULL,
  "trajetId" TEXT,
  "status" TEXT DEFAULT 'ASSIGNE',
  "assignedAt" TIMESTAMP DEFAULT NOW(),
  "completedAt" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("colisId") REFERENCES "Colis"("id") ON DELETE CASCADE,
  FOREIGN KEY ("transporteurId") REFERENCES "User"("id") ON DELETE CASCADE,
  FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE SET NULL
);

-- TrackingHistory table
CREATE TABLE IF NOT EXISTS "TrackingHistory" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "colisId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("colisId") REFERENCES "Colis"("id") ON DELETE CASCADE
);

-- Notification table
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "isRead" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Setting table
CREATE TABLE IF NOT EXISTS "Setting" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" TEXT UNIQUE NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. INSERT TEST USERS
-- ============================================
-- Passwords are SHA-256 hashes

-- Admin user (password: admin123)
INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
VALUES (
  'cmr_admin_001',
  'admin@swiftcolis.dz',
  '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  'Admin SwiftColis',
  'ADMIN',
  '+213555000000',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW();

-- Client user (password: client123)
INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
VALUES (
  'cmr_client_001',
  'client@demo.dz',
  '186474c1f2c2f735a54c2cf82ee8e87f2a5cd30940e280029363fecedfc5328c',
  'Ahmed Benali',
  'CLIENT',
  '+213555111111',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW();

-- Transporter user (password: transport123)
INSERT INTO "User" (id, email, password, name, role, phone, siret, "isActive", "createdAt", "updatedAt")
VALUES (
  'cmr_transport_001',
  'transport@demo.dz',
  '8f07c171cca776c146d53d8b4184f27e12b730b76e8a291bbb96a415a29d5f13',
  'Karim Transport',
  'TRANSPORTER',
  '+213555222222',
  '12345678901234',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW();

-- Relais user (password: relais123)
INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
VALUES (
  'cmr_relais_001',
  'relais@demo.dz',
  '10f4de81d9ef96696e811c14910f57ceef153c5f911f95176c0e6e8806625f71',
  'Relais Centre',
  'RELAIS',
  '+213555333333',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, "updatedAt" = NOW();

-- ============================================
-- 3. INSERT RELAIS
-- ============================================
INSERT INTO "Relais" (id, "userId", "commerceName", address, ville, status, "commissionPetit", "commissionMoyen", "commissionGros", "createdAt", "updatedAt")
VALUES (
  'cmr_relais_point_001',
  'cmr_relais_001',
  'Épicerie du Centre',
  '123 Rue Didouche Mourad',
  'alger',
  'APPROVED',
  100,
  200,
  300,
  NOW(),
  NOW()
) ON CONFLICT ("userId") DO UPDATE SET "commerceName" = EXCLUDED."commerceName", "updatedAt" = NOW();

-- ============================================
-- 4. INSERT TRANSPORT LINES
-- ============================================
INSERT INTO "Ligne" (id, "villeDepart", "villeArrivee", "tarifPetit", "tarifMoyen", "tarifGros", "isActive", "createdAt", "updatedAt") VALUES
('ligne_001', 'alger', 'oran', 500, 750, 1000, true, NOW(), NOW()),
('ligne_002', 'alger', 'constantine', 600, 900, 1200, true, NOW(), NOW()),
('ligne_003', 'alger', 'annaba', 650, 975, 1300, true, NOW(), NOW()),
('ligne_004', 'alger', 'blida', 200, 300, 400, true, NOW(), NOW()),
('ligne_005', 'alger', 'setif', 550, 825, 1100, true, NOW(), NOW()),
('ligne_006', 'alger', 'tizi_ouzou', 350, 525, 700, true, NOW(), NOW()),
('ligne_007', 'alger', 'bejaia', 400, 600, 800, true, NOW(), NOW()),
('ligne_008', 'oran', 'tlemcen', 300, 450, 600, true, NOW(), NOW()),
('ligne_009', 'constantine', 'batna', 200, 300, 400, true, NOW(), NOW()),
('ligne_010', 'setif', 'batna', 250, 375, 500, true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================
-- SUCCESS! You can now login with:
-- Admin: admin@swiftcolis.dz / admin123
-- Client: client@demo.dz / client123
-- Transporter: transport@demo.dz / transport123
-- Relais: relais@demo.dz / relais123
-- ============================================
