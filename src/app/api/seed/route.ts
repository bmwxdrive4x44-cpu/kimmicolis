import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function GET() {
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

    const relaisUser = await db.user.upsert({
      where: { email: 'relais@demo.dz' },
      update: { password: relaisPassword, name: 'Relais Centre', role: 'RELAIS', phone: '+213555333333', isActive: true },
      create: {
        email: 'relais@demo.dz',
        password: relaisPassword,
        name: 'Relais Centre',
        role: 'RELAIS',
        phone: '+213555333333',
        isActive: true,
      },
      select: { id: true },
    });
    console.log('Relais user created');

    await db.relais.upsert({
      where: { userId: relaisUser.id },
      update: {
        commerceName: 'Épicerie du Centre',
        address: '123 Rue Didouche Mourad',
        ville: 'alger',
        status: 'PENDING',
        operationalStatus: 'ACTIF',
        suspensionReason: null,
        suspendedAt: null,
        commissionPetit: 100,
        commissionMoyen: 200,
        commissionGros: 300,
      },
      create: {
        userId: relaisUser.id,
        commerceName: 'Épicerie du Centre',
        address: '123 Rue Didouche Mourad',
        ville: 'alger',
        status: 'PENDING',
        operationalStatus: 'ACTIF',
        commissionPetit: 100,
        commissionMoyen: 200,
        commissionGros: 300,
      },
    });
    console.log('Relais created with PENDING status - admin must validate');

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
