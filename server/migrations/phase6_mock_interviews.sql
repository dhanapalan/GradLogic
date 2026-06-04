-- =============================================================================
-- Phase 6 — Voice AI Mock Interviews
-- =============================================================================

CREATE TABLE IF NOT EXISTS mock_interview_sessions (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_id          UUID        REFERENCES assessment_drives(id) ON DELETE SET NULL,
  target_role       VARCHAR(200),
  difficulty        VARCHAR(20) NOT NULL DEFAULT 'medium',  -- easy | medium | hard
  vapi_call_id      VARCHAR(200),
  status            VARCHAR(30) NOT NULL DEFAULT 'pending', -- pending | active | completed | failed
  transcript        JSONB,          -- [{role:'user'|'assistant', message:'...', time:...}]
  duration_seconds  INT,
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mock_interview_feedback (
  id                    UUID  PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id            UUID  UNIQUE NOT NULL REFERENCES mock_interview_sessions(id) ON DELETE CASCADE,
  overall_score         INT,                       -- 0–100
  communication_score   INT,
  technical_score       INT,
  confidence_score      INT,
  summary               TEXT,
  strengths             JSONB NOT NULL DEFAULT '[]',
  improvements          JSONB NOT NULL DEFAULT '[]',
  skill_gaps            JSONB NOT NULL DEFAULT '[]',
  transcript_highlights JSONB NOT NULL DEFAULT '[]',
  recommended_courses   JSONB NOT NULL DEFAULT '[]',
  generated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mis_student  ON mock_interview_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_mis_status   ON mock_interview_sessions(status);
CREATE INDEX IF NOT EXISTS idx_mif_session  ON mock_interview_feedback(session_id);
