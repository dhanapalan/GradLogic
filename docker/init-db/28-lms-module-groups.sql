-- =============================================================================
-- 28-lms-module-groups.sql
-- LMS module groups + default assignment metadata for multi-tenant colleges.
-- Must run AFTER 27-platform-modules.sql
-- =============================================================================

ALTER TABLE feature_modules
  ADD COLUMN IF NOT EXISTS module_type VARCHAR(20) NOT NULL DEFAULT 'lms'
    CHECK (module_type IN ('lms', 'platform')),
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS icon VARCHAR(40);

-- ── Platform core (default for every new college) ─────────────────────────────
INSERT INTO feature_modules (key, name, description, status, module_type, is_default, sort_order, icon, features)
SELECT 'campus-core', 'Campus Core',
  'Essential campus operations: students, assessments, analytics, and settings.',
  'active', 'platform', TRUE, 0, 'building',
  '["students","assessments","analytics","settings"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'campus-core');

UPDATE feature_modules SET
  module_type = 'platform', is_default = TRUE, sort_order = 0, icon = 'building',
  features = '["students","assessments","analytics","settings"]'::jsonb,
  description = 'Essential campus operations: students, assessments, analytics, and settings.'
WHERE key = 'campus-core' AND deleted_at IS NULL;

-- ── Five LMS learning groups ──────────────────────────────────────────────────

INSERT INTO feature_modules (key, name, description, status, module_type, is_default, sort_order, icon, features)
SELECT 'aptitude-reasoning', 'Aptitude & Reasoning',
  'Quantitative aptitude, logical reasoning, verbal ability, and problem-solving tracks.',
  'active', 'lms', TRUE, 10, 'brain',
  '["aptitude_practice","aptitude_tests","aptitude_workflows","question_bank"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'aptitude-reasoning');

INSERT INTO feature_modules (key, name, description, status, module_type, is_default, sort_order, icon, features)
SELECT 'technical-skills', 'Technical Skills',
  'DSA, programming fundamentals, coding practice, and technical assessments.',
  'active', 'lms', FALSE, 20, 'code',
  '["technical_dsa","technical_programming","technical_practice","technical_assessments"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'technical-skills');

INSERT INTO feature_modules (key, name, description, status, module_type, is_default, sort_order, icon, features)
SELECT 'soft-skills-communication', 'Soft Skills & Communication',
  'Communication, presentations, teamwork, and professional etiquette.',
  'active', 'lms', FALSE, 30, 'message-circle',
  '["soft_communication","soft_presentations","soft_teamwork","soft_skills"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'soft-skills-communication');

INSERT INTO feature_modules (key, name, description, status, module_type, is_default, sort_order, icon, features)
SELECT 'interview-preparation', 'Interview Preparation',
  'Group discussions, AI mock interviews, and personal interview readiness.',
  'active', 'lms', FALSE, 40, 'mic',
  '["interview_gd","interview_mock","interview_pi","tests"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'interview-preparation');

INSERT INTO feature_modules (key, name, description, status, module_type, is_default, sort_order, icon, features)
SELECT 'entrance-exams', 'Higher Education & Entrance Exams',
  'CUET, GATE, CAT and other competitive entrance exam preparation.',
  'active', 'lms', FALSE, 50, 'graduation-cap',
  '["entrance_cuet","entrance_gate","entrance_cat","learn"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM feature_modules WHERE key = 'entrance-exams');

-- Sync metadata on existing LMS rows
UPDATE feature_modules SET module_type = 'lms', sort_order = 10, icon = 'brain', is_default = TRUE
WHERE key = 'aptitude-reasoning' AND deleted_at IS NULL;

UPDATE feature_modules SET module_type = 'lms', sort_order = 20, icon = 'code'
WHERE key = 'technical-skills' AND deleted_at IS NULL;

UPDATE feature_modules SET module_type = 'lms', sort_order = 30, icon = 'message-circle'
WHERE key = 'soft-skills-communication' AND deleted_at IS NULL;

UPDATE feature_modules SET module_type = 'lms', sort_order = 40, icon = 'mic'
WHERE key = 'interview-preparation' AND deleted_at IS NULL;

UPDATE feature_modules SET module_type = 'lms', sort_order = 50, icon = 'graduation-cap'
WHERE key = 'entrance-exams' AND deleted_at IS NULL;

-- Legacy bundles → platform type (not default unless campus-core)
UPDATE feature_modules SET module_type = 'platform', is_default = FALSE
WHERE key IN ('content-studio', 'analytics-pro', 'skills-development', 'student-engagement')
  AND deleted_at IS NULL;
