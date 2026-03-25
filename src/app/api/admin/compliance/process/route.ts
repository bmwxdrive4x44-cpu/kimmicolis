import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { processComplianceBatch } from '@/lib/relais-compliance';

/**
 * POST /api/admin/compliance/process
 * Exécute la logique métier compliance (score continu, pénalités rapides, caution progressive)
 * Body optionnel: { relaisId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const relaisId = typeof body?.relaisId === 'string' ? body.relaisId : undefined;

    const result = await processComplianceBatch({
      actorId: auth.payload.id,
      relaisId,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Compliance process error:', error);
    return NextResponse.json(
      { error: 'Failed to process compliance rules' },
      { status: 500 }
    );
  }
}
