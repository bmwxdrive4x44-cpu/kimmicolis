import { db } from '@/lib/db';

export function normalizeCity(value: string) {
  return String(value || '').trim();
}

export async function findActiveLineByCities(villeDepart: string, villeArrivee: string) {
  const depart = normalizeCity(villeDepart);
  const arrivee = normalizeCity(villeArrivee);

  if (!depart || !arrivee || depart === arrivee) {
    return null;
  }

  return db.ligne.findFirst({
    where: {
      isActive: true,
      OR: [
        { villeDepart: depart, villeArrivee: arrivee },
        { villeDepart: arrivee, villeArrivee: depart },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getActiveRelayCities() {
  const relais = await db.relais.findMany({
    where: {
      status: 'APPROVED',
      operationalStatus: 'ACTIF',
    },
    select: { ville: true },
    distinct: ['ville'],
    orderBy: { ville: 'asc' },
  });

  return relais.map((item) => item.ville).filter(Boolean);
}