import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    const pending = parcels.filter(p => 
      ['CREATED', 'PAID'].includes(p.status) && p.relaisDepartId === id
    ).length;
    
    const received = parcels.filter(p => 
      p.status === 'RECU_RELAIS' || p.status === 'EN_TRANSPORT'
    ).length;
    
    const handedOver = parcels.filter(p => 
      p.status === 'LIVRE' && p.relaisArriveeId === id
    ).length;
    
    const earnings = parcels
      .filter(p => p.status === 'LIVRE' && p.relaisArriveeId === id)
      .reduce((sum, p) => sum + (p.commissionRelais || 0), 0);

    return NextResponse.json({
      pending,
      received,
      handedOver,
      earnings,
    });
  } catch (error) {
    console.error('Error fetching relais stats:', error);
    return NextResponse.json({
      pending: 0,
      received: 0,
      handedOver: 0,
      earnings: 0,
    });
  }
}
