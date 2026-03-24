export function normalizeCommerceRegisterNumber(value: string): string {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

export function isAlgerianCommerceRegisterNumber(value: string): boolean {
  const normalized = normalizeCommerceRegisterNumber(value).replace(/\s+/g, '');
  // Format CNRC algérien : [RC-]WW/NNNNNNNLAA
  // WW = code wilaya (2 chiffres), N = séquentiel (1-8 chiffres),
  // L = type activité (1 lettre : B/C/H/R...), AA = année (2 chiffres)
  return /^(RC[\s\-]*)?\d{2}[\/\-]\d{1,8}[A-Z]\d{2}$/.test(normalized);
}
