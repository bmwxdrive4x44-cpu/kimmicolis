SELECT 'Mission PICKED_UP'   AS label, COUNT(*)::text AS cnt FROM "Mission" WHERE status = 'PICKED_UP'
UNION ALL
SELECT 'Mission COMPLETED',  COUNT(*)::text FROM "Mission" WHERE status = 'COMPLETED'
UNION ALL
SELECT 'Colis RECU_RELAIS',  COUNT(*)::text FROM "Colis" WHERE status = 'RECU_RELAIS'
UNION ALL
SELECT 'Colis WAITING_PICKUP', COUNT(*)::text FROM "Colis" WHERE status = 'WAITING_PICKUP'
UNION ALL
SELECT 'Colis ASSIGNED',     COUNT(*)::text FROM "Colis" WHERE status = 'ASSIGNED';
