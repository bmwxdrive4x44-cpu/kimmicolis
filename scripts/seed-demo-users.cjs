const { PrismaClient } = require('../src/generated/prisma');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

function parseArgs(argv) {
  const args = new Set(argv.slice(2));
  return {
    yes: args.has('--yes'),
    allowRemote: args.has('--allow-remote'),
  };
}

function isLocalDatabaseUrl(url) {
  if (!url) return false;
  return /localhost|127\.0\.0\.1/i.test(url);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function upsertUser(data) {
  const hashedPassword = await hashPassword(data.password);
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      name: data.name,
      role: data.role,
      phone: data.phone || null,
      siret: data.siret || null,
      isActive: data.isActive !== false,
      password: hashedPassword,
    },
    create: {
      email: data.email,
      name: data.name,
      role: data.role,
      phone: data.phone || null,
      siret: data.siret || null,
      isActive: data.isActive !== false,
      password: hashedPassword,
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
    },
  });
}

async function main() {
  const { yes, allowRemote } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL || '';

  if (!yes) {
    console.error('Refusing to run without --yes');
    process.exit(1);
  }

  if (!allowRemote && !isLocalDatabaseUrl(databaseUrl)) {
    console.error('Refusing to run on a non-local DATABASE_URL without --allow-remote');
    process.exit(1);
  }

  const admin = await upsertUser({
    email: 'admin@swiftcolis.dz',
    password: 'admin123',
    name: 'Admin SwiftColis',
    role: 'ADMIN',
    phone: '+213555000000',
  });

  const client = await upsertUser({
    email: 'client@demo.dz',
    password: 'client123',
    name: 'Ahmed Benali',
    role: 'CLIENT',
    phone: '+213555111111',
  });

  const transporter = await upsertUser({
    email: 'transport@demo.dz',
    password: 'transport123',
    name: 'Karim Transport',
    role: 'TRANSPORTER',
    phone: '+213555222222',
    siret: '12345678901234',
  });

  await prisma.transporterApplication.upsert({
    where: { userId: transporter.id },
    update: {
      fullName: 'Karim Transport',
      phone: '+213555222222',
      vehicle: 'Kangoo',
      license: 'TR-001-2026',
      experience: 4,
      regions: JSON.stringify(['alger', 'oran']),
      description: 'Transporteur seed E2E',
      documents: JSON.stringify([
        {
          url: '/upload/demo-license.pdf',
          filename: 'license.pdf',
          size: 1024,
        },
      ]),
      status: 'APPROVED',
    },
    create: {
      userId: transporter.id,
      fullName: 'Karim Transport',
      phone: '+213555222222',
      vehicle: 'Kangoo',
      license: 'TR-001-2026',
      experience: 4,
      regions: JSON.stringify(['alger', 'oran']),
      description: 'Transporteur seed E2E',
      documents: JSON.stringify([
        {
          url: '/upload/demo-license.pdf',
          filename: 'license.pdf',
          size: 1024,
        },
      ]),
      status: 'APPROVED',
    },
  });

  const transporterAlias = await upsertUser({
    email: 'transporter@swiftcolis.dz',
    password: 'transport123',
    name: 'Karim Transport Alias',
    role: 'TRANSPORTER',
    phone: '+213555222223',
    siret: '12345678901235',
  });

  const enseigne = await upsertUser({
    email: 'enseigne@demo.dz',
    password: 'enseigne123',
    name: 'Enseigne Demo',
    role: 'ENSEIGNE',
    phone: '+213555777777',
  });

  const relayUser = await upsertUser({
    email: 'relais@demo.dz',
    password: 'relais123',
    name: 'Relais Centre',
    role: 'RELAIS',
    phone: '+213555333333',
  });

  await prisma.relais.upsert({
    where: { userId: relayUser.id },
    update: {
      commerceName: 'Epicerie du Centre',
      address: '123 Rue Didouche Mourad',
      ville: 'alger',
      status: 'APPROVED',
      operationalStatus: 'ACTIF',
      commissionPetit: 100,
      commissionMoyen: 200,
      commissionGros: 300,
    },
    create: {
      userId: relayUser.id,
      commerceName: 'Epicerie du Centre',
      address: '123 Rue Didouche Mourad',
      ville: 'alger',
      status: 'APPROVED',
      operationalStatus: 'ACTIF',
      commissionPetit: 100,
      commissionMoyen: 200,
      commissionGros: 300,
    },
  });

  await prisma.enseigne.upsert({
    where: { userId: enseigne.id },
    update: {
      businessName: 'Enseigne Demo Shop',
      legalName: 'Enseigne Demo SARL',
      billingEmail: 'billing-enseigne@demo.dz',
      operationalCity: 'alger',
      monthlyVolume: 50,
    },
    create: {
      userId: enseigne.id,
      businessName: 'Enseigne Demo Shop',
      legalName: 'Enseigne Demo SARL',
      billingEmail: 'billing-enseigne@demo.dz',
      operationalCity: 'alger',
      monthlyVolume: 50,
    },
  });

  console.log('Seed complete.');
  console.log('Users ready:');
  for (const user of [admin, client, transporter, transporterAlias, relayUser, enseigne]) {
    console.log(`- ${user.email} (${user.role})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
