import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * GET /api/admin/cash-pickups?status=...
 * Liste admin des collectes cash physiques
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const pickups = await db.cashPickup.findMany({
      where: status ? { status } : undefined,
      include: {
        relais: {
          select: {
            id: true,
            commerceName: true,
            address: true,
            ville: true,
            user: { select: { name: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ pickups });
  } catch (error) {
    console.error('Error listing cash pickups:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
