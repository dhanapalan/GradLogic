-- Adds the "placement_cell" role to the user_role enum — college placement
-- staff who coordinate drives and track student readiness, distinct from
-- college_admin (full college account) and hr (recruiting company staff).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'placement_cell'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'placement_cell';
  END IF;
END $$;
