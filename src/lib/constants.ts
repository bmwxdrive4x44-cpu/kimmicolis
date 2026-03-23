export const WILAYAS = [
  { id: 'alger', name: 'Alger', nameAr: 'الجزائر' },
  { id: 'oran', name: 'Oran', nameAr: 'وهران' },
  { id: 'constantine', name: 'Constantine', nameAr: 'قسنطينة' },
  { id: 'annaba', name: 'Annaba', nameAr: 'عنابة' },
  { id: 'blida', name: 'Blida', nameAr: 'البليدة' },
  { id: 'setif', name: 'Sétif', nameAr: 'سطيف' },
  { id: 'tizi_ouzou', name: 'Tizi Ouzou', nameAr: 'تيزي وزو' },
  { id: 'bejaia', name: 'Béjaïa', nameAr: 'بجاية' },
  { id: 'chlef', name: 'Chlef', nameAr: 'الشلف' },
  { id: 'tlemcen', name: 'Tlemcen', nameAr: 'تلمسان' },
  { id: 'ouargla', name: 'Ouargla', nameAr: 'ورقلة' },
  { id: 'ghardaia', name: 'Ghardaïa', nameAr: 'غرداية' },
  { id: 'biskra', name: 'Biskra', nameAr: 'بسكرة' },
  { id: 'djelfa', name: 'Djelfa', nameAr: 'الجلفة' },
  { id: 'medea', name: 'Médéa', nameAr: 'المدية' },
  { id: 'tiaret', name: 'Tiaret', nameAr: 'تيارت' },
  { id: 'sidi_bel_abbes', name: 'Sidi Bel Abbès', nameAr: 'سيدي بلعباس' },
  { id: 'batna', name: 'Batna', nameAr: 'باتنة' },
  { id: 'skikda', name: 'Skikda', nameAr: 'سكيكدة' },
  { id: 'mostaganem', name: 'Mostaganem', nameAr: 'مستغانم' },
  { id: 'tbessa', name: 'Tébessa', nameAr: 'تبسة' },
  { id: 'jijel', name: 'Jijel', nameAr: 'جيجل' },
  { id: 'guelma', name: 'Guelma', nameAr: 'قالمة' },
  { id: 'el_tarf', name: 'El Tarf', nameAr: 'الطارف' },
  { id: 'khenchela', name: 'Khenchela', nameAr: 'خنشلة' },
  { id: 'mila', name: 'Mila', nameAr: 'ميلة' },
  { id: 'souk_ahras', name: 'Souk Ahras', nameAr: 'سوق أهراس' },
  { id: 'tissemsilt', name: 'Tissemsilt', nameAr: 'تيسمسيلت' },
  { id: 'tipaza', name: 'Tipaza', nameAr: 'تيبازة' },
  { id: 'ain_defla', name: 'Aïn Defla', nameAr: 'عين الدفلى' },
  { id: 'naama', name: 'Naâma', nameAr: 'النعامة' },
  { id: 'el_bayadh', name: 'El Bayadh', nameAr: 'البيض' },
  { id: 'timimoun', name: 'Timimoun', nameAr: 'تيميمون' },
  { id: 'beni_abbes', name: 'Béni Abbès', nameAr: 'بني عباس' },
  { id: 'adrar', name: 'Adrar', nameAr: 'أدرار' },
  { id: 'tamanrasset', name: 'Tamanrasset', nameAr: 'تمنراست' },
  { id: 'djanet', name: 'Djanet', nameAr: 'جانت' },
  { id: 'inz_guezzam', name: 'In Guezzam', nameAr: 'عين قزام' },
  { id: 'tougourt', name: 'Touggourt', nameAr: 'تقرت' },
  { id: 'el_menia', name: 'El Meniaa', nameAr: 'المنيعة' },
  { id: 'el_oued', name: 'El Oued', nameAr: 'الوادي' },
  { id: 'laghouat', name: 'Laghouat', nameAr: 'الأغواط' },
  { id: 'msila', name: 'M\'Sila', nameAr: 'المسيلة' },
  { id: 'saida', name: 'Saïda', nameAr: 'سعيدة' },
  { id: 'mascara', name: 'Mascara', nameAr: 'معسكر' },
  { id: 'relizane', name: 'Relizane', nameAr: 'غليزان' },
  { id: 'ain_temouchent', name: 'Aïn Témouchent', nameAr: 'عين تموشنت' },
  { id: 'bordj_bou_arreridj', name: 'Bordj Bou Arréridj', nameAr: 'برج بوعريريج' },
  { id: 'boumerdes', name: 'Boumerdès', nameAr: 'بومرداس' },
  { id: 'oum_el_bouaghi', name: 'Oum El Bouaghi', nameAr: 'أم البواقي' },
];

export const PARCEL_FORMATS = [
  { id: 'PETIT', label: 'Petit', labelEn: 'Small', labelAr: 'صغير', dimensions: '30x20x10 cm', multiplier: 1 },
  { id: 'MOYEN', label: 'Moyen', labelEn: 'Medium', labelAr: 'متوسط', dimensions: '50x30x20 cm', multiplier: 1.5 },
  { id: 'GROS', label: 'Gros', labelEn: 'Large', labelAr: 'كبير', dimensions: '70x50x30 cm', multiplier: 2 },
];

export const PARCEL_STATUS = [
  // New workflow statuses (MVP)
  { id: 'CREATED', label: 'Créé', labelEn: 'Created', labelAr: 'تم الإنشاء', color: 'bg-gray-500' },
  { id: 'PAID_RELAY', label: 'Payé au relais', labelEn: 'Paid at Relay', labelAr: 'مدفوع في نقطة التوصيل', color: 'bg-blue-500' },
  { id: 'DEPOSITED_RELAY', label: 'Déposé au relais', labelEn: 'Deposited at Relay', labelAr: 'مودع في نقطة التوصيل', color: 'bg-yellow-600' },
  { id: 'ASSIGNED', label: 'Assigné transporteur', labelEn: 'Assigned to Transporter', labelAr: 'مُعيَّن للناقل', color: 'bg-purple-500' },
  { id: 'PICKED_UP', label: 'Pris en charge', labelEn: 'Picked Up', labelAr: 'تم الاستلام', color: 'bg-orange-500' },
  { id: 'ARRIVED_RELAY', label: 'Arrivé relais destination', labelEn: 'Arrived at Destination Relay', labelAr: 'وصل نقطة الوصول', color: 'bg-teal-500' },
  { id: 'DELIVERED', label: 'Livré', labelEn: 'Delivered', labelAr: 'تم التسليم', color: 'bg-emerald-600' },
  { id: 'CANCELLED', label: 'Annulé', labelEn: 'Cancelled', labelAr: 'ملغى', color: 'bg-red-500' },
  // Legacy statuses (backward compatibility)
  { id: 'PAID', label: 'Payé (legacy)', labelEn: 'Paid', labelAr: 'مدفوع', color: 'bg-blue-400' },
  { id: 'RECU_RELAIS', label: 'Reçu au relais (legacy)', labelEn: 'Received at Relay', labelAr: 'استُلم في نقطة التوصيل', color: 'bg-yellow-400' },
  { id: 'EN_TRANSPORT', label: 'En transport (legacy)', labelEn: 'In Transit', labelAr: 'قيد النقل', color: 'bg-orange-400' },
  { id: 'ARRIVE_RELAIS_DESTINATION', label: 'Arrivé relais (legacy)', labelEn: 'Arrived at Relay', labelAr: 'وصل لنقطة التوصيل', color: 'bg-teal-400' },
  { id: 'LIVRE', label: 'Livré (legacy)', labelEn: 'Delivered', labelAr: 'تم التوصيل', color: 'bg-emerald-500' },
  { id: 'ANNULE', label: 'Annulé (legacy)', labelEn: 'Cancelled', labelAr: 'ملغى', color: 'bg-red-400' },
  { id: 'RETOUR', label: 'Retour', labelEn: 'Return', labelAr: 'عودة', color: 'bg-pink-500' },
  { id: 'EN_DISPUTE', label: 'En litige', labelEn: 'In Dispute', labelAr: 'في نزاع', color: 'bg-red-600' },
];

/** Active (non-terminal) statuses in the new workflow */
export const ACTIVE_PARCEL_STATUSES = [
  'CREATED', 'PAID_RELAY', 'DEPOSITED_RELAY', 'ASSIGNED', 'PICKED_UP', 'ARRIVED_RELAY',
];

/** Ordered steps for the new workflow (used in status badge/timeline) */
export const PARCEL_WORKFLOW_STEPS = [
  { status: 'CREATED', step: 1, label: 'Colis créé' },
  { status: 'PAID_RELAY', step: 2, label: 'Cash encaissé' },
  { status: 'DEPOSITED_RELAY', step: 3, label: 'Déposé au relais' },
  { status: 'ASSIGNED', step: 4, label: 'Transporteur assigné' },
  { status: 'PICKED_UP', step: 5, label: 'Pris en charge' },
  { status: 'ARRIVED_RELAY', step: 6, label: 'Arrivé destination' },
  { status: 'DELIVERED', step: 7, label: 'Livré' },
];

/** Relay auto-block threshold in DA */
export const RELAY_BLOCK_THRESHOLD_DA = 50000;

export const TRAJET_STATUS = [
  { id: 'PROGRAMME', label: 'Programmé', labelEn: 'Scheduled', labelAr: 'مجدول', color: 'bg-blue-500' },
  { id: 'EN_COURS', label: 'En cours', labelEn: 'In Progress', labelAr: 'جارٍ', color: 'bg-orange-500' },
  { id: 'TERMINE', label: 'Terminé', labelEn: 'Completed', labelAr: 'منتهٍ', color: 'bg-green-500' },
  { id: 'ANNULE', label: 'Annulé', labelEn: 'Cancelled', labelAr: 'ملغى', color: 'bg-red-500' },
];

export const USER_ROLES = [
  { id: 'CLIENT', label: 'Client', labelEn: 'Client', labelAr: 'عميل' },
  { id: 'TRANSPORTER', label: 'Transporteur', labelEn: 'Transporter', labelAr: 'ناقل' },
  { id: 'RELAIS', label: 'Point relais', labelEn: 'Relay Point', labelAr: 'نقطة توصيل' },
  { id: 'ADMIN', label: 'Administrateur', labelEn: 'Administrator', labelAr: 'مدير' },
];

export const RELAIS_STATUS = [
  { id: 'PENDING', label: 'En attente', labelEn: 'Pending', labelAr: 'في الانتظار', color: 'bg-yellow-500' },
  { id: 'APPROVED', label: 'Approuvé', labelEn: 'Approved', labelAr: 'موافق عليه', color: 'bg-green-500' },
  { id: 'REJECTED', label: 'Rejeté', labelEn: 'Rejected', labelAr: 'مرفوض', color: 'bg-red-500' },
];

export const PLATFORM_COMMISSION = 0.10; // 10%
export const DEFAULT_RELAY_COMMISSION = {
  PETIT: 100,
  MOYEN: 200,
  GROS: 300,
};

export const DEFAULT_TARIFFS: Record<string, { PETIT: number; MOYEN: number; GROS: number }> = {
  'alger-oran': { PETIT: 500, MOYEN: 750, GROS: 1000 },
  'alger-constantine': { PETIT: 600, MOYEN: 900, GROS: 1200 },
  'alger-annaba': { PETIT: 650, MOYEN: 975, GROS: 1300 },
  'alger-blida': { PETIT: 200, MOYEN: 300, GROS: 400 },
  'alger-setif': { PETIT: 550, MOYEN: 825, GROS: 1100 },
  'alger-tizi_ouzou': { PETIT: 350, MOYEN: 525, GROS: 700 },
  'alger-bejaia': { PETIT: 400, MOYEN: 600, GROS: 800 },
  'oran-tlemcen': { PETIT: 300, MOYEN: 450, GROS: 600 },
  'constantine-batna': { PETIT: 200, MOYEN: 300, GROS: 400 },
  'setif-batna': { PETIT: 250, MOYEN: 375, GROS: 500 },
  'default': { PETIT: 400, MOYEN: 600, GROS: 800 },
};

export function getTariff(villeDepart: string, villeArrivee: string, format: string): number {
  const key = `${villeDepart}-${villeArrivee}`.toLowerCase();
  const reverseKey = `${villeArrivee}-${villeDepart}`.toLowerCase();
  
  const tariffs = DEFAULT_TARIFFS[key] || DEFAULT_TARIFFS[reverseKey] || DEFAULT_TARIFFS.default;
  
  return tariffs[format as keyof typeof tariffs] || tariffs.PETIT;
}

export function generateTrackingNumber(): string {
  const prefix = 'SC';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

export function generateQRData(trackingNumber: string): string {
  return JSON.stringify({
    tracking: trackingNumber,
    platform: 'SwiftColis',
    generated: new Date().toISOString(),
  });
}
