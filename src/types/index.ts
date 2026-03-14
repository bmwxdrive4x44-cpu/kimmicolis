// Types pour la plateforme ColisWay

export const UserRole = {
  CLIENT: 'CLIENT',
  TRANSPORTEUR: 'TRANSPORTEUR',
  RELAIS: 'RELAIS',
  ADMIN: 'ADMIN'
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const ParcelSize = {
  PETIT: 'PETIT',
  MOYEN: 'MOYEN',
  GROS: 'GROS'
} as const;
export type ParcelSize = typeof ParcelSize[keyof typeof ParcelSize];

export const ReservationStatus = {
  EN_ATTENTE: 'EN_ATTENTE',
  PAYE: 'PAYE',
  EN_COURS: 'EN_COURS',
  RECU_RELAIS: 'RECU_RELAIS',
  LIVRE: 'LIVRE',
  ANNULE: 'ANNULE'
} as const;
export type ReservationStatus = typeof ReservationStatus[keyof typeof ReservationStatus];

export const RelayStatus = {
  EN_ATTENTE: 'EN_ATTENTE',
  VALIDE: 'VALIDE',
  REFUSE: 'REFUSE'
} as const;
export type RelayStatus = typeof RelayStatus[keyof typeof RelayStatus];

// Méthodes de paiement en Algérie
export const PaymentMethod = {
  CASH: 'CASH',
  CCP: 'CCP',
  BARIDI_MOB: 'BARIDI_MOB',
  D17: 'D17',
  MOBILIS: 'MOBILIS',
  DJEZZY: 'DJEZZY',
  OOREDOO: 'OOREDOO',
  CIB: 'CIB'
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export interface User {
  id: string;
  email: string;
  nom: string;
  prenom: string;
  telephone: string;
  role: UserRole;
  siret?: string;
  entreprise?: string;
  commerceNom?: string;
  adresse?: string;
  wilaya?: string;
  isActive: boolean;
  createdAt: Date;
}

export interface Line {
  id: string;
  villeDepart: string;
  villeArrivee: string;
  tarifPetit: number;
  tarifMoyen: number;
  tarifGros: number;
  isActive: boolean;
}

export interface Relais {
  id: string;
  userId: string;
  nom: string;
  adresse: string;
  wilaya: string;
  telephone: string;
  commissionPetit: number;
  commissionMoyen: number;
  commissionGros: number;
  statutValidation: RelayStatus;
  user?: User;
  // Évaluation
  rating?: number;
  totalReviews?: number;
  reviews?: Review[];
}

export interface Transporteur {
  id: string;
  userId: string;
  user?: User;
  siret: string;
  entreprise: string;
  vehiculeType?: string;
  disponible: boolean;
  // Évaluation
  rating?: number;
  totalReviews?: number;
  reviews?: Review[];
  totalMissions?: number;
  missionsReussies?: number;
}

export interface Review {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  targetId: string;
  targetType: 'TRANSPORTEUR' | 'RELAIS';
  rating: number;
  comment: string;
  createdAt: Date;
}

export interface Reservation {
  id: string;
  clientId: string;
  transporteurId?: string;
  relaisId?: string;
  ligneId: string;
  formatColis: ParcelSize;
  poids?: number;
  description?: string;
  nomDestinataire: string;
  telephoneDestinataire: string;
  prixClient: number;
  commissionPlatform: number;
  commissionRelais: number;
  netTransporteur: number;
  statutColis: ReservationStatus;
  dateCreation: Date;
  datePaiement?: Date;
  dateRecuRelais?: Date;
  dateLivraison?: Date;
  // Paiement
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  isPaid: boolean;
  // Relations
  client?: User;
  transporteur?: User;
  relais?: Relais;
  ligne?: Line;
  trackingHistory?: TrackingHistory[];
  // Évaluation
  clientReview?: Review;
  transporteurReview?: Review;
}

export interface TrackingHistory {
  id: string;
  reservationId: string;
  statut: ReservationStatus;
  commentaire?: string;
  date: Date;
}

export interface CommissionPlatform {
  id: string;
  pourcentage: number;
  isActive: boolean;
}

export interface DashboardStats {
  totalReservations: number;
  reservationsEnCours: number;
  reservationsLivrees: number;
  totalGains: number;
  colisAtraiter?: number;
}

export interface Notification {
  id: string;
  userId: string;
  titre: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

// Types pour les formulaires
export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  password: string;
  role: UserRole;
  // Transporteur
  siret?: string;
  entreprise?: string;
  // Relais
  commerceNom?: string;
  adresse?: string;
  wilaya?: string;
}

export interface ReservationFormData {
  ligneId: string;
  formatColis: ParcelSize;
  poids?: number;
  description?: string;
  nomDestinataire: string;
  telephoneDestinataire: string;
  relaisId?: string;
  paymentMethod?: PaymentMethod;
}

// Prix par format
export const PRIX_FORMAT: Record<ParcelSize, { label: string; poids: string }> = {
  [ParcelSize.PETIT]: { label: 'Petit', poids: 'Jusqu\'à 5kg' },
  [ParcelSize.MOYEN]: { label: 'Moyen', poids: '5kg - 15kg' },
  [ParcelSize.GROS]: { label: 'Gros', poids: '15kg - 30kg' }
};

// Labels des statuts
export const STATUS_LABELS: Record<ReservationStatus, string> = {
  [ReservationStatus.EN_ATTENTE]: 'En attente',
  [ReservationStatus.PAYE]: 'Payé',
  [ReservationStatus.EN_COURS]: 'En cours de livraison',
  [ReservationStatus.RECU_RELAIS]: 'Reçu au relais',
  [ReservationStatus.LIVRE]: 'Livré',
  [ReservationStatus.ANNULE]: 'Annulé'
};

// Couleurs des statuts
export const STATUS_COLORS: Record<ReservationStatus, string> = {
  [ReservationStatus.EN_ATTENTE]: 'bg-gray-100 text-gray-700 border-gray-300',
  [ReservationStatus.PAYE]: 'bg-blue-100 text-blue-700 border-blue-300',
  [ReservationStatus.EN_COURS]: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  [ReservationStatus.RECU_RELAIS]: 'bg-purple-100 text-purple-700 border-purple-300',
  [ReservationStatus.LIVRE]: 'bg-green-100 text-green-700 border-green-300',
  [ReservationStatus.ANNULE]: 'bg-red-100 text-red-700 border-red-300'
};

// Labels des méthodes de paiement
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, { label: string; description: string; icon: string }> = {
  [PaymentMethod.CASH]: { 
    label: 'Paiement à la livraison', 
    description: 'Payez en espèces lors du retrait',
    icon: '💵'
  },
  [PaymentMethod.CCP]: { 
    label: 'CCP', 
    description: 'Paiement via compte postal',
    icon: '🏤'
  },
  [PaymentMethod.BARIDI_MOB]: { 
    label: 'BaridiMob', 
    description: 'Paiement via application BaridiMob',
    icon: '📱'
  },
  [PaymentMethod.D17]: { 
    label: 'D17', 
    description: 'Paiement via D17',
    icon: '💳'
  },
  [PaymentMethod.MOBILIS]: { 
    label: 'Mobilis', 
    description: 'Paiement via Mobilis',
    icon: '📲'
  },
  [PaymentMethod.DJEZZY]: { 
    label: 'Djezzy', 
    description: 'Paiement via Djezzy',
    icon: '📲'
  },
  [PaymentMethod.OOREDOO]: { 
    label: 'Ooredoo', 
    description: 'Paiement via Ooredoo',
    icon: '📲'
  },
  [PaymentMethod.CIB]: { 
    label: 'Carte CIB', 
    description: 'Paiement par carte bancaire',
    icon: '💳'
  }
};

// Liste des wilayas d'Algérie
export const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra', 'Béchar',
  'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret', 'Tizi Ouzou', 'Alger',
  'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda', 'Sidi Bel Abbès', 'Annaba', 'Guelma',
  'Constantine', 'Médéa', 'Mostaganem', 'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh',
  'Illizi', 'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt', 'El Oued',
  'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla', 'Naâma', 'Aïn Témouchent', 'Ghardaïa',
  'Relizane', 'Timimoun', 'Bordj Badji Mokhtar', 'Ouled Djellal', 'Béni Abbès', 'In Salah',
  'In Guezzam', 'Touggourt', 'Djanet', 'El M\'Ghair', 'El Meniaa'
];
