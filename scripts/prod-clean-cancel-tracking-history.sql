-- Cleanup historique ANNULE bruite (doublons + ancien message fallback)
-- Cible: PostgreSQL
-- Usage (exemple): psql "$DATABASE_URL" -f scripts/prod-clean-cancel-tracking-history.sql

BEGIN;

-- 1) Supprimer les evenements incoherents "modification avant paiement"
--    qui ont ete traces avec status ANNULE.
DELETE FROM "TrackingHistory"
WHERE status = 'ANNULE'
  AND notes IS NOT NULL
  AND (
    notes ILIKE '%modifi%avant paiement%'
    OR notes ILIKE '%modifie%avant paiement%'
    OR notes ILIKE '%modifiees avant paiement%'
  );

-- 2) Dedupliquer les evenements ANNULE lies a une suppression demandee.
--    On garde le plus ancien par colis.
WITH cancel_events AS (
  SELECT
    id,
    "colisId",
    "createdAt",
    ROW_NUMBER() OVER (
      PARTITION BY "colisId"
      ORDER BY "createdAt" ASC, id ASC
    ) AS rn
  FROM "TrackingHistory"
  WHERE status = 'ANNULE'
    AND notes IS NOT NULL
    AND (
      notes ILIKE 'Suppression demandee: colis annule%'
      OR notes ILIKE 'Suppression demandée: colis annulé%'
      OR notes ILIKE '%fallback%erreur de suppression%'
      OR notes ILIKE '%suppression physique bloquee%'
    )
)
DELETE FROM "TrackingHistory" t
USING cancel_events c
WHERE t.id = c.id
  AND c.rn > 1;

-- 3) Normaliser le message restant vers une formulation propre.
UPDATE "TrackingHistory"
SET notes = 'Suppression demandee: colis annule.'
WHERE status = 'ANNULE'
  AND notes IS NOT NULL
  AND (
    notes ILIKE 'Suppression demandee: colis annule%'
    OR notes ILIKE 'Suppression demandée: colis annulé%'
    OR notes ILIKE '%fallback%erreur de suppression%'
    OR notes ILIKE '%suppression physique bloquee%'
  );

COMMIT;
