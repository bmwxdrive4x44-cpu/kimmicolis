export type CanonicalRole = 'ADMIN' | 'TRANSPORTER' | 'RELAIS' | 'ENSEIGNE' | 'CLIENT';

const ROLE_ALIASES: Record<string, CanonicalRole> = {
  ADMIN: 'ADMIN',
  ADMINISTRATEUR: 'ADMIN',
  TRANSPORTER: 'TRANSPORTER',
  TRANSPORTEUR: 'TRANSPORTER',
  RELAIS: 'RELAIS',
  RELAY: 'RELAIS',
  ENSEIGNE: 'ENSEIGNE',
  MERCHANT: 'ENSEIGNE',
  SHOP: 'ENSEIGNE',
  CLIENT: 'CLIENT',
  CUSTOMER: 'CLIENT',
  USER: 'CLIENT',
};

export function normalizeRole(role: unknown, fallback: CanonicalRole = 'CLIENT'): CanonicalRole {
  if (typeof role !== 'string') {
    return fallback;
  }

  const normalized = role.trim().toUpperCase();
  return ROLE_ALIASES[normalized] ?? fallback;
}

export function isRoleAllowed(role: unknown, allowedRoles: readonly CanonicalRole[]): boolean {
  return allowedRoles.includes(normalizeRole(role));
}
