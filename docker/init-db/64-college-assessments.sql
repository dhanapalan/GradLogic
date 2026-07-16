-- Phase 2 Module 04 — College Portal Assessment Management (definitions only)

CREATE TABLE IF NOT EXISTS college_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id),
  assessment_code VARCHAR(40) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  assessment_type VARCHAR(50) NOT NULL,
  category VARCHAR(50) NOT NULL,
  duration_minutes INT NOT NULL,
  passing_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  instructions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT college_assessments_type_check CHECK (
    assessment_type IN ('practice_test', 'mock_test', 'placement_test')
  ),
  CONSTRAINT college_assessments_category_check CHECK (
    category IN ('aptitude', 'logical_reasoning', 'english', 'technical', 'domain')
  ),
  CONSTRAINT college_assessments_status_check CHECK (
    status IN ('draft', 'published', 'archived')
  ),
  CONSTRAINT college_assessments_duration_check CHECK (duration_minutes > 0),
  CONSTRAINT college_assessments_code_unique UNIQUE (college_id, assessment_code)
);

CREATE TABLE IF NOT EXISTS college_assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES college_assessments(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES college_questions(id),
  display_order INT NOT NULL DEFAULT 0,
  marks NUMERIC(8,2) NOT NULL DEFAULT 1,
  CONSTRAINT college_assessment_questions_unique UNIQUE (assessment_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_college_assessments_college
  ON college_assessments (college_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_assessments_filters
  ON college_assessments (college_id, assessment_type, category, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_college_assessment_questions_aid
  ON college_assessment_questions (assessment_id, display_order);
