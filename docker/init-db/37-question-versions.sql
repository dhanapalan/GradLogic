-- Phase 13 — AI Content Improver.
-- Every AI improvement is stored as a proposed version here; the original
-- question_bank row is NEVER mutated by the improve step itself — only an
-- explicit, separate "apply" action (a superadmin choice) copies a version's
-- fields onto the live row. This is what "never overwrite original" means.
CREATE TABLE IF NOT EXISTS question_bank_versions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  improvement_type  VARCHAR(40) NOT NULL, -- grammar, distractors, explanation, examples, difficulty, coding_version
  question_text     TEXT,
  options           JSONB,
  explanation       TEXT,
  hint              TEXT,
  difficulty_level  VARCHAR(20),
  starter_code      JSONB,
  test_cases        JSONB,
  change_summary    TEXT,
  status            VARCHAR(20) NOT NULL DEFAULT 'proposed', -- proposed, applied, rejected
  created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_question_versions_question ON question_bank_versions(question_id);
