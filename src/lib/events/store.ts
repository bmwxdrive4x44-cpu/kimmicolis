import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { getEventSystemPhase, isEventEmissionEnabled, isProjectorEnabled } from '@/lib/events/config';
import { projectDomainEvent } from '@/lib/events/projectors';
import type { DomainEventInput, DomainEventRecord } from '@/lib/events/types';

function isMissingEventStoreTableError(error: unknown): boolean {
  const code = String((error as { code?: string })?.code || '');
  const message = String((error as { message?: string })?.message || '').toLowerCase();
  return code === 'P2010' || code === 'P2021' || message.includes('relation "event" does not exist');
}

export async function emitEvent(input: DomainEventInput): Promise<DomainEventRecord> {
  const event: DomainEventRecord = {
    id: randomUUID(),
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    createdAt: new Date(),
  };

  if (!isEventEmissionEnabled()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[events] emission skipped because EVENT_SYSTEM_PHASE != LIVE', {
        phase: getEventSystemPhase(),
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
      });
    }
    return event;
  }

  try {
    await db.$executeRawUnsafe(
      'INSERT INTO "Event" ("id", "type", "aggregateType", "aggregateId", "payload", "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
      event.id,
      event.type,
      event.aggregateType,
      event.aggregateId,
      JSON.stringify(event.payload || {}),
      event.createdAt,
    );
  } catch (error) {
    if (isMissingEventStoreTableError(error)) {
      console.error('[events] table Event absente: applique la migration foundation avant EVENT_SYSTEM_PHASE=LIVE');
      return event;
    }
    throw error;
  }

  // Dual-write migration mode: project synchronously for immediate consistency.
  if (isProjectorEnabled()) {
    await projectDomainEvent(event);
  }

  return event;
}
