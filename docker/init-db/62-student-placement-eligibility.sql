-- Sprint 2.5 — Placement Eligibility tracking + history + college rules

ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS eligibility_reason TEXT,
  ADD COLUMN IF NOT EXISTS eligibility_date DATE,
  ADD COLUMN IF NOT EXISTS eligibility_verified_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS eligibility_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS active_backlogs INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS eligibility_manual_override BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE colleges
  ADD COLUMN IF NOT EXISTS min_placement_cgpa NUMERIC(4,2) DEFAULT 6.0,
  ADD COLUMN IF NOT EXISTS max_active_backlogs INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS student_eligibility_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id),
  user_id UUID NOT NULL REFERENCES users(id),
  previous_eligible BOOLEAN,
  new_eligible BOOLEAN NOT NULL,
  previous_active_backlogs INT,
  new_active_backlogs INT,
  previous_cgpa NUMERIC(4,2),
  new_cgpa NUMERIC(4,2),
  change_source VARCHAR(40) NOT NULL DEFAULT 'manual',
  reason TEXT,
  manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eligibility_hist_user
  ON student_eligibility_history (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_eligibility_hist_college
  ON student_eligibility_history (college_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_student_details_eligibility
  ON student_details (college_id, eligible_for_hiring)
  WHERE eligible_for_hiring IS NOT NULL;
