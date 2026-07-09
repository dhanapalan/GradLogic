-- =============================================================================
-- 27-platform-modules.sql
-- Multi-tenant feature modules: SuperAdmin defines modules, assigns per college.
-- Must run AFTER 02-college-student-onboarding.sql (colleges table).
-- =============================================================================

CREATE TABLE IF NOT EXISTS feature_modules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           VARCHAR(80) NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  description   TEXT,
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'draft', 'archived')),
  features      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_feature_modules_status
  ON feature_modules (status) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS college_module_assignments (
  college_id    UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  module_id     UUID NOT NULL REFERENCES feature_modules(id) ON DELETE CASCADE,
  enabled       BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (college_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_college_module_assignments_college
  ON college_module_assignments (college_id);

-- ── Seed default modules (idempotent) ─────────────────────────────────────────

INSERT INTO feature_modules (key, name, description, status, features)
SELECT 'campus-core', 'Campus Core',
  'Essential campus operations: student roster, assessments, and settings.',
  'active', '["students","assessments","settings"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'campus-core');

INSERT INTO feature_modules (key, name, description, status, features)
SELECT 'content-studio', 'Content Studio',
  'Question bank and learning workflows for campus hiring prep.',
  'active', '["question_bank","workflows"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'content-studio');

INSERT INTO feature_modules (key, name, description, status, features)
SELECT 'analytics-pro', 'Analytics Pro',
  'Campus performance dashboards and exportable reports.',
  'active', '["analytics"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'analytics-pro');

INSERT INTO feature_modules (key, name, description, status, features)
SELECT 'skills-development', 'Skills Development',
  'Soft skills and technical skill development tracks.',
  'active', '["soft_skills","technical_skills"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'skills-development');

INSERT INTO feature_modules (key, name, description, status, features)
SELECT 'student-engagement', 'Student Engagement',
  'Gamification, notifications, payments, and learning paths for students.',
  'active', '["student_workflow","learn","practice","tests","question_bank","gamification","notifications","payments"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'student-engagement');
