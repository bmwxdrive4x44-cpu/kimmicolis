import { NextRequest, NextResponse } from 'next/server';
import { autoAssignUnmatchedColis } from '@/services/matchingService';

/**
 * POST /api/matching/auto-assign/cron
 * Déclenchement planifié sécurisé pour auto-assigner les colis non assignés.
 *
 * Sécurité:
 * - Header requis: x-cron-secret
 * - Valeur attendue: process.env.CRON_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const providedSecret = request.headers.get('x-cron-secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Server misconfiguration: CRON_SECRET is missing' },
        { status: 500 }
      );
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = Number(body?.limit ?? 100);

    const result = await autoAssignUnmatchedColis(limit);

    return NextResponse.json({
      success: true,
      message: 'Cron auto-assign matching completed',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[matching-auto-assign-cron] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
