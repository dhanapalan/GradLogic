-- =============================================================================
-- Student Details: Missing columns for integrity scoring and hiring eligibility
-- =============================================================================

ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS avg_integrity_score NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligible_for_hiring BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_student_details_integrity ON student_details(avg_integrity_score);
CREATE INDEX IF NOT EXISTS idx_student_details_eligible ON student_details(eligible_for_hiring);
