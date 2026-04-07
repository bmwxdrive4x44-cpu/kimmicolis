import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const ALLOWED_STATUSES = ['READY', 'BROKEN', 'OUT_OF_PAPER', 'NOT_EQUIPPED'] as const;
type PrinterStatus = typeof ALLOWED_STATUSES[number];

function normalizeStatus(value: unknown): PrinterStatus {
  const normalized = String(value || '').toUpperCase();
  return (ALLOWED_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as PrinterStatus)
    : 'READY';
}

// GET /api/relais/printers
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'RELAIS', 'CLIENT']);
  if (!auth.success) return auth.response;

  try {
    if (auth.payload.role === 'RELAIS') {
      const relay = await db.relais.findUnique({
        where: { userId: auth.payload.id },
        select: {
          id: true,
          commerceName: true,
          ville: true,
          operationalStatus: true,
        },
      });

      if (!relay) {
        return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
      }

      const printerSetting = await db.setting.findUnique({
        where: { key: `relayPrinterStatus:${relay.id}` },
        select: { value: true },
      });

      return NextResponse.json({
        printers: [
          {
            relaisId: relay.id,
            commerceName: relay.commerceName,
            ville: relay.ville,
            operationalStatus: relay.operationalStatus,
            printerStatus: normalizeStatus(printerSetting?.value),
          },
        ],
        allowedStatuses: ALLOWED_STATUSES,
      });
    }

    const relais = await db.relais.findMany({
      where: { status: 'APPROVED' },
      select: {
        id: true,
        commerceName: true,
        ville: true,
        status: true,
        operationalStatus: true,
      },
      orderBy: [{ ville: 'asc' }, { commerceName: 'asc' }],
    });

    const keys = relais.map((r) => `relayPrinterStatus:${r.id}`);
    const settings = await db.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const byRelais = new Map<string, string>();
    settings.forEach((s) => {
      const id = s.key.split(':')[1];
      if (id) byRelais.set(id, s.value);
    });

    return NextResponse.json({
      printers: relais.map((r) => ({
        relaisId: r.id,
        commerceName: r.commerceName,
        ville: r.ville,
        operationalStatus: r.operationalStatus,
        printerStatus: normalizeStatus(byRelais.get(r.id)),
      })),
      allowedStatuses: ALLOWED_STATUSES,
    });
  } catch (error) {
    console.error('Error fetching relay printer statuses:', error);
    return NextResponse.json({ error: 'Failed to fetch relay printer statuses' }, { status: 500 });
  }
}

// PUT /api/relais/printers
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['RELAIS']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const requestedStatus = body?.printerStatus;
    if (!requestedStatus) {
      return NextResponse.json({ error: 'printerStatus requis' }, { status: 400 });
    }

    const relay = await db.relais.findUnique({
      where: { userId: auth.payload.id },
      select: { id: true },
    });

    if (!relay) {
      return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
    }

    const normalized = normalizeStatus(requestedStatus);
    const key = `relayPrinterStatus:${relay.id}`;

    const previous = await db.setting.findUnique({
      where: { key },
      select: { value: true },
    });
    const before = normalizeStatus(previous?.value);

    await db.setting.upsert({
      where: { key },
      update: { value: normalized },
      create: { key, value: normalized },
    });

    if (before !== normalized) {
      await db.actionLog.create({
        data: {
          userId: auth.payload.id,
          entityType: 'RELAIS',
          entityId: relay.id,
          action: 'PRINTER_STATUS_CHANGE',
          details: JSON.stringify({
            before,
            after: normalized,
            source: 'relay_self_service',
          }),
        },
      });
    }

    return NextResponse.json({
      success: true,
      printerStatus: normalized,
      allowedStatuses: ALLOWED_STATUSES,
    });
  } catch (error) {
    console.error('Error saving relay printer status:', error);
    return NextResponse.json({ error: 'Failed to save relay printer status' }, { status: 500 });
  }
}
