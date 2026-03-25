import { db } from '@/lib/db';

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: string;
  dedupWindowMs?: number;
}

export async function createNotificationDedup(input: CreateNotificationInput) {
  const {
    userId,
    title,
    message,
    type = 'IN_APP',
    dedupWindowMs = 2 * 60 * 1000,
  } = input;

  const since = new Date(Date.now() - dedupWindowMs);

  const existing = await db.notification.findFirst({
    where: {
      userId,
      title,
      message,
      type,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return existing;
  }

  return db.notification.create({
    data: {
      userId,
      title,
      message,
      type,
    },
  });
}
