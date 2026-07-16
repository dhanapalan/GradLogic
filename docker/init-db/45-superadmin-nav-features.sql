-- =============================================================================
-- Super Admin nav feature backing tables (formerly Coming Soon stubs).
-- Lessons/flashcards/voice reuse existing tables; this adds content library
-- types, batches/enrollments, and branding setting seeds. Idempotent.
-- =============================================================================

-- Extend ai_content_items for interview / case study / learning resource staging
ALTER TABLE ai_content_items DROP CONSTRAINT IF EXISTS ai_content_items_content_type_check;
ALTER TABLE ai_content_items ADD CONSTRAINT ai_content_items_content_type_check
  CHECK (content_type IN (
    'flashcard', 'lesson', 'voice_lesson',
    'interview_question', 'case_study', 'learning_resource'
  ));

-- Published library for interview / case / learning resources (and generic assets)
CREATE TABLE IF NOT EXISTS content_library_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type  TEXT NOT NULL CHECK (content_type IN (
                  'interview_question', 'case_study', 'learning_resource', 'resource'
                )),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL DEFAULT '',
  category      TEXT NOT NULL DEFAULT 'general',
  difficulty    TEXT NOT NULL DEFAULT 'medium',
  tags          TEXT[] NOT NULL DEFAULT '{}',
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,
  status        TEXT NOT NULL DEFAULT 'published'
                  CHECK (status IN ('draft', 'published', 'archived')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_library_type ON content_library_items(content_type);
CREATE INDEX IF NOT EXISTS idx_content_library_status ON content_library_items(status);

-- College batches (cohorts) + enrollment linkage
CREATE TABLE IF NOT EXISTS college_batches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id     UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  academic_year  TEXT,
  program_label  TEXT,
  start_date     DATE,
  end_date       DATE,
  status         TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'archived')),
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_college_batches_college ON college_batches(college_id);

CREATE TABLE IF NOT EXISTS batch_enrollments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    UUID NOT NULL REFERENCES college_batches(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'withdrawn', 'completed')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_enrollments_student ON batch_enrollments(student_id);

-- certificates.title used by LMS issue endpoint (may be missing on older DBs)
ALTER TABLE certificates ADD COLUMN IF NOT EXISTS title TEXT;

-- Unique per student+course when course_id is set (for ON CONFLICT in LMS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_student_course_uniq'
  ) THEN
    ALTER TABLE certificates
      ADD CONSTRAINT certificates_student_course_uniq UNIQUE (student_id, course_id);
  END IF;
EXCEPTION WHEN others THEN
  NULL; -- ignore if duplicates already prevent the constraint
END $$;

-- Branding defaults in system_settings
INSERT INTO system_settings (key, value)
SELECT v.key, v.value::jsonb
FROM (VALUES
  ('branding.platform_name',   '"GradLogic"'),
  ('branding.tagline',         '"Talent that sticks"'),
  ('branding.primary_color',   '"#0f172a"'),
  ('branding.accent_color',    '"#2563eb"'),
  ('branding.logo_url',        '""'),
  ('branding.favicon_url',     '""'),
  ('integrations.sso_enabled', 'false'),
  ('integrations.webhooks_url','""'),
  ('integrations.lms_sync',    'false')
) AS v(key, value)
WHERE NOT EXISTS (SELECT 1 FROM system_settings s WHERE s.key = v.key);
