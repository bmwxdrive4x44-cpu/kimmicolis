-- Delete demo accounts and all dependent records from prod
-- Safe: only targets @demo.dz and demo+* emails

DO $$
DECLARE
  demo_ids TEXT[];
BEGIN
  -- Collect demo user IDs
  SELECT ARRAY_AGG(id) INTO demo_ids
  FROM "User"
  WHERE lower(email) LIKE '%@demo.dz' OR lower(email) LIKE 'demo+%';

  IF demo_ids IS NULL OR array_length(demo_ids, 1) = 0 THEN
    RAISE NOTICE 'No demo accounts found. Nothing to delete.';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting % demo account(s)...', array_length(demo_ids, 1);

  -- Notifications
  DELETE FROM "Notification" WHERE "userId" = ANY(demo_ids);
  -- Password reset tokens
  DELETE FROM "PasswordResetToken" WHERE "userId" = ANY(demo_ids);
  -- Action logs
  DELETE FROM "ActionLog" WHERE "userId" = ANY(demo_ids);
  -- Contact messages (no userId FK — delete by demo email pattern)
  DELETE FROM "ContactMessage" WHERE lower(email) LIKE '%@demo.dz' OR lower(email) LIKE 'demo+%';
  -- Transporter penalties (uses transporteurId, not userId)
  DELETE FROM "TransporterPenalty" WHERE "transporteurId" = ANY(demo_ids);
  -- Transporter scores (uses transporteurId, not userId)
  DELETE FROM "TransporterScore" WHERE "transporteurId" = ANY(demo_ids);
  -- Transporter prefs
  DELETE FROM "TransporterPreferences" WHERE "userId" = ANY(demo_ids);
  -- Transporter applications
  DELETE FROM "TransporterApplication" WHERE "userId" = ANY(demo_ids);
  -- Enseigne
  DELETE FROM "Enseigne" WHERE "userId" = ANY(demo_ids);

  -- Relais-linked records
  DELETE FROM "RelaisCash" WHERE "relaisId" IN (
    SELECT id FROM "Relais" WHERE "userId" = ANY(demo_ids)
  );
  DELETE FROM "CashPickup" WHERE "relaisId" IN (
    SELECT id FROM "Relais" WHERE "userId" = ANY(demo_ids)
  );
  DELETE FROM "RelaisSanction" WHERE "relaisId" IN (
    SELECT id FROM "Relais" WHERE "userId" = ANY(demo_ids)
  );
  DELETE FROM "RelaisAudit" WHERE "relaisId" IN (
    SELECT id FROM "Relais" WHERE "userId" = ANY(demo_ids)
  );
  DELETE FROM "Relais" WHERE "userId" = ANY(demo_ids);

  -- Users
  DELETE FROM "User" WHERE id = ANY(demo_ids);

  RAISE NOTICE 'Demo accounts deleted successfully.';
END $$;
