import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/rbac';
import { evaluateImplicitProEligibility } from '@/lib/pro-eligibility';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['CLIENT', 'ADMIN']);
  if (!auth.success) return auth.response;

  const { payload } = auth;
  const { searchParams } = new URL(request.url);
  const requestedClientId = searchParams.get('clientId');

  const clientId = payload.role === 'ADMIN'
    ? (requestedClientId || payload.id)
    : payload.id;

  if (!clientId) {
    return NextResponse.json({ error: 'clientId manquant' }, { status: 400 });
  }

  try {
    const eligibility = await evaluateImplicitProEligibility(clientId);
    return NextResponse.json({
      clientId,
      program: 'IMPLICIT_LOYALTY',
      ...eligibility,
    });
  } catch (error) {
    console.error('Error fetching loyalty status:', error);
    return NextResponse.json({ error: 'Failed to fetch loyalty status' }, { status: 500 });
  }
}
