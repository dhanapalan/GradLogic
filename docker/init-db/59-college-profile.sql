-- =============================================================================
-- 59 — College Profile (Phase 2 · Module 02)
-- Master record fields for campus basic / contact / placement officer + logo.
-- Idempotent.
-- =============================================================================

ALTER TABLE colleges
  ADD COLUMN IF NOT EXISTS short_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS university VARCHAR(255),
  ADD COLUMN IF NOT EXISTS college_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
  ADD COLUMN IF NOT EXISTS country VARCHAR(120) DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS placement_officer_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS placement_officer_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS placement_officer_mobile VARCHAR(30);

-- Backfill address_line1 from legacy address when empty
UPDATE colleges
SET address_line1 = LEFT(address, 255)
WHERE address_line1 IS NULL
  AND address IS NOT NULL
  AND TRIM(address) <> '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_colleges_college_type'
  ) THEN
    ALTER TABLE colleges
      ADD CONSTRAINT chk_colleges_college_type
      CHECK (
        college_type IS NULL OR college_type IN (
          'Engineering',
          'Arts & Science',
          'Polytechnic',
          'Management',
          'Other'
        )
      );
  END IF;
END $$;
