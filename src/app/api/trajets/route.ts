import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import { findActiveLineByCities } from '@/lib/logistics';

type TrajetMeta = {
  etapes: string[];
  capacitePoidsKg?: number | null;
  capaciteSurfaceM2?: number | null;
  recurrenceMode?: 'SINGLE' | 'DAILY' | 'WORKDAYS_DZ' | 'CUSTOM_DAYS';
  recurrenceWeekdays?: number[];
  recurrenceBatchId?: string | null;
};

function isAlgeriaWeekend(date: Date): boolean {
  const day = date.getDay();
  // Jeudi(4), Vendredi(5)
  return day === 4 || day === 5;
}

function parseVillesEtapes(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
      if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).etapes)) {
        return (parsed as any).etapes.map((item: unknown) => String(item).trim()).filter(Boolean);
      }
      if (typeof parsed === 'string') {
        return parsed.split(',').map((item) => item.trim()).filter(Boolean);
      }
    } catch {
      // Not JSON, fallback to CSV
    }

    return raw.split(',').map((item) => item.trim()).filter(Boolean);
  }

  return [];
}

function parseTrajetMeta(value: unknown): TrajetMeta {
  const etapes = parseVillesEtapes(value);
  if (!value || typeof value !== 'string') {
    return { etapes };
  }

  const raw = value.trim();
  if (!raw) return { etapes };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { etapes };
    }

    const capacity = (parsed as any).capacity || {};
    const recurrence = (parsed as any).recurrence || {};

    return {
      etapes,
      capacitePoidsKg: Number.isFinite(Number(capacity.poidsMaxKg)) ? Number(capacity.poidsMaxKg) : null,
      capaciteSurfaceM2: Number.isFinite(Number(capacity.surfaceM2)) ? Number(capacity.surfaceM2) : null,
      recurrenceMode: recurrence.mode === 'DAILY'
        ? 'DAILY'
        : recurrence.mode === 'WORKDAYS_DZ'
          ? 'WORKDAYS_DZ'
          : recurrence.mode === 'CUSTOM_DAYS'
            ? 'CUSTOM_DAYS'
          : 'SINGLE',
      recurrenceWeekdays: Array.isArray(recurrence.daysOfWeek)
        ? recurrence.daysOfWeek
            .map((d: unknown) => Number.parseInt(String(d), 10))
            .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
        : [],
      recurrenceBatchId: recurrence.batchId ? String(recurrence.batchId) : null,
    };
  } catch {
    return { etapes };
  }
}

function normalizeTrajet<T extends { villesEtapes?: unknown }>(trajet: T): T & { villesEtapes: string[] } {
  const meta = parseTrajetMeta(trajet.villesEtapes);
  return {
    ...trajet,
    villesEtapes: meta.etapes,
    capacitePoidsKg: meta.capacitePoidsKg ?? null,
    capaciteSurfaceM2: meta.capaciteSurfaceM2 ?? null,
    recurrenceMode: meta.recurrenceMode ?? 'SINGLE',
    recurrenceWeekdays: meta.recurrenceWeekdays ?? [],
    recurrenceBatchId: meta.recurrenceBatchId ?? null,
  };
}

function serializeVillesEtapes(
  value: unknown,
  options?: {
    capacitePoidsKg?: number | null;
    capaciteSurfaceM2?: number | null;
    recurrenceMode?: 'SINGLE' | 'DAILY' | 'WORKDAYS_DZ' | 'CUSTOM_DAYS';
    recurrenceWeekdays?: number[];
    recurrenceBatchId?: string | null;
  }
): string | null {
  const normalized = parseVillesEtapes(value);
  const hasCapacity = typeof options?.capacitePoidsKg === 'number' || typeof options?.capaciteSurfaceM2 === 'number';
  const hasRecurrence = options?.recurrenceMode && options.recurrenceMode !== 'SINGLE';

  if (!hasCapacity && !hasRecurrence) {
    return normalized.length > 0 ? JSON.stringify(normalized) : null;
  }

  const payload: any = {
    etapes: normalized,
    capacity: {
      poidsMaxKg: typeof options?.capacitePoidsKg === 'number' ? options.capacitePoidsKg : null,
      surfaceM2: typeof options?.capaciteSurfaceM2 === 'number' ? options.capaciteSurfaceM2 : null,
    },
    recurrence: {
      mode: options?.recurrenceMode || 'SINGLE',
      daysOfWeek: Array.isArray(options?.recurrenceWeekdays) ? options?.recurrenceWeekdays : [],
      batchId: options?.recurrenceBatchId || null,
    },
  };

  return JSON.stringify(payload);
}

// GET all trajets
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const transporteurId = searchParams.get('transporteurId');
    const status = searchParams.get('status');

    let where: any = {};
    if (transporteurId) where.transporteurId = transporteurId;
    if (status) where.status = status;

    const trajets = await db.trajet.findMany({
      where,
      include: {
        line: true,
        transporteur: { select: { id: true, name: true, phone: true, email: true } },
        missions: {
          include: {
            colis: {
              include: {
                client: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { dateDepart: 'asc' },
    });

    return NextResponse.json(trajets.map(normalizeTrajet));
  } catch (error) {
    console.error('Error fetching trajets:', error);
    return NextResponse.json([]);
  }
}

// POST create trajet
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const {
      transporteurId,
      villeDepart,
      villeArrivee,
      villesEtapes,
      dateDepart,
      placesColis,
      capacitePoidsKg,
      capaciteSurfaceM2,
      recurrenceMode,
      recurrenceDays,
      recurrenceWeekdays,
    } = body;

    const dep = String(villeDepart || '').trim();
    const arr = String(villeArrivee || '').trim();
    const depDate = String(dateDepart || '').trim();
    const places = Number.parseInt(String(placesColis), 10);
    const poidsMax = capacitePoidsKg === null || capacitePoidsKg === undefined || String(capacitePoidsKg).trim() === ''
      ? null
      : Number.parseFloat(String(capacitePoidsKg));
    const surfaceM2 = capaciteSurfaceM2 === null || capaciteSurfaceM2 === undefined || String(capaciteSurfaceM2).trim() === ''
      ? null
      : Number.parseFloat(String(capaciteSurfaceM2));
    const recurrence = recurrenceMode === 'DAILY'
      ? 'DAILY'
      : recurrenceMode === 'WORKDAYS_DZ'
        ? 'WORKDAYS_DZ'
        : recurrenceMode === 'CUSTOM_DAYS'
          ? 'CUSTOM_DAYS'
        : 'SINGLE';
    const recurrenceCount = Number.parseInt(String(recurrenceDays || 1), 10);
    const customDays = Array.isArray(recurrenceWeekdays)
      ? recurrenceWeekdays
          .map((d: unknown) => Number.parseInt(String(d), 10))
          .filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
      : [];

    const missingFields: string[] = [];
    if (!transporteurId) missingFields.push('transporteurId');
    if (!dep) missingFields.push('villeDepart');
    if (!arr) missingFields.push('villeArrivee');
    if (!depDate) missingFields.push('dateDepart');
    if (Number.isNaN(places)) missingFields.push('placesColis');

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Missing required fields',
        code: 'MISSING_REQUIRED_FIELDS',
        fields: missingFields,
      }, { status: 400 });
    }

    if (auth.payload.role === 'TRANSPORTER' && transporteurId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 });
    }

    if (dep === arr) {
      return NextResponse.json({
        error: 'Ville de départ et ville d\'arrivée identiques',
        code: 'INVALID_ROUTE',
        field: 'villeArrivee',
        details: 'La ville d\'arrivée doit être différente de la ville de départ.',
      }, { status: 400 });
    }

    const dateObj = new Date(depDate);
    if (Number.isNaN(dateObj.getTime())) {
      return NextResponse.json({
        error: 'Invalid departure date',
        code: 'INVALID_DEPARTURE_DATE',
        field: 'dateDepart',
      }, { status: 400 });
    }

    if (dateObj.getTime() < Date.now()) {
      return NextResponse.json({
        error: 'Departure date must be in the future',
        code: 'PAST_DEPARTURE_DATE',
        field: 'dateDepart',
      }, { status: 400 });
    }

    if (!Number.isInteger(places) || places < 1 || places > 200) {
      return NextResponse.json({
        error: 'Invalid capacity',
        code: 'INVALID_CAPACITY',
        field: 'placesColis',
        details: 'La capacité doit être un entier entre 1 et 200.',
      }, { status: 400 });
    }

    if (poidsMax !== null && (!Number.isFinite(poidsMax) || poidsMax < 20 || poidsMax > 20000)) {
      return NextResponse.json({
        error: 'Poids max invalide',
        code: 'INVALID_PHYSICAL_CAPACITY',
        field: 'capacitePoidsKg',
        details: 'Le poids max doit être entre 20 et 20000 kg.',
      }, { status: 400 });
    }

    if (surfaceM2 !== null && (!Number.isFinite(surfaceM2) || surfaceM2 < 0.5 || surfaceM2 > 100)) {
      return NextResponse.json({
        error: 'Surface utile invalide',
        code: 'INVALID_PHYSICAL_CAPACITY',
        field: 'capaciteSurfaceM2',
        details: 'La surface utile doit être entre 0.5 et 100 m2.',
      }, { status: 400 });
    }

    if (recurrence !== 'SINGLE' && (!Number.isInteger(recurrenceCount) || recurrenceCount < 2 || recurrenceCount > 30)) {
      return NextResponse.json({
        error: 'Récurrence invalide',
        code: 'INVALID_RECURRENCE',
        field: 'recurrenceDays',
        details: 'La récurrence doit être entre 2 et 30 jours.',
      }, { status: 400 });
    }

    if (recurrence === 'CUSTOM_DAYS' && customDays.length === 0) {
      return NextResponse.json({
        error: 'Sélection des jours invalide',
        code: 'INVALID_RECURRENCE_DAYS',
        field: 'recurrenceWeekdays',
        fields: ['recurrenceWeekdays'],
        details: 'Sélectionnez au moins un jour pour la publication personnalisée.',
      }, { status: 400 });
    }

    const activeLine = await findActiveLineByCities(dep, arr);

    const batchId = recurrence !== 'SINGLE' ? `${transporteurId}-${Date.now()}` : null;
    const totalToCreate = recurrence !== 'SINGLE' ? recurrenceCount : 1;

    const created: any[] = [];
    let cursor = new Date(dateObj);
    while (created.length < totalToCreate) {
      const shouldCreate = recurrence === 'DAILY'
        ? true
        : recurrence === 'WORKDAYS_DZ'
          ? !isAlgeriaWeekend(cursor)
          : recurrence === 'CUSTOM_DAYS'
            ? customDays.includes(cursor.getDay())
            : true;
      if (!shouldCreate) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const nextDate = new Date(cursor);

      const trajet = await db.trajet.create({
        data: {
          transporteurId,
          lineId: activeLine?.id ?? null,
          villeDepart: dep,
          villeArrivee: arr,
          villesEtapes: serializeVillesEtapes(villesEtapes, {
            capacitePoidsKg: poidsMax,
            capaciteSurfaceM2: surfaceM2,
            recurrenceMode: recurrence,
            recurrenceWeekdays: customDays,
            recurrenceBatchId: batchId,
          }),
          dateDepart: nextDate,
          placesColis: places,
          status: 'PROGRAMME',
        },
      });
      created.push(trajet);
      cursor.setDate(cursor.getDate() + 1);
    }

    const normalizedItems = created.map(normalizeTrajet);
    if (normalizedItems.length === 1) {
      return NextResponse.json(normalizedItems[0]);
    }

    return NextResponse.json({
      createdCount: normalizedItems.length,
      items: normalizedItems,
    });
  } catch (error) {
    console.error('Error creating trajet:', error);
    return NextResponse.json({ error: 'Failed to create trajet' }, { status: 500 });
  }
}
