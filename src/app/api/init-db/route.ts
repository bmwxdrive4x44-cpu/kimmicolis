import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(request: NextRequest) {
  // Uniquement disponible en environnement de développement local
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;
  try {
    console.log('Initializing database tables with raw SQL...');

    // Create tables using raw SQL
    const createTablesSQL = `
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
        "operationalStatus" TEXT DEFAULT 'ACTIF',
        "suspensionReason" TEXT,
        "suspendedAt" TIMESTAMP,
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
    `;

    // Split by semicolon and execute each statement
    const statements = createTablesSQL.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await db.$executeRawUnsafe(statement);
        } catch (e: any) {
          // Ignore "already exists" errors
          if (!e.message?.includes('already exists')) {
            console.log('Statement error:', e.message);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database tables created successfully',
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to initialize database',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
