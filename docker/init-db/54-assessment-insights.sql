-- Assessment Hub AI Integration — post-attempt insight for Companion + Coach
CREATE TABLE IF NOT EXISTS student_assessment_insights (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id            UUID NOT NULL,
  drive_id              UUID NOT NULL REFERENCES assessment_drives(id) ON DELETE CASCADE,
  score                 NUMERIC(8,2),
  score_percent         NUMERIC(6,2),
  weak_topics           JSONB NOT NULL DEFAULT '[]'::jsonb,
  strong_topics         JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations       JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_object_id UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  journey_updated       BOOLEAN NOT NULL DEFAULT FALSE,
  placement_readiness   NUMERIC(5,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_sai_student_created
  ON student_assessment_insights (student_id, created_at DESC);
