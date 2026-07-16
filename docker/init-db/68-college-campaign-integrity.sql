-- Phase 2 Module 09 — Assessment Integrity (AI Proctoring) for college campaigns.
-- Separate from attempt workspace (06) and evaluation (07).

ALTER TABLE college_assessment_campaigns
  ADD COLUMN IF NOT EXISTS proctoring_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_fullscreen BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS detect_tab_switch BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS detect_window_blur BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS detect_copy_paste BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS detect_multi_monitor BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS require_camera BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS require_microphone BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tab_switch_limit INT NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS integrity_auto_flag BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE college_campaign_attempts
  ADD COLUMN IF NOT EXISTS integrity_score INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS integrity_violations INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS integrity_status VARCHAR(20) NOT NULL DEFAULT 'clear';

CREATE TABLE IF NOT EXISTS college_campaign_integrity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(60) NOT NULL,
  risk_delta INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS college_campaign_integrity_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL UNIQUE REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  integrity_score INT NOT NULL DEFAULT 100,
  event_count INT NOT NULL DEFAULT 0,
  risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  notes TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT college_campaign_integrity_risk_check CHECK (
    risk_level IN ('low', 'medium', 'high')
  ),
  CONSTRAINT college_campaign_integrity_status_check CHECK (
    status IN ('open', 'reviewed', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_college_campaign_integrity_events_attempt
  ON college_campaign_integrity_events (attempt_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_college_campaign_integrity_events_campaign
  ON college_campaign_integrity_events (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_college_campaign_integrity_incidents_campaign
  ON college_campaign_integrity_incidents (campaign_id, status, risk_level);
