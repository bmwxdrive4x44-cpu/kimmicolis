import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

// Reset all relais to PENDING status - ADMIN ONLY
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    // Update all relais to PENDING status
    const result = await db.$executeRawUnsafe(`
      UPDATE "Relais" SET status = 'PENDING', "updatedAt" = NOW()
    `);

    return NextResponse.json({
      success: true,
      message: `Updated ${result} relais records to PENDING status`,
      note: 'Admin must now validate each relais manually',
    });
  } catch (error) {
    console.error('Error resetting relais status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to reset relais status',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
