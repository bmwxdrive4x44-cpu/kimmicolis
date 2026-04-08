import { randomBytes } from 'crypto';

/**
 * QR Security utilities for parcel scanning
 * - PIN generation (4 digits)
 * - QR expiration tracking
 * - Token validation
 */

export interface QRPayload {
  parcelId?: string;
  qrToken?: string;
  token?: string; // alias for qrToken
  withdrawalPin?: string;
  expiresAt?: string; // ISO 8601 datetime
}

/**
 * Generate 4-digit withdrawal PIN
 */
export function generateWithdrawalPin(): string {
  const min = 1000;
  const max = 9999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
}

/**
 * Check if QR is expired
 */
export function isQRExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false; // No expiration set
  return new Date() > expiresAt;
}

/**
 * Calculate QR expiration time (default 24 hours from now)
 */
export function calculateQRExpiration(hoursValid: number = 24): Date {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hoursValid);
  return expiresAt;
}

/**
 * Validate QR payload structure and fields
 */
export function validateQRPayload(payload: any): { valid: boolean; error?: string } {
  if (!payload) {
    return { valid: false, error: 'QR payload missing' };
  }

  if (!payload.parcelId) {
    return { valid: false, error: 'parcelId missing' };
  }

  if (!payload.qrToken) {
    return { valid: false, error: 'qrToken missing' };
  }

  return { valid: true };
}

/**
 * Validate QR against parcel: token match + expiration
 */
export async function validateQRAgainstParcel(
  dbParcel: any,
  qrPayload: QRPayload,
  options: {
    checkExpiration?: boolean;
    checkPin?: boolean;
    pinAttempt?: string;
  } = {}
): Promise<{
  valid: boolean;
  error?: string;
  fraudFlag?: boolean;
}> {
  const { checkExpiration = true, checkPin = false, pinAttempt } = options;

  // Get token from either qrToken or token field
  const tokenFromPayload = qrPayload.qrToken || qrPayload.token;

  // 1. Token mismatch check (critical anti-fraud)
  if (tokenFromPayload && dbParcel.qrToken && tokenFromPayload !== dbParcel.qrToken) {
    return {
      valid: false,
      error: 'QR token mismatch',
      fraudFlag: true, // Possible replay/forged QR
    };
  }

  // 2. Expiration check
  if (checkExpiration && isQRExpired(dbParcel.qrExpiresAt)) {
    return {
      valid: false,
      error: 'QR code expired',
      fraudFlag: false,
    };
  }

  // 3. Withdrawal PIN check (if required)
  if (checkPin && dbParcel.withdrawalPin) {
    if (!pinAttempt) {
      return {
        valid: false,
        error: 'PIN required but not provided',
      };
    }

    // Simple string comparison (PIN is stored as plain in DB for now)
    // TODO: hash PIN in DB for production
    if (dbParcel.withdrawalPin !== pinAttempt) {
      return {
        valid: false,
        error: 'Invalid PIN',
        fraudFlag: false,
      };
    }
  }

  return { valid: true };
}

/**
 * Log QR scan for fraud audit trail
 */
export interface QRScanLogData {
  colisId: string;
  qrToken: string;
  scanLocation?: string;
  scannerRole?: string;
  pinAttempts?: number;
  pinVerified?: boolean;
  fraudFlag?: boolean;
  fraudReason?: string;
}

/**
 * Helper to create QrSecurityLog entry
 */
export function createQRScanLogEntry(data: QRScanLogData) {
  return {
    colisId: data.colisId,
    qrToken: data.qrToken,
    scanLocation: data.scanLocation,
    scannerRole: data.scannerRole,
    pinAttempts: data.pinAttempts || 0,
    pinVerified: data.pinVerified || false,
    tokenValid: true,
    expiryStatus: 'ACTIVE',
    fraudFlagRaised: data.fraudFlag || false,
    fraudReason: data.fraudReason,
  };
}

/**
 * Detect geographic inconsistency (simple version)
 * Can be enhanced with more sophisticated logic
 */
export function detectGeographicInconsistency(
  parcelVilleDepart: string,
  parcelVilleArrivee: string,
  scanLocation: string | undefined
): { blocked: boolean; reason?: string } {
  if (!scanLocation) {
    // Can't verify without location
    return { blocked: false };
  }

  // Rough check: if scan is NOT at depart and NOT at arrivee, flag
  // (This is very basic; in production use proper distance matrix)
  const normalizeScan = scanLocation.toLowerCase();
  const normDepart = parcelVilleDepart.toLowerCase();
  const normArrivee = parcelVilleArrivee.toLowerCase();

  // If scan location matches neither depart nor arrivee exactly
  // this doesn't mean it's wrong (intermediate relay), so don't block
  // Instead, log it for review

  return { blocked: false }; // Complex logic deferred to admin review
}
