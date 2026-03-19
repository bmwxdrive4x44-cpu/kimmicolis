import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Reset all relais to PENDING status (except if you want to keep some approved)
export async function GET() {
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
