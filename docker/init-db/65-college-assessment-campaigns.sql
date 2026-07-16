-- Phase 2 Module 05 — Assessment Campaigns (assignment events; no attempt engine)

CREATE TABLE IF NOT EXISTS college_assessment_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id),
  campaign_code VARCHAR(40) NOT NULL,
  name TEXT NOT NULL,
  assessment_id UUID NOT NULL REFERENCES college_assessments(id),
  instructions TEXT,
  -- schedule
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  -- attempts / delivery settings (consumed by Module 06)
  max_attempts INT NOT NULL DEFAULT 1,
  duration_minutes INT,
  shuffle_questions BOOLEAN NOT NULL DEFAULT FALSE,
  shuffle_options BOOLEAN NOT NULL DEFAULT FALSE,
  allow_resume BOOLEAN NOT NULL DEFAULT TRUE,
  show_result_immediately BOOLEAN NOT NULL DEFAULT FALSE,
  negative_marking BOOLEAN NOT NULL DEFAULT FALSE,
  -- targeting filters (null = any)
  target_department VARCHAR(200),
  target_batch VARCHAR(100),
  target_semester VARCHAR(50),
  target_section VARCHAR(50),
  -- notifications
  notify_students BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  notify_email BOOLEAN NOT NULL DEFAULT TRUE,
  notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
  -- Module 06.4 — warn student when this many seconds remain
  timer_warning_seconds INT NOT NULL DEFAULT 300,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT college_campaigns_status_check CHECK (
    status IN ('draft', 'published', 'closed', 'archived')
  ),
  CONSTRAINT college_campaigns_attempts_check CHECK (max_attempts >= 1),
  CONSTRAINT college_campaigns_schedule_check CHECK (end_at > start_at),
  CONSTRAINT college_campaigns_code_unique UNIQUE (college_id, campaign_code)
);

CREATE TABLE IF NOT EXISTS college_campaign_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Module 06 will fill these; Module 05 keeps zeros / nulls
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  attempts_used INT NOT NULL DEFAULT 0,
  CONSTRAINT college_campaign_students_unique UNIQUE (campaign_id, user_id)
);

CREATE TABLE IF NOT EXISTS college_campaign_student_picks (
  campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (campaign_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_college_campaigns_college
  ON college_assessment_campaigns (college_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_campaigns_assessment
  ON college_assessment_campaigns (assessment_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_campaign_students_campaign
  ON college_campaign_students (campaign_id);
