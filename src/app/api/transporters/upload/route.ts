import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { authOptions } from '@/lib/auth';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'transporter-docs');

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'Aucun fichier fourni' },
        { status: 400 }
      );
    }

    // Validate file type (images and PDFs only)
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format de fichier non autorisé. Acceptés: JPEG, PNG, WebP, PDF' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Fichier trop volumineux. Taille max: 5MB' },
        { status: 400 }
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {});

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop();
    const filename = `${session.user.id}-${timestamp}-${randomStr}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(buffer));

    return NextResponse.json({
      success: true,
      url: `/uploads/transporter-docs/${filename}`,
      filename: file.name,
      size: file.size,
      message: 'Document uploadé avec succès',
    });
  } catch (error) {
    console.error('Transporter upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload du document" },
      { status: 500 }
    );
  }
}
