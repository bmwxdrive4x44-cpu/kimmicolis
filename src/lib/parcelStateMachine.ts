export type CanonicalParcelState =
  | 'CREATED'
  | 'PENDING_PAYMENT'
  | 'READY_FOR_DEPOSIT'
  | 'DEPOSITED_RELAY'
  | 'PICKED_UP'
  | 'IN_TRANSIT'
  | 'ARRIVED_RELAY';

type TransitionTarget = CanonicalParcelState | 'DELIVERED';

export const transitions: Record<CanonicalParcelState, TransitionTarget[]> = {
  CREATED: ['PENDING_PAYMENT'],
  PENDING_PAYMENT: ['READY_FOR_DEPOSIT', 'CREATED'],
  READY_FOR_DEPOSIT: ['DEPOSITED_RELAY'],
  DEPOSITED_RELAY: ['PICKED_UP'],
  PICKED_UP: ['IN_TRANSIT'],
  IN_TRANSIT: ['ARRIVED_RELAY'],
  ARRIVED_RELAY: ['DELIVERED'],
};

const dbToCanonical: Record<string, CanonicalParcelState | 'DELIVERED'> = {
  CREATED: 'CREATED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  READY_FOR_DEPOSIT: 'READY_FOR_DEPOSIT',
  DEPOSITED_RELAY: 'DEPOSITED_RELAY',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'IN_TRANSIT',
  EN_TRANSPORT: 'IN_TRANSIT',
  ARRIVED_RELAY: 'ARRIVED_RELAY',
  ARRIVE_RELAIS_DESTINATION: 'ARRIVED_RELAY',
  DELIVERED: 'DELIVERED',
  LIVRE: 'DELIVERED',
};

const canonicalToDb: Record<CanonicalParcelState | 'DELIVERED', string> = {
  CREATED: 'CREATED',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  READY_FOR_DEPOSIT: 'READY_FOR_DEPOSIT',
  DEPOSITED_RELAY: 'DEPOSITED_RELAY',
  PICKED_UP: 'PICKED_UP',
  IN_TRANSIT: 'EN_TRANSPORT',
  ARRIVED_RELAY: 'ARRIVE_RELAIS_DESTINATION',
  DELIVERED: 'LIVRE',
};

function asCanonical(state: string): CanonicalParcelState | 'DELIVERED' {
  return dbToCanonical[state] || (state as CanonicalParcelState | 'DELIVERED');
}

export function toDbState(state: CanonicalParcelState | 'DELIVERED'): string {
  return canonicalToDb[state] || state;
}

export function canTransition(fromState: string, toState: string): boolean {
  const from = asCanonical(fromState);
  const to = asCanonical(toState);

  if (from === 'DELIVERED') return false;

  const allowed = transitions[from as CanonicalParcelState] || [];
  return allowed.includes(to as CanonicalParcelState);
}

export function assertTransition(fromState: string, toState: string): void {
  if (!canTransition(fromState, toState)) {
    throw new Error(`Invalid parcel transition: ${fromState} -> ${toState}`);
  }
}

export function applyTransition(fromState: string, toState: string): string {
  assertTransition(fromState, toState);
  return toDbState(asCanonical(toState));
}
