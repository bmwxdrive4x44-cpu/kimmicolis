import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { syncTransporterWallets } from '@/lib/payout-sync';

/**
 * POST /api/admin/payouts/sync
 * Synchronise les wallets transporteurs selon le cash réellement reversé par les relais.
 * Body optionnel: { transporteurId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const transporteurId = typeof body?.transporteurId === 'string' ? body.transporteurId : undefined;

    const result = await syncTransporterWallets({
      actorId: auth.payload.id,
      transporteurId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Payout sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync transporter wallets' },
      { status: 500 }
    );
  }
}
