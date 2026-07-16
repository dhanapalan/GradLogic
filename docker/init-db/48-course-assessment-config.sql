-- =============================================================================
-- 48 — Course Builder assessment / publish gates (Increment 3)
-- =============================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS assessment_config JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN courses.assessment_config IS
  'Course Builder assessment gates: { passing_percent, attempts, min_practice_per_module, require_assessment }';
