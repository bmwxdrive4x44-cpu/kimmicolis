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