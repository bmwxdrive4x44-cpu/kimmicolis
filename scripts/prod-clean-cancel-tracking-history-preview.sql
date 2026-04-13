-- Preview (read-only) du nettoyage historique ANNULE
-- Cible: PostgreSQL
-- Usage (exemple): psql "$DATABASE_URL" -f scripts/prod-clean-cancel-tracking-history-preview.sql

-- A) Combien d'evenements incoherents ANNULE + "modification avant paiement" ?
SELECT COUNT(*) AS cancel_with_edit_notes_count
FROM "TrackingHistory"
WHERE status = 'ANNULE'
  AND notes IS NOT NULL
  AND (
    notes ILIKE '%modifi%avant paiement%'
    OR notes ILIKE '%modifie%avant paiement%'
    OR notes ILIKE '%modifiees avant paiement%'
  );

-- B) Combien d'evenements ANNULE de suppression existent au total ?
SELECT COUNT(*) AS cancel_delete_events_total
FROM "TrackingHistory"
WHERE status = 'ANNULE'
  AND notes IS NOT NULL
  AND (
    notes ILIKE 'Suppression demandee: colis annule%'
    OR notes ILIKE 'Suppression demandée: colis annulé%'
    OR notes ILIKE '%fallback%erreur de suppression%'
    OR notes ILIKE '%suppression physique bloquee%'
  );

-- C) Combien seront supprimes par deduplication (on garde le plus ancien par colis) ?
WITH cancel_events AS (
  SELECT
    id,
    "colisId",
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
SELECT COUNT(*) AS cancel_delete_events_to_remove
FROM cancel_events
WHERE rn > 1;

-- D) Echantillon des lignes qui seront supprimees par deduplication
WITH cancel_events AS (
  SELECT
    id,
    "colisId",
    status,
    notes,
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
SELECT id, "colisId", status, notes, "createdAt"
FROM cancel_events
WHERE rn > 1
ORDER BY "colisId", "createdAt" ASC
LIMIT 50;

-- E) Echantillon des lignes dont la note sera normalisee
SELECT id, "colisId", status, notes, "createdAt"
FROM "TrackingHistory"
WHERE status = 'ANNULE'
  AND notes IS NOT NULL
  AND (
    notes ILIKE 'Suppression demandee: colis annule%'
    OR notes ILIKE 'Suppression demandée: colis annulé%'
    OR notes ILIKE '%fallback%erreur de suppression%'
    OR notes ILIKE '%suppression physique bloquee%'
  )
ORDER BY "createdAt" DESC
LIMIT 50;
