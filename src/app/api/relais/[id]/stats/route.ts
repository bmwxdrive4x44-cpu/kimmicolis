import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRole(request, ['RELAIS', 'ADMIN']);
    if (!auth.success) return auth.response;

    const { id } = await params;

    if (auth.payload.role === 'RELAIS') {
      const ownedRelais = await db.relais.findUnique({
        where: { id },
        select: { userId: true },
      });

      if (!ownedRelais) {
        return NextResponse.json({ error: 'Relais not found' }, { status: 404 });
      }

      if (ownedRelais.userId !== auth.payload.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get parcels for this relay (both departure and arrival)
    const parcels = await db.$queryRaw<Array<{
      id: string;
      status: string;
      relaisDepartId: string;
      relaisArriveeId: string;
      commissionRelais: number;
    }>>`
      SELECT id, status, "relaisDepartId", "relaisArriveeId", "commissionRelais"
      FROM "Colis"
      WHERE "relaisDepartId" = ${id} OR "relaisArriveeId" = ${id}
    `;

    const actionableDepartureStatuses = [
      'CREATED',
      'PENDING_PAYMENT',
      'READY_FOR_DEPOSIT',
      'PAID',
      'PAID_RELAY',
      'DEPOSITED_RELAY',
      'RECU_RELAIS',
      'WAITING_PICKUP',
      'ASSIGNED',
    ];
    const inStockDepartureStatuses = ['DEPOSITED_RELAY', 'RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED'];
    const inStockArrivalStatuses = ['ARRIVE_RELAIS_DESTINATION'];

    const pendingDeparture = parcels.filter(
      (p) => p.relaisDepartId === id && actionableDepartureStatuses.includes(p.status)
    ).length;

    const inStockDeparture = parcels.filter(
      (p) => p.relaisDepartId === id && inStockDepartureStatuses.includes(p.status)
    ).length;

    const inStockArrival = parcels.filter(
      (p) => p.relaisArriveeId === id && inStockArrivalStatuses.includes(p.status)
    ).length;

    const pending = pendingDeparture + inStockArrival;
    const received = inStockDeparture + inStockArrival;
    
    const handedOver = parcels.filter(p => 
      p.status === 'LIVRE' && p.relaisArriveeId === id
    ).length;
    
    const earnings = parcels
      .filter(p => p.status === 'LIVRE' && p.relaisArriveeId === id)
      .reduce((sum, p) => sum + (p.commissionRelais || 0), 0);

    return NextResponse.json({
      pending,
      inStockDeparture,
      inStockArrival,
      received,
      handedOver,
      earnings,
    });
  } catch (error) {
    console.error('Error fetching relais stats:', error);
    return NextResponse.json({
      pending: 0,
      inStockDeparture: 0,
      inStockArrival: 0,
      received: 0,
      handedOver: 0,
      earnings: 0,
    });
  }
}
