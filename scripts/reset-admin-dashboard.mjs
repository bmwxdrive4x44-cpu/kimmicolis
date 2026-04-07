import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_EMAILS_TO_KEEP = [
  'admin@swiftcolis.dz',
  'client@demo.dz',
  'transport@demo.dz',
  'relais@demo.dz',
  'enseigne@demo.dz',
];

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

async function main() {
  const { yes, allowRemote } = parseArgs(process.argv);
  const databaseUrl = process.env.DATABASE_URL ?? '';

  if (!yes) {
    console.error('Refusing to run without --yes');
    process.exit(1);
  }

  if (!allowRemote && !isLocalDatabaseUrl(databaseUrl)) {
    console.error('Refusing to run on a non-local DATABASE_URL without --allow-remote');
    process.exit(1);
  }

  const keepUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: DEMO_EMAILS_TO_KEEP } },
        { role: 'ADMIN' },
      ],
    },
    select: { id: true, email: true, role: true },
  });

  const keepUserIds = keepUsers.map((u) => u.id);

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany();
    await tx.passwordResetToken.deleteMany();
    await tx.actionLog.deleteMany();
    await tx.contactMessage.deleteMany();

    await tx.relaisCash.deleteMany();
    await tx.cashPickup.deleteMany();
    await tx.relaisSanction.deleteMany();
    await tx.relaisAudit.deleteMany();

    await tx.dispute.deleteMany();
    await tx.trackingHistory.deleteMany();
    await tx.mission.deleteMany();
    await tx.payment.deleteMany();

    await tx.colis.deleteMany();
    await tx.trajet.deleteMany();
    await tx.ligne.deleteMany();
    await tx.transporterWallet.deleteMany();

    await tx.transporterPreferences.deleteMany({ where: { userId: { notIn: keepUserIds } } });
    await tx.transporterApplication.deleteMany({ where: { userId: { notIn: keepUserIds } } });
    await tx.enseigne.deleteMany({ where: { userId: { notIn: keepUserIds } } });
    await tx.relais.deleteMany({ where: { userId: { notIn: keepUserIds } } });

    await tx.user.deleteMany({
      where: {
        id: { notIn: keepUserIds },
        role: { not: 'ADMIN' },
      },
    });
  });

  const remainingUsers = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    select: { email: true, role: true },
  });

  console.log('Admin dashboard data reset complete.');
  console.log('Kept users:');
  for (const user of remainingUsers) {
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
