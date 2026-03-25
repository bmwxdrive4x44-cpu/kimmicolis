import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireRole } from '@/lib/rbac';

const NOTIFICATION_DEDUP_WINDOW_MS = 2 * 60 * 1000;

function dedupeNotifications(notifications: any[]) {
  const kept: any[] = [];
  const latestBySignature = new Map<string, Date>();

  for (const notification of notifications) {
    const signature = `${notification.userId}__${notification.type}__${notification.title}__${notification.message}`;
    const createdAt = new Date(notification.createdAt);
    const previous = latestBySignature.get(signature);

    if (previous && previous.getTime() - createdAt.getTime() <= NOTIFICATION_DEDUP_WINDOW_MS) {
      continue;
    }

    kept.push(notification);
    latestBySignature.set(signature, createdAt);
  }

  return kept;
}

// GET notifications for user
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'CLIENT', 'RELAIS', 'TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get('userId');
    const userId = requestedUserId || auth.payload.id;

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    if (auth.payload.role !== 'ADMIN' && userId !== auth.payload.id) {
      return NextResponse.json({ error: 'Accès interdit à ces notifications' }, { status: 403 });
    }

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 120,
    });

    const deduped = dedupeNotifications(notifications).slice(0, 50);
    return NextResponse.json(deduped);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

// POST create notification
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { userId, title, message, type } = body;

    const notification = await db.notification.create({
      data: {
        userId,
        title,
        message,
        type: type || 'IN_APP',
      },
    });

    // Log email simulation
    if (type === 'EMAIL') {
      console.log(`[EMAIL] To: ${userId} - ${title}: ${message}`);
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    return NextResponse.json({ error: 'Failed to create notification' }, { status: 500 });
  }
}

// PUT mark as read
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, ['ADMIN', 'CLIENT', 'RELAIS', 'TRANSPORTER']);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json();
    const { id, userId, markAllRead } = body;

    if (markAllRead && userId) {
      if (auth.payload.role !== 'ADMIN' && userId !== auth.payload.id) {
        return NextResponse.json({ error: 'Accès interdit à ces notifications' }, { status: 403 });
      }
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (id) {
      if (auth.payload.role !== 'ADMIN') {
        const owned = await db.notification.findFirst({ where: { id, userId: auth.payload.id }, select: { id: true } });
        if (!owned) {
          return NextResponse.json({ error: 'Notification introuvable ou interdite' }, { status: 404 });
        }
      }
      const notification = await db.notification.update({
        where: { id },
        data: { isRead: true },
      });
      return NextResponse.json(notification);
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
