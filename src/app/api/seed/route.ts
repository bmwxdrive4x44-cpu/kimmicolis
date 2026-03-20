import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  try {
    console.log('Starting database seed with raw SQL...');

    // Hash passwords
    const adminPassword = await hashPassword('admin123');
    const clientPassword = await hashPassword('client123');
    const transporterPassword = await hashPassword('transport123');
    const relaisPassword = await hashPassword('relais123');

    // Use raw SQL to avoid prepared statement issues with Supabase pooler
    // Create admin user
    await db.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'admin@swiftcolis.dz', '${adminPassword}', 'Admin SwiftColis', 'ADMIN', '+213555000000', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = '${adminPassword}', "updatedAt" = NOW()
    `);
    console.log('Admin created');

    // Create client user
    await db.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'client@demo.dz', '${clientPassword}', 'Ahmed Benali', 'CLIENT', '+213555111111', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = '${clientPassword}', "updatedAt" = NOW()
    `);
    console.log('Client created');

    // Create transporter user
    await db.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, password, name, role, phone, siret, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'transport@demo.dz', '${transporterPassword}', 'Karim Transport', 'TRANSPORTER', '+213555222222', '12345678901234', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = '${transporterPassword}', "updatedAt" = NOW()
    `);
    console.log('Transporter created');

    // Create relais user
    await db.$executeRawUnsafe(`
      INSERT INTO "User" (id, email, password, name, role, phone, "isActive", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), 'relais@demo.dz', '${relaisPassword}', 'Relais Centre', 'RELAIS', '+213555333333', true, NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET password = '${relaisPassword}', "updatedAt" = NOW()
    `);
    console.log('Relais user created');

    // Get relais user id
    const relaisUser = await db.$queryRaw<Array<{id: string}>>`
      SELECT id FROM "User" WHERE email = 'relais@demo.dz'
    `;
    
    if (relaisUser.length > 0) {
      // Create or update relais with PENDING status - admin must validate
      await db.$executeRawUnsafe(`
        INSERT INTO "Relais" (id, "userId", "commerceName", address, ville, status, "commissionPetit", "commissionMoyen", "commissionGros", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${relaisUser[0].id}', 'Épicerie du Centre', '123 Rue Didouche Mourad', 'alger', 'PENDING', 100, 200, 300, NOW(), NOW())
        ON CONFLICT ("userId") DO UPDATE SET "commerceName" = 'Épicerie du Centre', "updatedAt" = NOW()
      `);
      console.log('Relais created with PENDING status - admin must validate');
    }

    // Create transport lines
    const lines = [
      { depart: 'alger', arrivee: 'oran', petit: 500, moyen: 750, gros: 1000 },
      { depart: 'alger', arrivee: 'constantine', petit: 600, moyen: 900, gros: 1200 },
      { depart: 'alger', arrivee: 'annaba', petit: 650, moyen: 975, gros: 1300 },
      { depart: 'alger', arrivee: 'blida', petit: 200, moyen: 300, gros: 400 },
      { depart: 'alger', arrivee: 'setif', petit: 550, moyen: 825, gros: 1100 },
      { depart: 'alger', arrivee: 'tizi_ouzou', petit: 350, moyen: 525, gros: 700 },
      { depart: 'alger', arrivee: 'bejaia', petit: 400, moyen: 600, gros: 800 },
      { depart: 'oran', arrivee: 'tlemcen', petit: 300, moyen: 450, gros: 600 },
      { depart: 'constantine', arrivee: 'batna', petit: 200, moyen: 300, gros: 400 },
      { depart: 'setif', arrivee: 'batna', petit: 250, moyen: 375, gros: 500 },
    ];

    for (const line of lines) {
      await db.$executeRawUnsafe(`
        INSERT INTO "Ligne" (id, "villeDepart", "villeArrivee", "tarifPetit", "tarifMoyen", "tarifGros", "isActive", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), '${line.depart}', '${line.arrivee}', ${line.petit}, ${line.moyen}, ${line.gros}, true, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `);
    }
    console.log('Lines created');

    console.log('Database seed completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      credentials: {
        admin: { email: 'admin@swiftcolis.dz', password: 'admin123', role: 'ADMIN' },
        client: { email: 'client@demo.dz', password: 'client123', role: 'CLIENT' },
        transporter: { email: 'transport@demo.dz', password: 'transport123', role: 'TRANSPORTER' },
        relais: { email: 'relais@demo.dz', password: 'relais123', role: 'RELAIS' },
      },
    });
  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ 
      success: false,
      error: 'Failed to seed database',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
