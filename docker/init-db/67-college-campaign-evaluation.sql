-- Phase 2 Module 07 — Evaluation & Results (separate from attempt workspace)

ALTER TABLE college_assessment_campaigns
  ADD COLUMN IF NOT EXISTS negative_mark_value NUMERIC(8,2) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS college_campaign_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  assessment_id UUID NOT NULL REFERENCES college_assessments(id),
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  -- scoring
  total_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
  obtained_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
  negative_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
  percentage NUMERIC(8,2) NOT NULL DEFAULT 0,
  passing_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
  passed BOOLEAN,
  -- workflow
  needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  evaluated_at TIMESTAMPTZ,
  evaluated_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT college_campaign_evaluations_status_check CHECK (
    status IN ('pending', 'evaluated', 'needs_manual_review', 'published')
  )
);

CREATE TABLE IF NOT EXISTS college_campaign_question_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES college_campaign_evaluations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES college_questions(id),
  question_type VARCHAR(50) NOT NULL,
  marks_possible NUMERIC(8,2) NOT NULL DEFAULT 0,
  marks_awarded NUMERIC(8,2) NOT NULL DEFAULT 0,
  is_correct BOOLEAN,
  selected JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluation_status VARCHAR(30) NOT NULL DEFAULT 'pending_manual',
  manual_feedback TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT college_campaign_question_results_unique UNIQUE (evaluation_id, question_id),
  CONSTRAINT college_campaign_qresult_status_check CHECK (
    evaluation_status IN (
      'auto_correct',
      'auto_incorrect',
      'pending_manual',
      'manually_scored',
      'skipped'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_college_campaign_evaluations_campaign
  ON college_campaign_evaluations (campaign_id, status);

CREATE INDEX IF NOT EXISTS idx_college_campaign_evaluations_user
  ON college_campaign_evaluations (user_id, campaign_id);
