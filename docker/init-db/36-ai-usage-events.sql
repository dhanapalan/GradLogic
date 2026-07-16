-- Phase 11 — AI Analytics Dashboard.
-- Lightweight usage log so "Voice Usage" and "AI Usage" are real metrics,
-- not fabricated ones. Written from each AI-capability route (fire-and-forget,
-- never blocks the actual response).
CREATE TABLE IF NOT EXISTS ai_usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  feature     VARCHAR(60) NOT NULL, -- e.g. 'voice_tutor', 'placement_coach_voice', 'ai_search', 'knowledge_engine:explain'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_events_feature ON ai_usage_events(feature);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_created ON ai_usage_events(created_at);
