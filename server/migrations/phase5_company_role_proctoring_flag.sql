-- =============================================================================
-- Phase 5 — Company role + proctoring_enabled flag
--
-- 1. Add 'company' to the user_role enum so recruiting companies can have
--    their own login accounts and manage drives independently.
-- 2. Add proctoring_enabled boolean to assessment_drives (default false) so
--    proctoring is opt-in. Mock interviews and learning drives never proctor.
-- =============================================================================

-- 1. Extend user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'company';

-- 2. Add proctoring_enabled to assessment_drives
ALTER TABLE assessment_drives
  ADD COLUMN IF NOT EXISTS proctoring_enabled BOOLEAN NOT NULL DEFAULT FALSE;
