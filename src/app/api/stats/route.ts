import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    // Get counts using raw SQL
    const usersCount = await db.$queryRaw<[{count: bigint}]>`SELECT COUNT(*) as count FROM "User"`;
    const parcelsCount = await db.$queryRaw<[{count: bigint}]>`SELECT COUNT(*) as count FROM "Colis" WHERE status != 'PAID'`;
    const transportersCount = await db.$queryRaw<[{count: bigint}]>`SELECT COUNT(*) as count FROM "User" WHERE role = 'TRANSPORTER'`;
    const relaisCount = await db.$queryRaw<[{count: bigint}]>`SELECT COUNT(*) as count FROM "Relais" WHERE status = 'APPROVED'`;
    const pendingRelaisCount = await db.$queryRaw<[{count: bigint}]>`SELECT COUNT(*) as count FROM "Relais" WHERE status = 'PENDING'`;

    // Get parcels by status
    const parcelsByStatus = await db.$queryRaw<Array<{status: string; count: bigint}>>`
      SELECT status, COUNT(*) as count FROM "Colis" WHERE status != 'PAID' GROUP BY status
    `;

    // Get revenue
    const revenueResult = await db.$queryRaw<[{sum: bigint | null}]>`
      SELECT SUM("commissionPlateforme") as sum FROM "Colis" WHERE status != 'CREATED'
    `;

    // Get parcels by city
    const parcelsByCity = await db.$queryRaw<Array<{city: string; count: bigint}>>`
      SELECT "villeArrivee" as city, COUNT(*) as count 
      FROM "Colis" 
      WHERE status != 'PAID'
      GROUP BY "villeArrivee" 
      ORDER BY count DESC 
      LIMIT 10
    `;

    // Get recent parcels
    const recentParcels = await db.$queryRaw<Array<{
      id: string;
      trackingNumber: string;
      status: string;
      villeDepart: string;
      villeArrivee: string;
      prixClient: number;
      createdAt: Date;
      clientId: string;
      clientName: string;
    }>>`
      SELECT c.id, c."trackingNumber", c.status, c."villeDepart", c."villeArrivee", 
             c."prixClient", c."createdAt", c."clientId", u.name as "clientName"
      FROM "Colis" c
      LEFT JOIN "User" u ON c."clientId" = u.id
            WHERE c.status != 'PAID'
      ORDER BY c."createdAt" DESC
      LIMIT 10
    `;

    // Get monthly stats - PostgreSQL compatible
    const monthlyParcels = await db.$queryRaw<Array<{month: string; count: bigint}>>`
      SELECT TO_CHAR("createdAt", 'YYYY-MM') as month, COUNT(*) as count
      FROM "Colis"
      WHERE "createdAt" >= NOW() - INTERVAL '6 months' AND status != 'PAID'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
      ORDER BY month ASC
    `;

    return NextResponse.json({
      counts: {
        users: Number(usersCount[0]?.count || 0),
        parcels: Number(parcelsCount[0]?.count || 0),
        transporters: Number(transportersCount[0]?.count || 0),
        relais: Number(relaisCount[0]?.count || 0),
        pendingRelais: Number(pendingRelaisCount[0]?.count || 0),
      },
      parcelsByStatus: parcelsByStatus.map((s) => ({
        status: s.status,
        count: Number(s.count),
      })),
      revenue: Number(revenueResult[0]?.sum || 0),
      parcelsByCity: parcelsByCity.map((c) => ({
        city: c.city,
        count: Number(c.count),
      })),
      recentParcels: recentParcels.map((p) => ({
        id: p.id,
        trackingNumber: p.trackingNumber,
        status: p.status,
        villeDepart: p.villeDepart,
        villeArrivee: p.villeArrivee,
        prixClient: p.prixClient,
        createdAt: p.createdAt,
        client: { name: p.clientName },
      })),
      monthlyParcels: monthlyParcels.map((m) => ({
        month: m.month,
        count: Number(m.count),
      })),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
