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
  { id: 'CREATED',                    label: 'Créé',                    labelEn: 'Created',               labelAr: 'تم الإنشاء',            color: 'bg-gray-500',    step: 1 },
  { id: 'PAID_RELAY',                 label: 'Paiement validé (relais)', labelEn: 'Payment validated',     labelAr: 'تم التحقق من الدفع',    color: 'bg-blue-500',    step: 2 },
  { id: 'DEPOSITED_RELAY',            label: 'Déposé au relais',         labelEn: 'Deposited at relay',    labelAr: 'تم الإيداع في النقطة',  color: 'bg-yellow-500',  step: 3 },
  { id: 'EN_TRANSPORT',               label: 'En transport',             labelEn: 'In Transit',            labelAr: 'قيد النقل',             color: 'bg-orange-500',  step: 4 },
  { id: 'ARRIVE_RELAIS_DESTINATION',  label: 'Arrivé au relais',         labelEn: 'Arrived at Relay',      labelAr: 'وصل لنقطة التوصيل',     color: 'bg-teal-500',    step: 5 },
  { id: 'LIVRE',                      label: 'Livré',                    labelEn: 'Delivered',             labelAr: 'تم التوصيل',            color: 'bg-emerald-600', step: 6 },
  // Legacy / compat
  { id: 'PAID',       label: 'Payé (en ligne)',  labelEn: 'Paid',       labelAr: 'مدفوع',  color: 'bg-blue-400',  step: 2 },
  { id: 'RECU_RELAIS',label: 'Reçu au relais',   labelEn: 'Received',   labelAr: 'مستلم',  color: 'bg-yellow-400',step: 3 },
  // Terminal statuses
  { id: 'ANNULE',     label: 'Annulé',           labelEn: 'Cancelled',  labelAr: 'ملغى',   color: 'bg-red-500',   step: 0 },
  { id: 'RETOUR',     label: 'Retour',            labelEn: 'Return',     labelAr: 'عودة',   color: 'bg-pink-500',  step: 0 },
  { id: 'EN_DISPUTE', label: 'En litige',         labelEn: 'In Dispute', labelAr: 'في نزاع',color: 'bg-red-600',   step: 0 },
];

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

// ─── MVP Workflow helpers ──────────────────────────────────────────────────────

/** Ordered status transitions for the MVP workflow */
export const PARCEL_STATUS_FLOW: Record<string, string | null> = {
  CREATED:                    'PAID_RELAY',
  PAID_RELAY:                 'DEPOSITED_RELAY',
  DEPOSITED_RELAY:            'EN_TRANSPORT',
  EN_TRANSPORT:               'ARRIVE_RELAIS_DESTINATION',
  ARRIVE_RELAIS_DESTINATION:  'LIVRE',
  LIVRE:                      null,
  ANNULE:                     null,
  RETOUR:                     null,
  EN_DISPUTE:                 null,
};

/** Who is responsible for each status transition */
export const PARCEL_STATUS_ACTOR: Record<string, string> = {
  PAID_RELAY:                'RELAIS',
  DEPOSITED_RELAY:           'RELAIS',
  EN_TRANSPORT:              'TRANSPORTER',
  ARRIVE_RELAIS_DESTINATION: 'RELAIS',
  LIVRE:                     'RELAIS',
};

/** Human-readable label for each QR scan action */
export const QR_ACTION_LABELS: Record<string, { fr: string; en: string }> = {
  validate_payment:  { fr: 'Valider le paiement cash',       en: 'Validate cash payment' },
  deposit:           { fr: 'Confirmer le dépôt du colis',    en: 'Confirm parcel deposit' },
  pickup:            { fr: 'Prise en charge par transporteur', en: 'Transporter pickup' },
  arrive_dest:       { fr: 'Arrivée au relais destination',  en: 'Arrived at destination relay' },
  deliver:           { fr: 'Remis au client',                en: 'Delivered to client' },
};

/** Minimum cash threshold before auto-block alert (in DZD) */
export const RELAY_CASH_ALERT_THRESHOLD = 50000;
