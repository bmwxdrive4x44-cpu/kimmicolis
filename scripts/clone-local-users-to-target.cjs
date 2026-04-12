const { PrismaClient } = require('../src/generated/prisma');

function parseArgs(argv) {
  const rawArgs = argv.slice(2);
  const args = new Set(rawArgs);
  const emailsArg = rawArgs.find((arg) => arg.startsWith('--emails='));
  const parsedEmails = emailsArg
    ? emailsArg
        .replace('--emails=', '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    : [];

  return {
    yes: args.has('--yes'),
    wipeTarget: args.has('--wipe-target'),
    allowRemoteTarget: args.has('--allow-remote-target'),
    dryRun: args.has('--dry-run'),
    // Safe default: demo accounts are excluded unless explicitly requested.
    excludeDemo: !args.has('--include-demo'),
    emails: parsedEmails,
  };
}

function isLocalDatabaseUrl(url) {
  if (!url) return false;
  return /localhost|127\.0\.0\.1/i.test(url);
}

function normalizeUrlFingerprint(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port}:${u.pathname}`.toLowerCase();
  } catch {
    return String(url || '').trim().toLowerCase();
  }
}

function createClient(url) {
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}

async function wipeTargetDatabase(target) {
  await target.$transaction(async (tx) => {
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
    await tx.deliveryProof.deleteMany();

    await tx.qrSecurityLog.deleteMany();
    await tx.transporterPenalty.deleteMany();
    await tx.transporterScore.deleteMany();

    await tx.colis.deleteMany();
    await tx.trajet.deleteMany();
    await tx.ligne.deleteMany();
    await tx.transporterWallet.deleteMany();

    await tx.transporterPreferences.deleteMany();
    await tx.transporterApplication.deleteMany();
    await tx.enseigne.deleteMany();
    await tx.relais.deleteMany();
    await tx.user.deleteMany();
    await tx.setting.deleteMany();
  });
}

async function main() {
  const { yes, wipeTarget, allowRemoteTarget, dryRun, excludeDemo, emails } = parseArgs(process.argv);
  const sourceUrl = process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL || '';
  const targetUrl = process.env.TARGET_DATABASE_URL || '';

  if (!sourceUrl) {
    console.error('SOURCE_DATABASE_URL is required.');
    process.exit(1);
  }

  if (!targetUrl) {
    console.error('TARGET_DATABASE_URL is required.');
    process.exit(1);
  }

  const sourceFinger = normalizeUrlFingerprint(sourceUrl);
  const targetFinger = normalizeUrlFingerprint(targetUrl);

  if (sourceFinger === targetFinger) {
    console.error('Refusing to run: SOURCE_DATABASE_URL and TARGET_DATABASE_URL point to the same database.');
    process.exit(1);
  }

  if (!yes) {
    console.error('Refusing to run without --yes');
    process.exit(1);
  }

  if (!allowRemoteTarget && !isLocalDatabaseUrl(targetUrl)) {
    console.error('Refusing to write to a non-local TARGET_DATABASE_URL without --allow-remote-target');
    process.exit(1);
  }

  const source = createClient(sourceUrl);
  const target = createClient(targetUrl);

  try {
    const allSourceUsers = await source.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        password: true,
        name: true,
        firstName: true,
        lastName: true,
        address: true,
        role: true,
        phone: true,
        siret: true,
        image: true,
        isActive: true,
        clientType: true,
        eligibleProImplicit: true,
        eligibleProSince: true,
        proLastEvaluatedAt: true,
        weeklyValidShipments: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const sourceUsers = allSourceUsers.filter((user) => {
      const normalizedEmail = String(user.email || '').toLowerCase();
      if (excludeDemo && (normalizedEmail.includes('@demo.dz') || normalizedEmail.startsWith('demo+'))) return false;
      if (emails.length > 0) return emails.includes(normalizedEmail);
      return true;
    });

    const sourceUserIds = sourceUsers.map((u) => u.id);

    const sourceRelais = await source.relais.findMany({
      where: { userId: { in: sourceUserIds } },
      select: {
        id: true,
        userId: true,
        commerceName: true,
        address: true,
        ville: true,
        openTime: true,
        closeTime: true,
        latitude: true,
        longitude: true,
        photos: true,
        commerceDocuments: true,
        commissionPetit: true,
        commissionMoyen: true,
        commissionGros: true,
        status: true,
        operationalStatus: true,
        suspensionReason: true,
        suspendedAt: true,
        cashCollected: true,
        cashReversed: true,
        cautionAmount: true,
        cautionStatus: true,
        cautionPaidAt: true,
        activationDate: true,
        firstActivityDate: true,
        complianceScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const sourceApplications = await source.transporterApplication.findMany({
      where: { userId: { in: sourceUserIds } },
      select: {
        id: true,
        userId: true,
        fullName: true,
        phone: true,
        vehicle: true,
        license: true,
        experience: true,
        regions: true,
        description: true,
        documents: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const sourceEnseignes = await source.enseigne.findMany({
      where: { userId: { in: sourceUserIds } },
      select: {
        id: true,
        userId: true,
        businessName: true,
        legalName: true,
        website: true,
        logoUrl: true,
        monthlyVolume: true,
        billingEmail: true,
        operationalCity: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`Source users selected: ${sourceUsers.length}`);
    console.log(`Source relais: ${sourceRelais.length}`);
    console.log(`Source transporter applications: ${sourceApplications.length}`);
    console.log(`Source enseignes: ${sourceEnseignes.length}`);

    if (dryRun) {
      console.log('Dry run only. No changes applied to target database.');
      return;
    }

    if (wipeTarget) {
      console.log('Wiping target database...');
      await wipeTargetDatabase(target);
      console.log('Target database wiped.');
    }

    console.log('Inserting users into target...');
    for (const user of sourceUsers) {
      await target.user.create({ data: user });
    }

    if (sourceRelais.length > 0) {
      console.log('Inserting relais into target...');
      for (const relais of sourceRelais) {
        await target.relais.create({ data: relais });
      }
    }

    if (sourceApplications.length > 0) {
      console.log('Inserting transporter applications into target...');
      for (const app of sourceApplications) {
        await target.transporterApplication.create({ data: app });
      }
    }

    if (sourceEnseignes.length > 0) {
      console.log('Inserting enseignes into target...');
      for (const enseigne of sourceEnseignes) {
        await target.enseigne.create({ data: enseigne });
      }
    }

    const targetCount = await target.user.count();
    const byRole = await target.user.groupBy({ by: ['role'], _count: { _all: true } });

    console.log('Transfer complete.');
    console.log(`Target users: ${targetCount}`);
    console.log(JSON.stringify(byRole, null, 2));
  } finally {
    await source.$disconnect();
    await target.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
