/**
 * Lists demo accounts in prod and checks for email conflicts with local users.
 * Run with --delete to actually delete demo accounts from prod.
 */
const { PrismaClient } = require('../src/generated/prisma');

const LOCAL_EMAILS = [
  'admin@swiftcolis.dz',
  'shopteek@gmail.com',
  'bmwxdrive44@gmail.com',
  'soniatrans44@gmail.com',
  'bmwxdrive4x44@gmail.com',
];

function isDemoEmail(email) {
  const e = String(email || '').toLowerCase();
  return e.includes('@demo.dz') || e.startsWith('demo+');
}

async function main() {
  const doDelete = process.argv.includes('--delete');
  const prodUrl = process.env.TARGET_DATABASE_URL;

  if (!prodUrl) {
    console.error('TARGET_DATABASE_URL is required.');
    process.exit(1);
  }

  const prod = new PrismaClient({ datasources: { db: { url: prodUrl } } });

  try {
    const allUsers = await prod.user.findMany({
      select: { id: true, email: true, role: true, name: true },
      orderBy: { createdAt: 'asc' },
    });

    const demoUsers = allUsers.filter((u) => isDemoEmail(u.email));
    const conflicts = allUsers.filter((u) =>
      LOCAL_EMAILS.includes(String(u.email || '').toLowerCase()) && !isDemoEmail(u.email)
    );

    console.log(`\n=== Total prod users: ${allUsers.length} ===`);
    console.log('\n--- Comptes DEMO à supprimer ---');
    demoUsers.forEach((u) => console.log(`  [${u.role}] ${u.email} (id: ${u.id})`));

    console.log('\n--- Conflits emails (local email déjà en prod) ---');
    if (conflicts.length === 0) {
      console.log('  Aucun conflit.');
    } else {
      conflicts.forEach((u) => console.log(`  [${u.role}] ${u.email} (id: ${u.id}) <-- CONFLIT`));
    }

    if (doDelete) {
      if (demoUsers.length === 0) {
        console.log('\nAucun compte demo à supprimer.');
        return;
      }
      const demoIds = demoUsers.map((u) => u.id);
      console.log(`\nSuppression de ${demoUsers.length} comptes demo...`);

      // Delete in order respecting FK constraints
      await prod.$transaction(async (tx) => {
        await tx.notification.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.passwordResetToken.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.actionLog.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.contactMessage.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.relaisCash.deleteMany({ where: { relais: { userId: { in: demoIds } } } });
        await tx.cashPickup.deleteMany({ where: { relais: { userId: { in: demoIds } } } });
        await tx.relaisSanction.deleteMany({ where: { relais: { userId: { in: demoIds } } } });
        await tx.relaisAudit.deleteMany({ where: { relais: { userId: { in: demoIds } } } });
        await tx.transporterPenalty.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.transporterScore.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.transporterPreferences.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.transporterApplication.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.enseigne.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.relais.deleteMany({ where: { userId: { in: demoIds } } });
        await tx.user.deleteMany({ where: { id: { in: demoIds } } });
      });

      const remaining = await prod.user.count();
      console.log(`Done. Users remaining in prod: ${remaining}`);
    } else {
      console.log('\nPour supprimer les comptes demo, relancer avec --delete');
    }
  } finally {
    await prod.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
