import { db } from '@/lib/db';
import type { DomainEventRecord } from '@/lib/events/types';

async function ensureTransporterKpiRow(transporteurId: string) {
  await db.$executeRawUnsafe(
    'INSERT INTO "KpiTransporter" ("transporteurId") VALUES ($1) ON CONFLICT ("transporteurId") DO NOTHING',
    transporteurId,
  );
}

async function ensureEnseigneKpiRow(enseigneId: string) {
  await db.$executeRawUnsafe(
    'INSERT INTO "KpiEnseigne" ("enseigneId") VALUES ($1) ON CONFLICT ("enseigneId") DO NOTHING',
    enseigneId,
  );
}

async function ensureRelaisKpiRow(relaisId: string) {
  await db.$executeRawUnsafe(
    'INSERT INTO "KpiRelais" ("relaisId") VALUES ($1) ON CONFLICT ("relaisId") DO NOTHING',
    relaisId,
  );
}

async function bumpUpdatedAt(table: 'KpiTransporter' | 'KpiEnseigne' | 'KpiRelais', idField: string, id: string) {
  await db.$executeRawUnsafe(
    `UPDATE "${table}" SET "updatedAt" = NOW() WHERE "${idField}" = $1`,
    id,
  );
}

export async function projectDomainEvent(event: DomainEventRecord): Promise<void> {
  const p = event.payload ?? {};

  if (event.type === 'PARCEL_CREATED') {
    const enseigneId = String(p.clientId || '').trim();
    if (!enseigneId) return;

    await ensureEnseigneKpiRow(enseigneId);
    await db.$executeRawUnsafe(
      'UPDATE "KpiEnseigne" SET "parcelsTotal" = "parcelsTotal" + 1, "pendingPayment" = "pendingPayment" + 1, "updatedAt" = NOW() WHERE "enseigneId" = $1',
      enseigneId,
    );
    return;
  }

  if (event.type === 'MISSION_ASSIGNED') {
    const transporteurId = String(p.transporteurId || '').trim();
    if (!transporteurId) return;
    await ensureTransporterKpiRow(transporteurId);
    await db.$executeRawUnsafe(
      'UPDATE "KpiTransporter" SET "missionsTotal" = "missionsTotal" + 1, "missionsActive" = "missionsActive" + 1, "missionsAssigned" = "missionsAssigned" + 1, "updatedAt" = NOW() WHERE "transporteurId" = $1',
      transporteurId,
    );
    return;
  }

  if (event.type === 'MISSION_ACCEPTED') {
    const transporteurId = String(p.transporteurId || '').trim();
    if (!transporteurId) return;
    await ensureTransporterKpiRow(transporteurId);
    await db.$executeRawUnsafe(
      'UPDATE "KpiTransporter" SET "missionsAssigned" = GREATEST("missionsAssigned" - 1, 0), "missionsInProgress" = "missionsInProgress" + 1, "updatedAt" = NOW() WHERE "transporteurId" = $1',
      transporteurId,
    );
    return;
  }

  if (event.type === 'MISSION_COMPLETED') {
    const transporteurId = String(p.transporteurId || '').trim();
    if (!transporteurId) return;
    await ensureTransporterKpiRow(transporteurId);
    await db.$executeRawUnsafe(
      'UPDATE "KpiTransporter" SET "missionsActive" = GREATEST("missionsActive" - 1, 0), "missionsInProgress" = GREATEST("missionsInProgress" - 1, 0), "missionsCompleted" = "missionsCompleted" + 1, "updatedAt" = NOW() WHERE "transporteurId" = $1',
      transporteurId,
    );
    return;
  }

  if (event.type === 'REVENUE_EARNED') {
    const transporteurId = String(p.transporteurId || '').trim();
    const enseigneId = String(p.enseigneId || '').trim();
    const amount = Number(p.amount || 0);

    if (transporteurId) {
      await ensureTransporterKpiRow(transporteurId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiTransporter" SET "earningsTotal" = "earningsTotal" + $2, "updatedAt" = NOW() WHERE "transporteurId" = $1',
        transporteurId,
        amount,
      );
    }

    if (enseigneId) {
      await ensureEnseigneKpiRow(enseigneId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiEnseigne" SET "revenueDelivered" = "revenueDelivered" + $2, "updatedAt" = NOW() WHERE "enseigneId" = $1',
        enseigneId,
        Number(p.clientAmount || 0),
      );
    }

    return;
  }

  if (event.type === 'PARCEL_DEPOSITED') {
    const enseigneId = String(p.clientId || '').trim();
    const relaisDepartId = String(p.relaisDepartId || '').trim();

    if (enseigneId) {
      await ensureEnseigneKpiRow(enseigneId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiEnseigne" SET "readyForDeposit" = GREATEST("readyForDeposit" - 1, 0), "inTransit" = "inTransit" + 1, "updatedAt" = NOW() WHERE "enseigneId" = $1',
        enseigneId,
      );
    }

    if (relaisDepartId) {
      await ensureRelaisKpiRow(relaisDepartId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiRelais" SET "stockDeparture" = "stockDeparture" + 1, "pendingActions" = "pendingActions" + 1, "updatedAt" = NOW() WHERE "relaisId" = $1',
        relaisDepartId,
      );
    }

    return;
  }

  if (event.type === 'PARCEL_PICKED_UP' || event.type === 'PARCEL_IN_TRANSIT') {
    const enseigneId = String(p.clientId || '').trim();
    if (enseigneId) {
      await ensureEnseigneKpiRow(enseigneId);
      await bumpUpdatedAt('KpiEnseigne', 'enseigneId', enseigneId);
    }
    return;
  }

  if (event.type === 'PARCEL_ARRIVED_RELAY') {
    const enseigneId = String(p.clientId || '').trim();
    const relaisArriveeId = String(p.relaisArriveeId || '').trim();

    if (enseigneId) {
      await ensureEnseigneKpiRow(enseigneId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiEnseigne" SET "inTransit" = GREATEST("inTransit" - 1, 0), "arrivedRelay" = "arrivedRelay" + 1, "updatedAt" = NOW() WHERE "enseigneId" = $1',
        enseigneId,
      );
    }

    if (relaisArriveeId) {
      await ensureRelaisKpiRow(relaisArriveeId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiRelais" SET "stockArrival" = "stockArrival" + 1, "pendingActions" = "pendingActions" + 1, "updatedAt" = NOW() WHERE "relaisId" = $1',
        relaisArriveeId,
      );
    }

    return;
  }

  if (event.type === 'PARCEL_DELIVERED') {
    const enseigneId = String(p.clientId || '').trim();
    const relaisArriveeId = String(p.relaisArriveeId || '').trim();

    if (enseigneId) {
      await ensureEnseigneKpiRow(enseigneId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiEnseigne" SET "parcelsDelivered" = "parcelsDelivered" + 1, "arrivedRelay" = GREATEST("arrivedRelay" - 1, 0), "updatedAt" = NOW() WHERE "enseigneId" = $1',
        enseigneId,
      );
    }

    if (relaisArriveeId) {
      await ensureRelaisKpiRow(relaisArriveeId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiRelais" SET "stockArrival" = GREATEST("stockArrival" - 1, 0), "pendingActions" = GREATEST("pendingActions" - 1, 0), "handoversCompleted" = "handoversCompleted" + 1, "updatedAt" = NOW() WHERE "relaisId" = $1',
        relaisArriveeId,
      );
    }

    return;
  }

  if (event.type === 'CASH_COLLECTED') {
    const relaisId = String(p.relaisId || '').trim();
    if (relaisId) {
      await ensureRelaisKpiRow(relaisId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiRelais" SET "cashOnHand" = "cashOnHand" + $2, "updatedAt" = NOW() WHERE "relaisId" = $1',
        relaisId,
        Number(p.amount || 0),
      );
    }

    const enseigneId = String(p.clientId || '').trim();
    if (enseigneId) {
      await ensureEnseigneKpiRow(enseigneId);
      await db.$executeRawUnsafe(
        'UPDATE "KpiEnseigne" SET "pendingPayment" = GREATEST("pendingPayment" - 1, 0), "readyForDeposit" = "readyForDeposit" + 1, "revenueCommitted" = "revenueCommitted" + $2, "updatedAt" = NOW() WHERE "enseigneId" = $1',
        enseigneId,
        Number(p.amount || 0),
      );
    }

    return;
  }

  if (event.type === 'COMMISSION_ALLOCATED') {
    const relaisId = String(p.relaisId || '').trim();
    if (!relaisId) return;
    await ensureRelaisKpiRow(relaisId);
    await db.$executeRawUnsafe(
      'UPDATE "KpiRelais" SET "commissionsTotal" = "commissionsTotal" + $2, "updatedAt" = NOW() WHERE "relaisId" = $1',
      relaisId,
      Number(p.amount || 0),
    );
    return;
  }

  if (event.type === 'RELAY_STOCK_INCREASED' || event.type === 'RELAY_STOCK_DECREASED') {
    const relaisId = String(p.relaisId || '').trim();
    if (!relaisId) return;
    await ensureRelaisKpiRow(relaisId);
    await bumpUpdatedAt('KpiRelais', 'relaisId', relaisId);
  }
}
