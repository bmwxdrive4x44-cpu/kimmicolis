export interface DistanceCoefficientRule {
  maxDistanceKm: number;
  coefficient: number;
}

export interface DynamicParcelPricingInput {
  weightKg: number;
  distanceKm: number;
  adminFee: number;
  ratePerKg: number;
  ratePerKm: number;
  formatMultiplier?: number;
  distanceRules?: DistanceCoefficientRule[];
  relayDepartureCommissionRate?: number;
  relayArrivalCommissionRate?: number;
  platformMarginRate?: number;
  roundTo?: number;
}

export interface DynamicParcelPricingResult {
  weightKg: number;
  distanceKm: number;
  distanceCoefficient: number;
  costByWeight: number;
  costByDistance: number;
  transportCost: number;
  adminFee: number;
  relayDepartureCommission: number;
  relayArrivalCommission: number;
  relayCommissionTotal: number;
  platformMargin: number;
  clientPrice: number;
  netTransporteur: number;
}

type WilayaCoord = { lat: number; lng: number };

const WILAYA_COORDS: Record<string, WilayaCoord> = {
  alger: { lat: 36.7538, lng: 3.0588 },
  oran: { lat: 35.6971, lng: -0.6308 },
  constantine: { lat: 36.365, lng: 6.6147 },
  annaba: { lat: 36.9, lng: 7.7667 },
  blida: { lat: 36.4704, lng: 2.8277 },
  setif: { lat: 36.19, lng: 5.41 },
  tizi_ouzou: { lat: 36.7169, lng: 4.0497 },
  bejaia: { lat: 36.7515, lng: 5.0557 },
  chlef: { lat: 36.1667, lng: 1.3333 },
  tlemcen: { lat: 34.8783, lng: -1.315 },
  ouargla: { lat: 31.9522, lng: 5.3225 },
  ghardaia: { lat: 32.49, lng: 3.67 },
  biskra: { lat: 34.85, lng: 5.73 },
  djelfa: { lat: 34.67, lng: 3.25 },
  medea: { lat: 36.2642, lng: 2.7539 },
  tiaret: { lat: 35.371, lng: 1.316 },
  batna: { lat: 35.556, lng: 6.174 },
  skikda: { lat: 36.8667, lng: 6.9 },
  mostaganem: { lat: 35.9398, lng: 0.0898 },
  laghouat: { lat: 33.8, lng: 2.88 },
  el_oued: { lat: 33.3678, lng: 6.8515 },
  tougourt: { lat: 33.1, lng: 6.06 },
  adrar: { lat: 27.8743, lng: -0.2939 },
  tamanrasset: { lat: 22.785, lng: 5.5228 },
};

export const DEFAULT_DISTANCE_RULES: DistanceCoefficientRule[] = [
  { maxDistanceKm: 50, coefficient: 1 },
  { maxDistanceKm: 200, coefficient: 1.05 },
  { maxDistanceKm: 500, coefficient: 1.12 },
  { maxDistanceKm: Infinity, coefficient: 1.2 },
];

export function getDistanceCoefficient(distanceKm: number, rules: DistanceCoefficientRule[] = DEFAULT_DISTANCE_RULES): number {
  const normalizedDistance = Math.max(0, distanceKm);
  const sortedRules = [...rules].sort((a, b) => a.maxDistanceKm - b.maxDistanceKm);
  const matchedRule = sortedRules.find((rule) => normalizedDistance <= rule.maxDistanceKm);
  return matchedRule?.coefficient ?? 1;
}

function roundAmount(value: number, roundTo: number): number {
  if (roundTo <= 1) return Math.round(value);
  return Math.ceil(value / roundTo) * roundTo;
}

export function calculateDynamicParcelPricing(input: DynamicParcelPricingInput): DynamicParcelPricingResult {
  const {
    weightKg,
    distanceKm,
    adminFee,
    ratePerKg,
    ratePerKm,
    formatMultiplier = 1,
    distanceRules = DEFAULT_DISTANCE_RULES,
    relayDepartureCommissionRate = 0.1,
    relayArrivalCommissionRate = 0.1,
    platformMarginRate = 0,
    roundTo = 10,
  } = input;

  const safeWeightKg = Math.max(0, weightKg);
  const safeDistanceKm = Math.max(0, distanceKm);
  const safeFormatMultiplier = Math.max(0.5, formatMultiplier);

  const distanceCoefficient = getDistanceCoefficient(safeDistanceKm, distanceRules);
  const costByWeight = safeWeightKg * ratePerKg * safeFormatMultiplier;
  const costByDistance = safeDistanceKm * ratePerKm;
  const transportCostRaw = (costByWeight + costByDistance) * distanceCoefficient;
  const transportCost = roundAmount(transportCostRaw, roundTo);

  const relayDepartureCommissionRaw = transportCost * relayDepartureCommissionRate;
  const relayArrivalCommissionRaw = transportCost * relayArrivalCommissionRate;
  const relayDepartureCommission = roundAmount(relayDepartureCommissionRaw, roundTo);
  const relayArrivalCommission = roundAmount(relayArrivalCommissionRaw, roundTo);
  const relayCommissionTotal = relayDepartureCommission + relayArrivalCommission;

  const platformMarginRaw = adminFee + transportCost * platformMarginRate;
  const platformMargin = roundAmount(platformMarginRaw, roundTo);

  const clientPrice = transportCost + relayCommissionTotal + platformMargin;

  return {
    weightKg: safeWeightKg,
    distanceKm: safeDistanceKm,
    distanceCoefficient,
    costByWeight,
    costByDistance,
    transportCost,
    adminFee,
    relayDepartureCommission,
    relayArrivalCommission,
    relayCommissionTotal,
    platformMargin,
    clientPrice,
    netTransporteur: transportCost,
  };
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function estimateDistanceKmByWilayas(villeDepart: string, villeArrivee: string): number {
  if (!villeDepart || !villeArrivee) return 150;
  if (villeDepart === villeArrivee) return 10;

  const from = WILAYA_COORDS[villeDepart];
  const to = WILAYA_COORDS[villeArrivee];
  if (!from || !to) return 250;

  const earthRadiusKm = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  const greatCircleKm = 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Majoration simple pour refléter la distance routière vs distance à vol d'oiseau
  return Math.max(10, Math.round(greatCircleKm * 1.2));
}