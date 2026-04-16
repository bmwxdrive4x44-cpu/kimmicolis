-- Migration: normalise les statuts legacy en DB pour les aligner sur la machine d'état.
-- Idempotente : sans effet si déjà appliquée.

-- Missions
UPDATE "Mission" SET status = 'EN_COURS' WHERE status = 'PICKED_UP';
UPDATE "Mission" SET status = 'LIVRE'   WHERE status = 'COMPLETED';

-- Colis
UPDATE "Colis" SET status = 'DEPOSITED_RELAY'
  WHERE status IN ('RECU_RELAIS', 'WAITING_PICKUP', 'ASSIGNED');
