import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

type ImportRowInput = {
  senderFirstName: string;
  senderLastName: string;
  senderPhone: string;
  recipientFirstName: string;
  recipientLastName: string;
  recipientPhone: string;
  weight: number;
  description?: string;
};

type ImportRowResult = {
  line: number;
  success: boolean;
  error?: string;
  trackingNumber?: string;
  status?: string;
  matching?: 'ASSIGNED' | 'PENDING' | 'FAILED';
  matchingMessage?: string;
  row?: ImportRowInput;
};

type ImportHistoryItem = {
  id: string;
  createdAt: string;
  villeDepart: string;
  villeArrivee: string;
  total: number;
  successCount: number;
  failureCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
};

const HISTORY_LIMIT = 30;
const MATCHING_ELIGIBLE_STATUSES = new Set(['READY_FOR_DEPOSIT', 'PAID', 'DEPOSITED_RELAY', 'RECU_RELAIS']);

function historyKey(userId: string) {
  return `enseigne:imports:${userId}`;
}

async function readHistory(userId: string): Promise<ImportHistoryItem[]> {
  const setting = await db.setting.findUnique({ where: { key: historyKey(userId) } });
  if (!setting?.value) return [];
  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeHistory(userId: string, value: ImportHistoryItem[]) {
  await db.setting.upsert({
    where: { key: historyKey(userId) },
    update: { value: JSON.stringify(value.slice(0, HISTORY_LIMIT)) },
    create: { key: historyKey(userId), value: JSON.stringify(value.slice(0, HISTORY_LIMIT)) },
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { searchParams } = new URL(request.url);
  const requestedUserId = searchParams.get('userId');
  const userId = auth.payload.role === 'ADMIN' && requestedUserId ? requestedUserId : auth.payload.id;

  const history = await readHistory(userId);
  return NextResponse.json({ history });
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ENSEIGNE', 'ADMIN']);
  if (!auth.success) return auth.response;

  const body = await request.json();
  const {
    clientId,
    villeDepart,
    villeArrivee,
    relaisDepartId,
    relaisArriveeId,
    parcels,
  } = body || {};

  if (!clientId || !villeDepart || !villeArrivee || !relaisDepartId || !relaisArriveeId || !Array.isArray(parcels)) {
    return NextResponse.json({ error: 'Payload import incomplet' }, { status: 400 });
  }

  if ((auth.payload.role === 'ENSEIGNE') && clientId !== auth.payload.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (parcels.length === 0 || parcels.length > 50) {
    return NextResponse.json({ error: 'Le nombre de lignes doit etre entre 1 et 50' }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const cookie = request.headers.get('cookie') || '';

  const results: ImportRowResult[] = [];
  let assignedCount = 0;

  for (let i = 0; i < parcels.length; i++) {
    const row = parcels[i] as ImportRowInput;

    const response = await fetch(`${origin}/api/parcels/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie,
      },
      body: JSON.stringify({
        clientId,
        villeDepart,
        villeArrivee,
        relaisDepartId,
        relaisArriveeId,
        parcels: [row],
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      results.push({
        line: i + 1,
        success: false,
        error: data?.error || 'Erreur inconnue',
        row,
      });
      continue;
    }

    const trackingNumber = data?.parcels?.[0]?.trackingNumber;
    const createdParcel = data?.parcels?.[0];
    const parcelStatus = createdParcel?.status ? String(createdParcel.status) : undefined;

    let matching: ImportRowResult['matching'] = 'PENDING';
    let matchingMessage: string | undefined = 'Paiement en ligne confirme requis avant assignation';

    if (createdParcel?.id && parcelStatus && MATCHING_ELIGIBLE_STATUSES.has(parcelStatus)) {
      const matchingResponse = await fetch(`${origin}/api/matching`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie,
        },
        body: JSON.stringify({
          colisId: createdParcel.id,
          usePreferences: false,
        }),
      });

      const matchingData = await matchingResponse.json().catch(() => null);
      if (matchingResponse.ok) {
        matching = 'ASSIGNED';
        matchingMessage = 'Mission creee et transporteur notifie';
        assignedCount += 1;
      } else {
        matching = 'FAILED';
        matchingMessage = matchingData?.error || 'Aucun trajet disponible actuellement';
      }
    } else if (!parcelStatus) {
      matchingMessage = 'Statut colis inconnu, matching differe';
    }

    results.push({
      line: i + 1,
      success: true,
      trackingNumber,
      status: parcelStatus,
      matching,
      matchingMessage,
      row,
    });
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  const status: ImportHistoryItem['status'] = successCount === results.length
    ? 'SUCCESS'
    : successCount === 0
      ? 'FAILED'
      : 'PARTIAL';

  const historyItem: ImportHistoryItem = {
    id: `${clientId}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    villeDepart,
    villeArrivee,
    total: results.length,
    successCount,
    failureCount,
    status,
  };

  const currentHistory = await readHistory(clientId);
  await writeHistory(clientId, [historyItem, ...currentHistory]);

  return NextResponse.json({
    summary: {
      total: results.length,
      successCount,
      failureCount,
      status,
      assignedCount,
    },
    results,
    historyItem,
  });
}
