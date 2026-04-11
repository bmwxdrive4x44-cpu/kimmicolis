type HeaderBag = Headers | Record<string, string | string[] | undefined> | null | undefined;

function readHeader(headers: HeaderBag, name: string): string | null {
  if (!headers) return null;

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name);
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()] ?? record[name.toUpperCase()];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function normalizeIp(value: string | null | undefined): string | null {
  const raw = String(value || '').split(',')[0]?.trim();
  if (!raw || raw.toLowerCase() === 'unknown') {
    return null;
  }

  return raw;
}

export function getClientIpFromHeaders(headers: HeaderBag): string | null {
  return (
    normalizeIp(readHeader(headers, 'x-forwarded-for')) ||
    normalizeIp(readHeader(headers, 'cf-connecting-ip')) ||
    normalizeIp(readHeader(headers, 'x-real-ip'))
  );
}
