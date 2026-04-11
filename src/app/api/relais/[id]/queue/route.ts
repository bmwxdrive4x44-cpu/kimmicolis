import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const DEPARTURE_ACTIONABLE_STATUSES = ['CREATED', 'READY_FOR_DEPOSIT', 'PAID_RELAY'] as const;
const ARRIVAL_ACTIONABLE_STATUSES = ['ARRIVE_RELAIS_DESTINATION'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;

    if (auth.payload.role === 'RELAIS') {
      const ownedRelais = await db.relais.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!ownedRelais) {
        return NextResponse.json({ error: 'Relais introuvable' }, { status: 404 });
      }

      if (ownedRelais.userId !== auth.payload.id) {
        return NextResponse.json({ error: 'Accès interdit' }, { status: 403 });
      }
    }

    const parcels = await db.colis.findMany({
      where: {
        OR: [
          { relaisDepartId: id, status: { in: [...DEPARTURE_ACTIONABLE_STATUSES] } },
          { relaisArriveeId: id, status: { in: [...ARRIVAL_ACTIONABLE_STATUSES] } },
        ],
      },
      select: {
        id: true,
        trackingNumber: true,
        status: true,
        villeDepart: true,
        villeArrivee: true,
        prixClient: true,
        commissionRelais: true,
        createdAt: true,
        dateLimit: true,
        senderFirstName: true,
        senderLastName: true,
        senderPhone: true,
        recipientFirstName: true,
        recipientLastName: true,
        recipientPhone: true,
        relaisDepartId: true,
        relaisArriveeId: true,
        client: {
          select: {
            role: true,
          },
        },
      },
      orderBy: [
        { dateLimit: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 100,
    });

    const items = parcels.map((parcel) => {
      const isDepartureTask = parcel.relaisDepartId === id;
      const taskType = isDepartureTask ? 'DEPARTURE' : 'ARRIVAL';

      return {
        ...parcel,
        taskType,
        priority: parcel.dateLimit && parcel.dateLimit < new Date() ? 'HIGH' : 'NORMAL',
        sourceType: parcel.client?.role === 'ENSEIGNE' ? 'ENSEIGNE' : 'CLIENT',
      };
    });

    return NextResponse.json({
      relaisId: id,
      counts: {
        total: items.length,
        departure: items.filter((item) => item.taskType === 'DEPARTURE').length,
        arrival: items.filter((item) => item.taskType === 'ARRIVAL').length,
      },
      items,
    });
  } catch (error) {
    console.error('Error fetching relay queue:', error);
    return NextResponse.json({ error: 'Impossible de charger les colis à traiter' }, { status: 500 });
  }
}