import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PUT update relais status (approve/reject)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, commissionPetit, commissionMoyen, commissionGros } = body;

    const relais = await db.relais.update({
      where: { id },
      data: {
        status,
        commissionPetit,
        commissionMoyen,
        commissionGros,
      },
    });

    return NextResponse.json(relais);
  } catch (error) {
    console.error('Error updating relais:', error);
    return NextResponse.json({ error: 'Failed to update relais' }, { status: 500 });
  }
}
