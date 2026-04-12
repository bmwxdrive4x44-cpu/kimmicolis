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

  try {
    return await db.ligne.findFirst({
      where: {
        isActive: true,
        OR: [
          { villeDepart: depart, villeArrivee: arrivee },
          { villeDepart: arrivee, villeArrivee: depart },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error) {
    console.warn('[logistics] active line lookup failed, retrying with compatibility query:', error);
    return db.ligne.findFirst({
      where: {
        OR: [
          { villeDepart: depart, villeArrivee: arrivee },
          { villeDepart: arrivee, villeArrivee: depart },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }
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