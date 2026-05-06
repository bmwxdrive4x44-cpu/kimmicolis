import { PrismaClient } from '../src/generated/prisma/index.js';

const prisma = new PrismaClient();
const KEEP_ADMIN_EMAIL = (process.env.RESET_KEEP_ADMIN_EMAIL || 'admin@swiftcolis.dz').trim().toLowerCase();

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

async function safeStep(label, operation) {
  try {
    await operation();
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = String(error.code || '');
      if (code === 'P2021' || code === 'P2022') {
        console.warn(`Skipping ${label}: missing table or column in current database.`);
        return;
      }
    }
    throw error;
  }
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
      role: 'ADMIN',
      email: KEEP_ADMIN_EMAIL,
    },
    select: { id: true, email: true, role: true },
  });

  if (keepUsers.length !== 1) {
    console.error(`Expected exactly one admin to keep for ${KEEP_ADMIN_EMAIL}, found ${keepUsers.length}`);
    process.exit(1);
  }

  const keepUserIds = keepUsers.map((u) => u.id);

  await safeStep('notification.deleteMany', () => prisma.notification.deleteMany());
  await safeStep('passwordResetToken.deleteMany', () => prisma.passwordResetToken.deleteMany());
  await safeStep('actionLog.deleteMany', () => prisma.actionLog.deleteMany());
  await safeStep('contactMessage.deleteMany', () => prisma.contactMessage.deleteMany());

  await safeStep('relaisCash.deleteMany', () => prisma.relaisCash.deleteMany());
  await safeStep('cashPickup.deleteMany', () => prisma.cashPickup.deleteMany());
  await safeStep('relaisSanction.deleteMany', () => prisma.relaisSanction.deleteMany());
  await safeStep('relaisAudit.deleteMany', () => prisma.relaisAudit.deleteMany());

  await safeStep('dispute.deleteMany', () => prisma.dispute.deleteMany());
  await safeStep('trackingHistory.deleteMany', () => prisma.trackingHistory.deleteMany());
  await safeStep('mission.deleteMany', () => prisma.mission.deleteMany());
  await safeStep('payment.deleteMany', () => prisma.payment.deleteMany());
  await safeStep('deliveryProof.deleteMany', () => prisma.deliveryProof.deleteMany());

  await safeStep('qrSecurityLog.deleteMany', () => prisma.qrSecurityLog.deleteMany());
  await safeStep('transporterPenalty.deleteMany', () => prisma.transporterPenalty.deleteMany());
  await safeStep('transporterScore.deleteMany', () => prisma.transporterScore.deleteMany());

  await safeStep('colis.deleteMany', () => prisma.colis.deleteMany());
  await safeStep('trajet.deleteMany', () => prisma.trajet.deleteMany());
  await safeStep('ligne.deleteMany', () => prisma.ligne.deleteMany());
  await safeStep('transporterWallet.deleteMany', () => prisma.transporterWallet.deleteMany());

  await safeStep('transporterPreferences.deleteMany', () => prisma.transporterPreferences.deleteMany({ where: { userId: { notIn: keepUserIds } } }));
  await safeStep('transporterApplication.deleteMany', () => prisma.transporterApplication.deleteMany({ where: { userId: { notIn: keepUserIds } } }));
  await safeStep('enseigne.deleteMany', () => prisma.enseigne.deleteMany({ where: { userId: { notIn: keepUserIds } } }));
  await safeStep('relais.deleteMany', () => prisma.relais.deleteMany({ where: { userId: { notIn: keepUserIds } } }));

  await safeStep('user.deleteMany', () => prisma.user.deleteMany({
    where: {
      id: { notIn: keepUserIds },
      role: { not: 'ADMIN' },
    },
  }));

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
