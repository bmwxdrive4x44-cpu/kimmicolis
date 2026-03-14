import type { User, Line, Relais, Reservation, TrackingHistory, CommissionPlatform, Review, Transporteur } from '@/types';
import { UserRole, ParcelSize, ReservationStatus, RelayStatus, PaymentMethod } from '@/types';

// Commission plateforme par défaut
export const commissionPlatform: CommissionPlatform = {
  id: '1',
  pourcentage: 10,
  isActive: true
};

// Reviews mock
export const mockReviews: Review[] = [
  {
    id: '1',
    authorId: '1',
    authorName: 'Karim Benali',
    authorRole: UserRole.CLIENT,
    targetId: '2',
    targetType: 'TRANSPORTEUR',
    rating: 5,
    comment: 'Excellent service, très professionnel et ponctuel. Je recommande!',
    createdAt: new Date('2024-03-05')
  },
  {
    id: '2',
    authorId: '5',
    authorName: 'Samira Boudiaf',
    authorRole: UserRole.CLIENT,
    targetId: '2',
    targetType: 'TRANSPORTEUR',
    rating: 4,
    comment: 'Bon transporteur, colis livré dans les délais.',
    createdAt: new Date('2024-03-10')
  },
  {
    id: '3',
    authorId: '1',
    authorName: 'Karim Benali',
    authorRole: UserRole.CLIENT,
    targetId: '3',
    targetType: 'RELAIS',
    rating: 5,
    comment: 'Point relais très pratique, personnel accueillant.',
    createdAt: new Date('2024-03-06')
  },
  {
    id: '4',
    authorId: '5',
    authorName: 'Samira Boudiaf',
    authorRole: UserRole.CLIENT,
    targetId: '1',
    targetType: 'RELAIS',
    rating: 4,
    comment: 'Bon service, horaires pratiques.',
    createdAt: new Date('2024-03-08')
  }
];

// Utilisateurs mock
export const mockUsers: User[] = [
  {
    id: '1',
    email: 'client@colisway.dz',
    nom: 'Benali',
    prenom: 'Karim',
    telephone: '0555123456',
    role: UserRole.CLIENT,
    isActive: true,
    createdAt: new Date('2024-01-15')
  },
  {
    id: '2',
    email: 'transporteur@colisway.dz',
    nom: 'Hadji',
    prenom: 'Mohamed',
    telephone: '0555234567',
    role: UserRole.TRANSPORTEUR,
    siret: '12345678901234',
    entreprise: 'Transport Hadji Express',
    isActive: true,
    createdAt: new Date('2024-01-10')
  },
  {
    id: '3',
    email: 'relais@colisway.dz',
    nom: 'Merabet',
    prenom: 'Fatima',
    telephone: '0555345678',
    role: UserRole.RELAIS,
    commerceNom: 'Épicerie Merabet',
    adresse: '15 Rue Didouche Mourad, Alger Centre',
    wilaya: 'Alger',
    isActive: true,
    createdAt: new Date('2024-01-20')
  },
  {
    id: '4',
    email: 'admin@colisway.dz',
    nom: 'Admin',
    prenom: 'System',
    telephone: '0555456789',
    role: UserRole.ADMIN,
    isActive: true,
    createdAt: new Date('2024-01-01')
  },
  {
    id: '5',
    email: 'client2@colisway.dz',
    nom: 'Boudiaf',
    prenom: 'Samira',
    telephone: '0555567890',
    role: UserRole.CLIENT,
    isActive: true,
    createdAt: new Date('2024-02-01')
  },
  {
    id: '6',
    email: 'transporteur2@colisway.dz',
    nom: 'Kaci',
    prenom: 'Rachid',
    telephone: '0555678901',
    role: UserRole.TRANSPORTEUR,
    siret: '98765432109876',
    entreprise: 'Kaci Transport',
    isActive: true,
    createdAt: new Date('2024-01-25')
  }
];

// Transporteurs mock avec évaluations
export const mockTransporteurs: Transporteur[] = [
  {
    id: '1',
    userId: '2',
    user: mockUsers[1],
    siret: '12345678901234',
    entreprise: 'Transport Hadji Express',
    vehiculeType: 'Camionnette',
    disponible: true,
    rating: 4.5,
    totalReviews: 12,
    reviews: mockReviews.filter(r => r.targetId === '2' && r.targetType === 'TRANSPORTEUR'),
    totalMissions: 45,
    missionsReussies: 43
  },
  {
    id: '2',
    userId: '6',
    user: mockUsers[5],
    siret: '98765432109876',
    entreprise: 'Kaci Transport',
    vehiculeType: 'Fourgon',
    disponible: true,
    rating: 4.2,
    totalReviews: 8,
    reviews: [],
    totalMissions: 28,
    missionsReussies: 26
  }
];

// Lignes inter-wilayas mock
export const mockLines: Line[] = [
  { id: '1', villeDepart: 'Alger', villeArrivee: 'Oran', tarifPetit: 800, tarifMoyen: 1400, tarifGros: 2500, isActive: true },
  { id: '2', villeDepart: 'Alger', villeArrivee: 'Constantine', tarifPetit: 700, tarifMoyen: 1200, tarifGros: 2200, isActive: true },
  { id: '3', villeDepart: 'Alger', villeArrivee: 'Annaba', tarifPetit: 900, tarifMoyen: 1500, tarifGros: 2800, isActive: true },
  { id: '4', villeDepart: 'Oran', villeArrivee: 'Constantine', tarifPetit: 1000, tarifMoyen: 1700, tarifGros: 3000, isActive: true },
  { id: '5', villeDepart: 'Oran', villeArrivee: 'Tlemcen', tarifPetit: 400, tarifMoyen: 700, tarifGros: 1200, isActive: true },
  { id: '6', villeDepart: 'Constantine', villeArrivee: 'Annaba', tarifPetit: 500, tarifMoyen: 900, tarifGros: 1600, isActive: true },
  { id: '7', villeDepart: 'Alger', villeArrivee: 'Béjaïa', tarifPetit: 500, tarifMoyen: 900, tarifGros: 1600, isActive: true },
  { id: '8', villeDepart: 'Alger', villeArrivee: 'Sétif', tarifPetit: 600, tarifMoyen: 1000, tarifGros: 1800, isActive: true },
  { id: '9', villeDepart: 'Oran', villeArrivee: 'Mostaganem', tarifPetit: 300, tarifMoyen: 500, tarifGros: 900, isActive: true },
  { id: '10', villeDepart: 'Blida', villeArrivee: 'Oran', tarifPetit: 850, tarifMoyen: 1450, tarifGros: 2600, isActive: true }
];

// Points relais mock avec évaluations
export const mockRelais: Relais[] = [
  {
    id: '1',
    userId: '3',
    nom: 'Épicerie Merabet',
    adresse: '15 Rue Didouche Mourad, Alger Centre',
    wilaya: 'Alger',
    telephone: '0555345678',
    commissionPetit: 80,
    commissionMoyen: 120,
    commissionGros: 200,
    statutValidation: RelayStatus.VALIDE,
    user: mockUsers[2],
    rating: 4.5,
    totalReviews: 8,
    reviews: mockReviews.filter(r => r.targetId === '1' && r.targetType === 'RELAIS')
  },
  {
    id: '2',
    userId: '7',
    nom: 'Bureau de Tabac Oran',
    adresse: '45 Boulevard Mohamed VI, Oran',
    wilaya: 'Oran',
    telephone: '0555789012',
    commissionPetit: 80,
    commissionMoyen: 120,
    commissionGros: 200,
    statutValidation: RelayStatus.VALIDE,
    rating: 4.0,
    totalReviews: 5,
    reviews: mockReviews.filter(r => r.targetId === '2' && r.targetType === 'RELAIS')
  },
  {
    id: '3',
    userId: '8',
    nom: 'Station Service Constantine',
    adresse: 'Avenue des Martyrs, Constantine',
    wilaya: 'Constantine',
    telephone: '0555890123',
    commissionPetit: 80,
    commissionMoyen: 120,
    commissionGros: 200,
    statutValidation: RelayStatus.VALIDE,
    rating: 4.3,
    totalReviews: 6,
    reviews: []
  },
  {
    id: '4',
    userId: '9',
    nom: 'Pharmacie Annaba',
    adresse: '12 Rue de la République, Annaba',
    wilaya: 'Annaba',
    telephone: '0555901234',
    commissionPetit: 80,
    commissionMoyen: 120,
    commissionGros: 200,
    statutValidation: RelayStatus.EN_ATTENTE,
    rating: 0,
    totalReviews: 0,
    reviews: []
  }
];

// Tracking history mock
export const mockTrackingHistory: TrackingHistory[] = [
  {
    id: '1',
    reservationId: '1',
    statut: ReservationStatus.EN_ATTENTE,
    commentaire: 'Réservation créée',
    date: new Date('2024-03-01T10:00:00')
  },
  {
    id: '2',
    reservationId: '1',
    statut: ReservationStatus.PAYE,
    commentaire: 'Paiement confirmé via CCP',
    date: new Date('2024-03-01T10:30:00')
  },
  {
    id: '3',
    reservationId: '1',
    statut: ReservationStatus.EN_COURS,
    commentaire: 'Colis récupéré par le transporteur',
    date: new Date('2024-03-02T08:00:00')
  },
  {
    id: '4',
    reservationId: '1',
    statut: ReservationStatus.RECU_RELAIS,
    commentaire: 'Colis déposé au point relais',
    date: new Date('2024-03-03T14:00:00')
  },
  {
    id: '5',
    reservationId: '1',
    statut: ReservationStatus.LIVRE,
    commentaire: 'Colis remis au destinataire',
    date: new Date('2024-03-04T11:00:00')
  },
  {
    id: '6',
    reservationId: '2',
    statut: ReservationStatus.EN_ATTENTE,
    commentaire: 'Réservation créée',
    date: new Date('2024-03-05T09:00:00')
  },
  {
    id: '7',
    reservationId: '2',
    statut: ReservationStatus.PAYE,
    commentaire: 'Paiement confirmé via BaridiMob',
    date: new Date('2024-03-05T09:15:00')
  },
  {
    id: '8',
    reservationId: '2',
    statut: ReservationStatus.EN_COURS,
    commentaire: 'Colis récupéré par le transporteur',
    date: new Date('2024-03-06T07:30:00')
  }
];

// Réservations mock avec paiement
export const mockReservations: Reservation[] = [
  {
    id: '1',
    clientId: '1',
    transporteurId: '2',
    relaisId: '3',
    ligneId: '2',
    formatColis: ParcelSize.MOYEN,
    poids: 8.5,
    description: 'Vêtements et accessoires',
    nomDestinataire: 'Amine Boudiaf',
    telephoneDestinataire: '0555567890',
    prixClient: 1200,
    commissionPlatform: 120,
    commissionRelais: 120,
    netTransporteur: 960,
    statutColis: ReservationStatus.LIVRE,
    dateCreation: new Date('2024-03-01T10:00:00'),
    datePaiement: new Date('2024-03-01T10:30:00'),
    dateRecuRelais: new Date('2024-03-03T14:00:00'),
    dateLivraison: new Date('2024-03-04T11:00:00'),
    paymentMethod: PaymentMethod.CCP,
    paymentReference: 'CCP-20240301-001',
    isPaid: true,
    client: mockUsers[0],
    transporteur: mockUsers[1],
    relais: mockRelais[2],
    ligne: mockLines[1],
    trackingHistory: mockTrackingHistory.filter(t => t.reservationId === '1'),
    clientReview: mockReviews[0]
  },
  {
    id: '2',
    clientId: '1',
    transporteurId: '2',
    relaisId: '2',
    ligneId: '1',
    formatColis: ParcelSize.PETIT,
    poids: 3.2,
    description: 'Documents importants',
    nomDestinataire: 'Sofiane Merabet',
    telephoneDestinataire: '0555789012',
    prixClient: 800,
    commissionPlatform: 80,
    commissionRelais: 80,
    netTransporteur: 640,
    statutColis: ReservationStatus.EN_COURS,
    dateCreation: new Date('2024-03-05T09:00:00'),
    datePaiement: new Date('2024-03-05T09:15:00'),
    dateRecuRelais: undefined,
    dateLivraison: undefined,
    paymentMethod: PaymentMethod.BARIDI_MOB,
    paymentReference: 'BM-20240305-002',
    isPaid: true,
    client: mockUsers[0],
    transporteur: mockUsers[1],
    relais: mockRelais[1],
    ligne: mockLines[0],
    trackingHistory: mockTrackingHistory.filter(t => t.reservationId === '2')
  },
  {
    id: '3',
    clientId: '5',
    transporteurId: '6',
    relaisId: '1',
    ligneId: '3',
    formatColis: ParcelSize.GROS,
    poids: 22,
    description: 'Matériel électronique',
    nomDestinataire: 'Lyna Hadji',
    telephoneDestinataire: '0555234567',
    prixClient: 2800,
    commissionPlatform: 280,
    commissionRelais: 200,
    netTransporteur: 2320,
    statutColis: ReservationStatus.RECU_RELAIS,
    dateCreation: new Date('2024-03-04T14:00:00'),
    datePaiement: new Date('2024-03-04T14:30:00'),
    dateRecuRelais: new Date('2024-03-06T10:00:00'),
    dateLivraison: undefined,
    paymentMethod: PaymentMethod.D17,
    paymentReference: 'D17-20240304-003',
    isPaid: true,
    client: mockUsers[4],
    transporteur: mockUsers[5],
    relais: mockRelais[0],
    ligne: mockLines[2],
    trackingHistory: []
  },
  {
    id: '4',
    clientId: '5',
    transporteurId: undefined,
    relaisId: undefined,
    ligneId: '7',
    formatColis: ParcelSize.MOYEN,
    poids: 12,
    description: 'Produits alimentaires',
    nomDestinataire: 'Nadia Kaci',
    telephoneDestinataire: '0555678901',
    prixClient: 900,
    commissionPlatform: 90,
    commissionRelais: 120,
    netTransporteur: 690,
    statutColis: ReservationStatus.EN_ATTENTE,
    dateCreation: new Date('2024-03-07T11:00:00'),
    datePaiement: undefined,
    dateRecuRelais: undefined,
    dateLivraison: undefined,
    isPaid: false,
    client: mockUsers[4],
    ligne: mockLines[6],
    trackingHistory: []
  },
  {
    id: '5',
    clientId: '1',
    transporteurId: '6',
    relaisId: '3',
    ligneId: '4',
    formatColis: ParcelSize.PETIT,
    poids: 4.5,
    description: 'Cadeau d\'anniversaire',
    nomDestinataire: 'Yasmine Boudiaf',
    telephoneDestinataire: '0555567890',
    prixClient: 1000,
    commissionPlatform: 100,
    commissionRelais: 80,
    netTransporteur: 820,
    statutColis: ReservationStatus.PAYE,
    dateCreation: new Date('2024-03-06T16:00:00'),
    datePaiement: new Date('2024-03-06T16:15:00'),
    dateRecuRelais: undefined,
    dateLivraison: undefined,
    paymentMethod: PaymentMethod.MOBILIS,
    paymentReference: 'MOB-20240306-005',
    isPaid: true,
    client: mockUsers[0],
    transporteur: mockUsers[5],
    relais: mockRelais[2],
    ligne: mockLines[3],
    trackingHistory: []
  }
];

// Fonction utilitaire pour calculer les commissions
export function calculerCommissions(
  prixClient: number, 
  commissionRelais: number, 
  pourcentagePlatform: number = 10
) {
  const commissionPlatform = prixClient * (pourcentagePlatform / 100);
  const netTransporteur = prixClient - commissionPlatform - commissionRelais;
  
  return {
    commissionPlatform: Math.round(commissionPlatform),
    commissionRelais,
    netTransporteur: Math.round(netTransporteur)
  };
}

// Fonction pour obtenir le prix selon le format
export function getPrixParFormat(line: Line, format: ParcelSize): number {
  switch (format) {
    case ParcelSize.PETIT:
      return line.tarifPetit;
    case ParcelSize.MOYEN:
      return line.tarifMoyen;
    case ParcelSize.GROS:
      return line.tarifGros;
    default:
      return line.tarifPetit;
  }
}

// Fonction pour obtenir la commission relais selon le format
export function getCommissionRelais(relais: Relais, format: ParcelSize): number {
  switch (format) {
    case ParcelSize.PETIT:
      return relais.commissionPetit;
    case ParcelSize.MOYEN:
      return relais.commissionMoyen;
    case ParcelSize.GROS:
      return relais.commissionGros;
    default:
      return relais.commissionPetit;
  }
}

// Fonction pour calculer la moyenne des évaluations
export function calculateAverageRating(reviews: Review[]): number {
  if (!reviews || reviews.length === 0) return 0;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

// Fonction pour formater une date
export function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Fonction pour formater un montant
export function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR') + ' DA';
}
