-- Fixes a pre-existing gap: "instructor", "mentor", and "company" are valid
-- UserRole values in server/src/types/index.ts and have real portals/routes
-- built against them (MentorDashboardPage, CompanyPage, and this session's
-- new FacultyDashboardPage), but were never added to the Postgres user_role
-- enum — no account could actually be created with these roles.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'instructor'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'instructor';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'mentor'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'mentor';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'company'
  ) THEN
    ALTER TYPE user_role ADD VALUE 'company';
  END IF;
END $$;
