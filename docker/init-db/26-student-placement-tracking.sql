-- =============================================================================
-- Student Placement & Hiring Tracking: Missing columns for placement workflow
-- =============================================================================
-- Adds columns for placement status, interview tracking, blacklist/suspension,
-- and risk assessment required by the student profile update service.
-- =============================================================================

ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS placement_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS placed_company VARCHAR(255),
  ADD COLUMN IF NOT EXISTS placement_package NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS interview_status VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_shortlisted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_released BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS offer_accepted BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_joined BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS segmentation_tags TEXT[],
  ADD COLUMN IF NOT EXISTS total_violations INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS risk_category VARCHAR(50);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_student_details_placement_status ON student_details(placement_status);
CREATE INDEX IF NOT EXISTS idx_student_details_is_blacklisted ON student_details(is_blacklisted);
CREATE INDEX IF NOT EXISTS idx_student_details_is_suspended ON student_details(is_suspended);
CREATE INDEX IF NOT EXISTS idx_student_details_interview_status ON student_details(interview_status);
CREATE INDEX IF NOT EXISTS idx_student_details_is_shortlisted ON student_details(is_shortlisted);
CREATE INDEX IF NOT EXISTS idx_student_details_risk_category ON student_details(risk_category);
