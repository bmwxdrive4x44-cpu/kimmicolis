import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { db } from '@/lib/db';
import { getErrorMessage } from '@/lib/errors';
import { requireRole } from '@/lib/rbac';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, ['TRANSPORTER', 'ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing transporter application id' }, { status: 400 });
    }

    const body = await request.json();
    const { fullName, phone, vehicle, license, experience, regions, description, documents } = body;
    const serializedDocuments = Array.isArray(documents)
      ? JSON.stringify(documents)
      : typeof documents === 'string'
        ? documents
        : null;

    const existing = await db.transporterApplication.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (auth.payload.role !== 'ADMIN' && existing.userId !== auth.payload.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data: Prisma.TransporterApplicationUpdateInput = {};
    if (fullName !== undefined) data.fullName = fullName;
    if (phone !== undefined) data.phone = phone;
    if (vehicle !== undefined) data.vehicle = vehicle;
    if (license !== undefined) data.license = license;
    if (experience !== undefined) data.experience = parseInt(String(experience), 10) || 0;
    if (regions !== undefined) {
      data.regions = Array.isArray(regions) ? JSON.stringify(regions) : regions;
    }
    if (description !== undefined) data.description = description;
    const updated = await db.transporterApplication.update({
      where: { id },
      data,
    });

    if (documents !== undefined) {
      await db.$executeRaw`
        UPDATE "TransporterApplication"
        SET "documents" = ${serializedDocuments}
        WHERE "id" = ${id}
      `;
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating transporter application:', error);
    return NextResponse.json({
      error: 'Failed to update',
      details: getErrorMessage(error),
    }, { status: 500 });
  }
}
