const TRACKING_PATTERN = /SC[A-Z0-9]{6,}/i;

function normalizeTrackingCandidate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const directMatch = trimmed.match(TRACKING_PATTERN);
  return directMatch ? directMatch[0].toUpperCase() : undefined;
}

function getConfiguredBaseUrl(baseUrl?: string): string | undefined {
  const candidate = baseUrl || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
  if (!candidate) return undefined;

  try {
    return new URL(candidate).origin;
  } catch {
    return undefined;
  }
}

export function buildParcelScanUrl(trackingNumber: string, baseUrl?: string): string | undefined {
  const origin = getConfiguredBaseUrl(baseUrl);
  if (!origin) return undefined;
  return `${origin}/scan/${encodeURIComponent(trackingNumber)}`;
}

export function buildParcelQrPayload(trackingNumber: string, baseUrl?: string): string {
  const payload: Record<string, string> = {
    tracking: trackingNumber,
    platform: 'SwiftColis',
    generated: new Date().toISOString(),
  };

  const scanUrl = buildParcelScanUrl(trackingNumber, baseUrl);
  if (scanUrl) {
    payload.scanUrl = scanUrl;
  }

  return JSON.stringify(payload);
}

export function extractTrackingFromQrPayload(input: unknown): string | undefined {
  if (typeof input !== 'string') {
    return undefined;
  }

  const raw = input.trim();
  if (!raw) {
    return undefined;
  }

  const directTracking = normalizeTrackingCandidate(raw);
  if (directTracking && directTracking === raw.toUpperCase()) {
    return directTracking;
  }

  try {
    const parsed = JSON.parse(raw);
    const fromJson =
      normalizeTrackingCandidate(parsed?.tracking) ||
      normalizeTrackingCandidate(parsed?.trackingNumber) ||
      normalizeTrackingCandidate(parsed?.scanUrl) ||
      normalizeTrackingCandidate(parsed?.url);

    if (fromJson) {
      return fromJson;
    }
  } catch {
    // raw string is not JSON, continue with URL/regex parsing
  }

  try {
    const parsedUrl = new URL(raw);
    const fromQuery =
      normalizeTrackingCandidate(parsedUrl.searchParams.get('tracking')) ||
      normalizeTrackingCandidate(parsedUrl.searchParams.get('track'));

    if (fromQuery) {
      return fromQuery;
    }

    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const fromPath = normalizeTrackingCandidate(segments[index]);
      if (fromPath) {
        return fromPath;
      }
    }
  } catch {
    // raw string is not a full URL, continue with regex fallback
  }

  return normalizeTrackingCandidate(raw);
}