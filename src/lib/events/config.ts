export type EventSystemPhase = 'FOUNDATION' | 'BACKFILL' | 'LIVE';

export function getEventSystemPhase(): EventSystemPhase {
  const raw = String(process.env.EVENT_SYSTEM_PHASE || 'LIVE').trim().toUpperCase();
  if (raw === 'FOUNDATION' || raw === 'BACKFILL' || raw === 'LIVE') {
    return raw;
  }
  return 'LIVE';
}

export function isEventEmissionEnabled(): boolean {
  return getEventSystemPhase() === 'LIVE';
}

export function isProjectorEnabled(): boolean {
  return getEventSystemPhase() === 'LIVE';
}
