const { PrismaClient } = require('../src/generated/prisma');

const db = new PrismaClient();

function uid() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function tracking(prefix) {
  return `SC${prefix}${Date.now().toString(36).toUpperCase()}${uid()}`;
}

async function getOrCreateClient() {
  const existing = await db.user.findFirst({ where: { role: 'CLIENT' }, select: { id: true } });
  if (existing) return existing.id;

  const stamp = Date.now();
  const created = await db.user.create({
    data: {
      email: `client.seed.${stamp}@swiftcolis.test`,
      name: 'Client Seed Test',
      firstName: 'Client',
      lastName: 'Seed',
      role: 'CLIENT',
      phone: '0555000000',
      address: 'Adresse test seed',
    },
    select: { id: true },
  });

  return created.id;
}

async function main() {
  const clientId = await getOrCreateClient();

  const relaisList = await db.relais.findMany({
    select: { id: true, ville: true, commerceName: true },
    take: 20,
  });

  if (!relaisList.length) {
    console.log('Aucun relais trouvé.');
    return;
  }

  const created = [];

  for (const relais of relaisList) {
    const depTracking = tracking('DEP');
    const arrTracking = tracking('ARR');

    const basePayload = {
      clientId,
      lineId: null,
      senderFirstName: 'Nadia',
      senderLastName: 'Test',
      senderPhone: '0555000001',
      recipientFirstName: 'Karim',
      recipientLastName: 'Test',
      recipientPhone: '0555000002',
      relaisDepartId: relais.id,
      relaisArriveeId: relais.id,
      villeDepart: relais.ville,
      villeArrivee: relais.ville,
      weight: 1,
      description: 'SEED_REL_TEST',
      prixClient: 1200,
      commissionPlateforme: 120,
      commissionRelais: 180,
      netTransporteur: 900,
      qrCode: 'seed-qr',
    };

    await db.colis.create({
      data: {
        ...basePayload,
        trackingNumber: depTracking,
        status: 'CREATED',
        qrCode: `seed-qr-${depTracking}`,
      },
    });

    await db.colis.create({
      data: {
        ...basePayload,
        trackingNumber: arrTracking,
        status: 'ARRIVE_RELAIS_DESTINATION',
        qrCode: `seed-qr-${arrTracking}`,
      },
    });

    created.push({ relais: relais.commerceName, departure: depTracking, arrival: arrTracking });
  }

  console.log(JSON.stringify({ createdCount: created.length * 2, sample: created.slice(0, 5) }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
