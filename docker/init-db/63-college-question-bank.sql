-- Phase 2 Module 03 — College Portal Question Bank (campus-scoped)
-- Separate from platform question_bank so college categories/types/status
-- do not collide with Assessment Hub coding enums.

CREATE TABLE IF NOT EXISTS college_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id),
  question_code VARCHAR(40) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL,
  question_type VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) NOT NULL,
  marks NUMERIC(8,2) NOT NULL DEFAULT 1,
  correct_answer TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT college_questions_category_check CHECK (
    category IN ('aptitude', 'logical_reasoning', 'english', 'technical', 'domain')
  ),
  CONSTRAINT college_questions_type_check CHECK (
    question_type IN ('mcq_single', 'mcq_multiple', 'true_false', 'short_answer')
  ),
  CONSTRAINT college_questions_difficulty_check CHECK (
    difficulty IN ('easy', 'medium', 'hard')
  ),
  CONSTRAINT college_questions_status_check CHECK (
    status IN ('draft', 'active', 'inactive')
  ),
  CONSTRAINT college_questions_marks_check CHECK (marks > 0),
  CONSTRAINT college_questions_code_unique UNIQUE (college_id, question_code)
);

CREATE TABLE IF NOT EXISTS college_question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES college_questions(id) ON DELETE CASCADE,
  option_label VARCHAR(5) NOT NULL,
  option_text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_college_questions_college
  ON college_questions (college_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_questions_filters
  ON college_questions (college_id, category, question_type, difficulty, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_questions_title
  ON college_questions (college_id, lower(title))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_question_options_qid
  ON college_question_options (question_id);
