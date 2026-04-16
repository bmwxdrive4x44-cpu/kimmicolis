import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { projectDomainEvent } from '@/lib/events/projectors';
import type { DomainEventInput, DomainEventRecord } from '@/lib/events/types';

export async function emitEvent(input: DomainEventInput): Promise<DomainEventRecord> {
  const event: DomainEventRecord = {
    id: randomUUID(),
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    createdAt: new Date(),
  };

  await db.$executeRawUnsafe(
    'INSERT INTO "Event" ("id", "type", "aggregateType", "aggregateId", "payload", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
    event.id,
    event.type,
    event.aggregateType,
    event.aggregateId,
    JSON.stringify(event.payload || {}),
    event.createdAt,
  );

  // Dual-write migration mode: project synchronously for immediate consistency.
  await projectDomainEvent(event);

  return event;
}
