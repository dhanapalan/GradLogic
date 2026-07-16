-- Phase 2 Module 06.3 — Assessment Attempt Workspace (campaign attempts)

CREATE TABLE IF NOT EXISTS college_campaign_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  assessment_id UUID NOT NULL REFERENCES college_assessments(id),
  attempt_number INT NOT NULL DEFAULT 1,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  option_orders JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_index INT NOT NULL DEFAULT 0,
  time_remaining_seconds INT NOT NULL,
  server_deadline TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  score NUMERIC(8,2),
  CONSTRAINT college_campaign_attempts_status_check CHECK (
    status IN ('in_progress', 'submitted', 'expired')
  ),
  CONSTRAINT college_campaign_attempts_unique UNIQUE (campaign_id, user_id, attempt_number)
);

CREATE TABLE IF NOT EXISTS college_campaign_attempt_answers (
  attempt_id UUID NOT NULL REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES college_questions(id),
  selected JSONB NOT NULL DEFAULT '[]'::jsonb,
  visited BOOLEAN NOT NULL DEFAULT FALSE,
  marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_college_campaign_attempts_user
  ON college_campaign_attempts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_college_campaign_attempts_campaign
  ON college_campaign_attempts (campaign_id, user_id);

-- Module 06.4 — configurable timer warning threshold (seconds remaining)
ALTER TABLE college_assessment_campaigns
  ADD COLUMN IF NOT EXISTS timer_warning_seconds INT NOT NULL DEFAULT 300;
