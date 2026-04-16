export type EventAggregateType = 'parcel' | 'mission' | 'relais' | 'financial';

export type DomainEventType =
  | 'PARCEL_DEPOSITED'
  | 'PARCEL_PICKED_UP'
  | 'PARCEL_IN_TRANSIT'
  | 'PARCEL_ARRIVED_RELAY'
  | 'PARCEL_DELIVERED'
  | 'MISSION_ASSIGNED'
  | 'MISSION_ACCEPTED'
  | 'MISSION_COMPLETED'
  | 'REVENUE_EARNED'
  | 'CASH_COLLECTED'
  | 'COMMISSION_ALLOCATED'
  | 'RELAY_STOCK_INCREASED'
  | 'RELAY_STOCK_DECREASED';

export type DomainEventInput = {
  type: DomainEventType;
  aggregateType: EventAggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
};

export type DomainEventRecord = DomainEventInput & {
  id: string;
  createdAt: Date;
};
