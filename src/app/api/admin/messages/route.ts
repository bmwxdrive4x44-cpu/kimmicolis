import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { normalizeRole } from '@/lib/roles';
import { sendEmail } from '@/lib/email';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  if (normalizeRole(session.user.role) === 'ADMIN') {
    return session;
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });

  if (normalizeRole(dbUser?.role) !== 'ADMIN') return null;
  return session;
}

// GET — liste des messages (avec filtre isRead optionnel)
export async function GET(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filter = searchParams.get('filter'); // 'unread' | 'read' | null (all)
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = 20;

  const where =
    filter === 'unread' ? { isRead: false }
    : filter === 'read' ? { isRead: true }
    : {};

  const [messages, total] = await Promise.all([
    db.contactMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.contactMessage.count({ where }),
  ]);

  return NextResponse.json({ messages, total, page, limit });
}

// PATCH — marquer comme lu / non-lu
export async function PATCH(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const id = typeof body?.id === 'string' ? body.id : null;
  const isRead = typeof body?.isRead === 'boolean' ? body.isRead : true;

  if (!id) {
    return NextResponse.json({ error: 'id requis.' }, { status: 400 });
  }

  const updated = await db.contactMessage.update({
    where: { id },
    data: {
      isRead,
      ...(isRead ? { repliedAt: body?.replied ? new Date() : undefined } : {}),
    },
  });

  return NextResponse.json(updated);
}

// DELETE — supprimer un message
export async function DELETE(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id requis.' }, { status: 400 });
  }

  await db.contactMessage.delete({ where: { id } });
  return NextResponse.json({ success: true });
}

// POST — envoyer une réponse par email
export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const id = typeof body?.id === 'string' ? body.id : null;
    const replyText = typeof body?.reply === 'string' ? body.reply.trim() : '';

    if (!id || !replyText) {
      return NextResponse.json({ error: 'id et reply requis.' }, { status: 400 });
    }

    const msg = await db.contactMessage.findUnique({ where: { id } });
    if (!msg) {
      return NextResponse.json({ error: 'Message introuvable.' }, { status: 404 });
    }

    let emailSent = false;
    try {
      await sendEmail({
        to: msg.email,
        subject: `Re: ${msg.subject}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <p style="color:#374151">${replyText.replace(/\n/g, '<br/>')}</p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
            <p style="color:#9ca3af;font-size:13px">
              Message original de <strong>${msg.name}</strong> :<br/>
              <em>${msg.message}</em>
            </p>
            <p style="color:#9ca3af;font-size:12px;margin-top:16px">SwiftColis — Ne pas répondre à cet email automatique.</p>
          </div>
        `,
      });
      emailSent = true;
    } catch (emailErr) {
      console.error('[admin/messages POST] sendEmail error:', emailErr);
    }

    await db.contactMessage.update({
      where: { id },
      data: { isRead: true, repliedAt: new Date(), replyContent: replyText },
    });

    return NextResponse.json({ success: true, emailSent });
  } catch (err) {
    console.error('[admin/messages POST] unexpected error:', err);
    return NextResponse.json(
      { error: 'Erreur serveur', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
