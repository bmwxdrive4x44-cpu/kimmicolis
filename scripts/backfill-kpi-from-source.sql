BEGIN;

TRUNCATE TABLE "KpiTransporter";
TRUNCATE TABLE "KpiEnseigne";
TRUNCATE TABLE "KpiRelais";

INSERT INTO "KpiTransporter" (
  "transporteurId",
  "missionsTotal",
  "missionsActive",
  "missionsAssigned",
  "missionsInProgress",
  "missionsCompleted",
  "earningsTotal",
  "createdAt",
  "updatedAt"
)
SELECT
  m."transporteurId",
  COUNT(*)::int AS "missionsTotal",
  SUM(CASE WHEN m.status IN ('ASSIGNE', 'EN_COURS', 'PICKED_UP') THEN 1 ELSE 0 END)::int AS "missionsActive",
  SUM(CASE WHEN m.status = 'ASSIGNE' THEN 1 ELSE 0 END)::int AS "missionsAssigned",
  SUM(CASE WHEN m.status IN ('EN_COURS', 'PICKED_UP') THEN 1 ELSE 0 END)::int AS "missionsInProgress",
  SUM(CASE WHEN m.status IN ('LIVRE', 'COMPLETED') THEN 1 ELSE 0 END)::int AS "missionsCompleted",
  COALESCE(SUM(CASE WHEN m.status IN ('LIVRE', 'COMPLETED') THEN COALESCE(c."netTransporteur", 0) ELSE 0 END), 0)::double precision AS "earningsTotal",
  NOW(),
  NOW()
FROM "Mission" m
LEFT JOIN "Colis" c ON c.id = m."colisId"
GROUP BY m."transporteurId";

INSERT INTO "KpiEnseigne" (
  "enseigneId",
  "parcelsTotal",
  "parcelsDelivered",
  "pendingPayment",
  "readyForDeposit",
  "inTransit",
  "arrivedRelay",
  "revenueDelivered",
  "revenueCommitted",
  "createdAt",
  "updatedAt"
)
SELECT
  c."clientId" AS "enseigneId",
  COUNT(*)::int AS "parcelsTotal",
  SUM(CASE WHEN c.status IN ('LIVRE', 'DELIVERED') THEN 1 ELSE 0 END)::int AS "parcelsDelivered",
  SUM(CASE WHEN c.status IN ('CREATED', 'PENDING_PAYMENT') THEN 1 ELSE 0 END)::int AS "pendingPayment",
  SUM(CASE WHEN c.status IN ('READY_FOR_DEPOSIT', 'PAID', 'PAID_RELAY') THEN 1 ELSE 0 END)::int AS "readyForDeposit",
  SUM(CASE WHEN c.status IN ('DEPOSITED_RELAY', 'RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED', 'PICKED_UP', 'EN_TRANSPORT', 'IN_TRANSIT') THEN 1 ELSE 0 END)::int AS "inTransit",
  SUM(CASE WHEN c.status IN ('ARRIVE_RELAIS_DESTINATION', 'ARRIVED_RELAY') THEN 1 ELSE 0 END)::int AS "arrivedRelay",
  COALESCE(SUM(CASE WHEN c.status IN ('LIVRE', 'DELIVERED') THEN COALESCE(c."prixClient", 0) ELSE 0 END), 0)::double precision AS "revenueDelivered",
  COALESCE(SUM(CASE WHEN c.status IN ('READY_FOR_DEPOSIT', 'PAID', 'PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED', 'PICKED_UP', 'EN_TRANSPORT', 'IN_TRANSIT', 'ARRIVE_RELAIS_DESTINATION', 'ARRIVED_RELAY', 'LIVRE', 'DELIVERED') THEN COALESCE(c."prixClient", 0) ELSE 0 END), 0)::double precision AS "revenueCommitted",
  NOW(),
  NOW()
FROM "Colis" c
GROUP BY c."clientId";

WITH relais_base AS (
  SELECT r.id AS "relaisId", COALESCE(r."cashCollected", 0) - COALESCE(r."cashReversed", 0) AS "cashOnHand"
  FROM "Relais" r
),
relais_states AS (
  SELECT
    r.id AS "relaisId",
    SUM(
      CASE
        WHEN c."relaisDepartId" = r.id AND c.status IN ('CREATED', 'PENDING_PAYMENT', 'READY_FOR_DEPOSIT', 'PAID', 'PAID_RELAY', 'DEPOSITED_RELAY', 'RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED') THEN 1
        WHEN c."relaisArriveeId" = r.id AND c.status IN ('ARRIVE_RELAIS_DESTINATION', 'ARRIVED_RELAY') THEN 1
        ELSE 0
      END
    )::int AS "pendingActions",
    SUM(CASE WHEN c."relaisDepartId" = r.id AND c.status IN ('DEPOSITED_RELAY', 'RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED') THEN 1 ELSE 0 END)::int AS "stockDeparture",
    SUM(CASE WHEN c."relaisArriveeId" = r.id AND c.status IN ('ARRIVE_RELAIS_DESTINATION', 'ARRIVED_RELAY') THEN 1 ELSE 0 END)::int AS "stockArrival",
    SUM(CASE WHEN c."relaisArriveeId" = r.id AND c.status IN ('LIVRE', 'DELIVERED') THEN 1 ELSE 0 END)::int AS "handoversCompleted",
    COALESCE(SUM(CASE WHEN c."relaisArriveeId" = r.id AND c.status IN ('LIVRE', 'DELIVERED') THEN COALESCE(c."commissionRelais", 0) ELSE 0 END), 0)::double precision AS "commissionsTotal"
  FROM "Relais" r
  LEFT JOIN "Colis" c ON c."relaisDepartId" = r.id OR c."relaisArriveeId" = r.id
  GROUP BY r.id
)
INSERT INTO "KpiRelais" (
  "relaisId",
  "pendingActions",
  "stockDeparture",
  "stockArrival",
  "handoversCompleted",
  "cashOnHand",
  "commissionsTotal",
  "createdAt",
  "updatedAt"
)
SELECT
  b."relaisId",
  COALESCE(s."pendingActions", 0),
  COALESCE(s."stockDeparture", 0),
  COALESCE(s."stockArrival", 0),
  COALESCE(s."handoversCompleted", 0),
  COALESCE(b."cashOnHand", 0),
  COALESCE(s."commissionsTotal", 0),
  NOW(),
  NOW()
FROM relais_base b
LEFT JOIN relais_states s ON s."relaisId" = b."relaisId";

COMMIT;
