export function normalizeCommerceRegisterNumber(value: string): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isAlgerianCommerceRegisterNumber(value: string): boolean {
  const normalized = normalizeCommerceRegisterNumber(value).replace(/\s+/g, '');
  return /^(RC)?-?\d{2}[\/-]\d{5,10}[A-Z]{1,3}\d{2}$/.test(normalized);
}
