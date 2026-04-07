import { db } from '@/lib/db';
import { RELAY_BLOCK_THRESHOLD_DA } from '@/lib/constants';
import { extractTrackingFromQrPayload } from '@/lib/qr-payload';

export type RelayScanError = {
  error: string;
  status: number;
};

export type RelayScanResult<T> =
  | { ok: true; data: T }
  | { ok: false; issue: RelayScanError };

/**
 * Extrait le tracking depuis `trackingNumber` direct ou depuis `qrData` (JSON ou string).
 */
export function resolveTrackingNumber(
  trackingNumber: unknown,
  qrData: unknown
): string | undefined {
  const directTracking = extractTrackingFromQrPayload(trackingNumber);
  if (directTracking) {
    return directTracking;
  }

  return extractTrackingFromQrPayload(qrData);
}

export function resolveQrSecurityPayload(
  qrData: unknown
): { parcelId?: string; token?: string } {
  if (typeof qrData !== 'string') return {};
  const raw = qrData.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as { parcelId?: unknown; token?: unknown };
    return {
      parcelId: typeof parsed.parcelId === 'string' && parsed.parcelId.trim() ? parsed.parcelId.trim() : undefined,
      token: typeof parsed.token === 'string' && parsed.token.trim() ? parsed.token.trim() : undefined,
    };
  } catch {
    return {};
  }
}

/**
 * Résout le relais actif à partir de `relaisId` (si fourni) ou du `userId` authentifié.
 */
export async function resolveActingRelais(
  authUserId: string,
  relaisIdInput: unknown
): Promise<RelayScanResult<{ id: string; commerceName: string; cashCollected: number; cashReversed: number; operationalStatus: string; suspensionReason: string | null }>> {
  let actingRelaisId: string | undefined =
    typeof relaisIdInput === 'string' && relaisIdInput.trim().length > 0
      ? relaisIdInput.trim()
      : undefined;

  if (!actingRelaisId) {
    const relayFromUser = await db.relais.findUnique({
      where: { userId: authUserId },
      select: { id: true },
    });

    if (relayFromUser) actingRelaisId = relayFromUser.id;
  }

  if (!actingRelaisId) {
    return {
      ok: false,
      issue: { error: 'Aucun point relais trouvé pour cet utilisateur', status: 400 },
    };
  }

  const relais = await db.relais.findUnique({
    where: { id: actingRelaisId },
    select: {
      id: true,
      commerceName: true,
      cashCollected: true,
      cashReversed: true,
      operationalStatus: true,
      suspensionReason: true,
    },
  });

  if (!relais) {
    return {
      ok: false,
      issue: { error: 'Point relais non trouvé', status: 404 },
    };
  }

  return { ok: true, data: relais };
}

/**
 * Vérifie si le relais est bloqué par dépassement de cash non reversé.
 */
export function getRelaisCashBlockIssue(relais: {
  cashCollected: number;
  cashReversed: number;
}): RelayScanError | null {
  if (relais.cashCollected - relais.cashReversed >= RELAY_BLOCK_THRESHOLD_DA) {
    return {
      error: 'Ce point relais a atteint le seuil de cash. Contactez l\'administrateur.',
      status: 403,
    };
  }

  return null;
}
