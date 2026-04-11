import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

function isDevSeedApiEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEV_SEED_API === 'true';
}

export async function GET() {
  // Inaccessible by default; enable explicitly for local seed workflows.
  if (!isDevSeedApiEnabled()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    console.log('Starting database seed...');

    // Hash passwords
    const adminPassword = await hashPassword('admin123');
    const clientPassword = await hashPassword('client123');
    const transporterPassword = await hashPassword('transport123');
    const relaisPassword = await hashPassword('relais123');

    // Create or update users
    await db.user.upsert({
      where: { email: 'admin@swiftcolis.dz' },
      update: { password: adminPassword, name: 'Admin SwiftColis', role: 'ADMIN', phone: '+213555000000', isActive: true },
      create: {
        email: 'admin@swiftcolis.dz',
        password: adminPassword,
        name: 'Admin SwiftColis',
        role: 'ADMIN',
        phone: '+213555000000',
        isActive: true,
      },
    });
    console.log('Admin created');

    await db.user.upsert({
      where: { email: 'client@demo.dz' },
      update: { password: clientPassword, name: 'Ahmed Benali', role: 'CLIENT', phone: '+213555111111', isActive: true },
      create: {
        email: 'client@demo.dz',
        password: clientPassword,
        name: 'Ahmed Benali',
        role: 'CLIENT',
        phone: '+213555111111',
        isActive: true,
      },
    });
    console.log('Client created');

    await db.user.upsert({
      where: { email: 'transport@demo.dz' },
      update: {
        password: transporterPassword,
        name: 'Karim Transport',
        role: 'TRANSPORTER',
        phone: '+213555222222',
        siret: '12345678901234',
        isActive: true,
      },
      create: {
        email: 'transport@demo.dz',
        password: transporterPassword,
        name: 'Karim Transport',
        role: 'TRANSPORTER',
        phone: '+213555222222',
        siret: '12345678901234',
        isActive: true,
      },
    });
    console.log('Transporter created');

    const relaisAlgerUser = await db.user.upsert({
      where: { email: 'relais-alger@demo.dz' },
      update: { password: relaisPassword, name: 'Relais Alger Centre', role: 'RELAIS', phone: '+213555333333', isActive: true },
      create: {
        email: 'relais-alger@demo.dz',
        password: relaisPassword,
        name: 'Relais Alger Centre',
        role: 'RELAIS',
        phone: '+213555333333',
        isActive: true,
      },
      select: { id: true },
    });
    // Keep legacy email working too
    await db.user.upsert({
      where: { email: 'relais@demo.dz' },
      update: { password: relaisPassword, name: 'Relais Alger Centre', role: 'RELAIS', phone: '+213555333333', isActive: true },
      create: {
        email: 'relais@demo.dz',
        password: relaisPassword,
        name: 'Relais Alger Centre',
        role: 'RELAIS',
        phone: '+213555333333',
        isActive: true,
      },
    });
    console.log('Relais Alger user created');

    await db.relais.upsert({
      where: { userId: relaisAlgerUser.id },
      update: {
        commerceName: 'Épicerie du Centre Alger',
        address: '123 Rue Didouche Mourad, Alger Centre',
        ville: 'alger',
        status: 'APPROVED',
        operationalStatus: 'ACTIF',
        suspensionReason: null,
        suspendedAt: null,
        commissionPetit: 100,
        commissionMoyen: 200,
        commissionGros: 300,
      },
      create: {
        userId: relaisAlgerUser.id,
        commerceName: 'Épicerie du Centre Alger',
        address: '123 Rue Didouche Mourad, Alger Centre',
        ville: 'alger',
        status: 'APPROVED',
        operationalStatus: 'ACTIF',
        commissionPetit: 100,
        commissionMoyen: 200,
        commissionGros: 300,
      },
    });
    console.log('Relais Alger created (APPROVED)');

    // Relais Oran — géré par Ahmed Benali
    const relaisOranUser = await db.user.upsert({
      where: { email: 'relais-oran@demo.dz' },
      update: { password: relaisPassword, name: 'Ahmed Benali', role: 'RELAIS', phone: '+213555444444', isActive: true },
      create: {
        email: 'relais-oran@demo.dz',
        password: relaisPassword,
        name: 'Ahmed Benali',
        role: 'RELAIS',
        phone: '+213555444444',
        isActive: true,
      },
      select: { id: true },
    });
    console.log('Relais Oran user created');

    await db.relais.upsert({
      where: { userId: relaisOranUser.id },
      update: {
        commerceName: 'Point Relais Oran Benali',
        address: '45 Boulevard Millénium, Oran',
        ville: 'oran',
        status: 'APPROVED',
        operationalStatus: 'ACTIF',
        suspensionReason: null,
        suspendedAt: null,
        commissionPetit: 100,
        commissionMoyen: 200,
        commissionGros: 300,
      },
      create: {
        userId: relaisOranUser.id,
        commerceName: 'Point Relais Oran Benali',
        address: '45 Boulevard Millénium, Oran',
        ville: 'oran',
        status: 'APPROVED',
        operationalStatus: 'ACTIF',
        commissionPetit: 100,
        commissionMoyen: 200,
        commissionGros: 300,
      },
    });
    console.log('Relais Oran created (APPROVED)');

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
      const existingLine = await db.ligne.findFirst({
        where: {
          villeDepart: line.depart,
          villeArrivee: line.arrivee,
        },
        select: { id: true },
      });

      if (existingLine) {
        await db.ligne.update({
          where: { id: existingLine.id },
          data: {
            tarifPetit: line.petit,
            tarifMoyen: line.moyen,
            tarifGros: line.gros,
            isActive: true,
          },
        });
      } else {
        await db.ligne.create({
          data: {
            villeDepart: line.depart,
            villeArrivee: line.arrivee,
            tarifPetit: line.petit,
            tarifMoyen: line.moyen,
            tarifGros: line.gros,
            isActive: true,
          },
        });
      }
    }
    console.log('Lines created');

    console.log('Database seed completed successfully!');

    return NextResponse.json({
      success: true,
      message: 'Database seeded successfully',
      credentials: {
        admin:         { email: 'admin@swiftcolis.dz',  password: 'admin123',     role: 'ADMIN' },
        client:        { email: 'client@demo.dz',       password: 'client123',    role: 'CLIENT',    name: 'Ahmed Benali (Alger — expéditeur)' },
        transporter:   { email: 'transport@demo.dz',    password: 'transport123', role: 'TRANSPORTER' },
        relaisAlger:   { email: 'relais-alger@demo.dz', password: 'relais123',    role: 'RELAIS',    ville: 'alger',  commerceName: 'Épicerie du Centre Alger', status: 'APPROVED' },
        relaisOran:    { email: 'relais-oran@demo.dz',  password: 'relais123',    role: 'RELAIS',    ville: 'oran',   commerceName: 'Point Relais Oran Benali', status: 'APPROVED' },
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
