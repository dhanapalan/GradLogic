-- =============================================================================
-- GradLogic Phase 1 Migration
-- LMS + Practice Arena + Student Development
-- =============================================================================

-- ── LMS: Courses ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS courses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT NOT NULL,        -- aptitude, dsa, reasoning, sql, soft_skills, verbal, programming
  difficulty    TEXT DEFAULT 'beginner', -- beginner, intermediate, advanced
  duration_hours NUMERIC(6,2),
  thumbnail_url TEXT,
  intro_video_url TEXT,
  status        TEXT DEFAULT 'draft', -- draft, published, archived
  is_free       BOOLEAN DEFAULT TRUE,
  tags          TEXT[] DEFAULT '{}',
  total_modules INT DEFAULT 0,
  total_enrollments INT DEFAULT 0,
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  college_id    UUID REFERENCES colleges(id) ON DELETE SET NULL,  -- NULL = platform-wide
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_status   ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_college  ON courses(college_id);

-- ── LMS: Course Modules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS course_modules (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id            UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT,
  sort_order           INT NOT NULL DEFAULT 0,
  is_locked            BOOLEAN DEFAULT FALSE,
  unlock_after_module  UUID REFERENCES course_modules(id) ON DELETE SET NULL,
  estimated_minutes    INT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_modules_course ON course_modules(course_id);

-- ── LMS: Lessons ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lessons (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id             UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  content_type          TEXT NOT NULL, -- video, pdf, text, quiz, coding
  content_url           TEXT,          -- MinIO URL for video/pdf
  content_text          TEXT,          -- rich text / markdown for text lessons
  video_duration_seconds INT,
  sort_order            INT NOT NULL DEFAULT 0,
  is_free_preview       BOOLEAN DEFAULT FALSE,
  estimated_minutes     INT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lessons_module ON lessons(module_id);

-- ── LMS: Enrollments ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS enrollments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id        UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  enrolled_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  progress_percent NUMERIC(5,2) DEFAULT 0,
  status           TEXT DEFAULT 'active',  -- active, completed, dropped
  enrolled_by      UUID REFERENCES users(id) ON DELETE SET NULL,  -- NULL = self-enrolled
  UNIQUE(student_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course  ON enrollments(course_id);

-- ── LMS: Lesson Progress ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_progress (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id      UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  is_completed   BOOLEAN DEFAULT FALSE,
  watch_seconds  INT DEFAULT 0,
  last_accessed  TIMESTAMPTZ DEFAULT NOW(),
  completed_at   TIMESTAMPTZ,
  UNIQUE(student_id, lesson_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_student ON lesson_progress(student_id);

-- ── LMS: Learning Paths ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learning_paths (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  target_role   TEXT,              -- software_engineer, data_analyst, etc.
  duration_days INT,
  thumbnail_url TEXT,
  status        TEXT DEFAULT 'draft',
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_path_courses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path_id     UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  is_required BOOLEAN DEFAULT TRUE,
  UNIQUE(path_id, course_id)
);

-- ── LMS: Certificates ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id         UUID REFERENCES courses(id) ON DELETE SET NULL,
  path_id           UUID REFERENCES learning_paths(id) ON DELETE SET NULL,
  certificate_url   TEXT,
  verification_code TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  issued_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id);

-- ── Practice Arena ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS practice_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_type     TEXT NOT NULL,    -- coding, quiz, mock_test
  topic            TEXT,             -- arrays, aptitude, verbal, sql, etc.
  difficulty       TEXT DEFAULT 'mixed',
  total_questions  INT DEFAULT 0,
  correct_answers  INT DEFAULT 0,
  score_percent    NUMERIC(5,2),
  time_spent_seconds INT DEFAULT 0,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  completed_at     TIMESTAMPTZ,
  status           TEXT DEFAULT 'in_progress'  -- in_progress, completed
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON practice_sessions(student_id);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  question_id        UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  student_answer     TEXT,
  is_correct         BOOLEAN,
  time_spent_seconds INT DEFAULT 0,
  hint_used          BOOLEAN DEFAULT FALSE,
  attempted_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_session ON practice_attempts(session_id);

CREATE TABLE IF NOT EXISTS coding_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id         UUID REFERENCES question_bank(id) ON DELETE SET NULL,
  language            TEXT NOT NULL,
  source_code         TEXT NOT NULL,
  status              TEXT,   -- accepted, wrong_answer, runtime_error, time_limit_exceeded, compile_error
  test_cases_passed   INT DEFAULT 0,
  total_test_cases    INT DEFAULT 0,
  execution_time_ms   INT,
  memory_used_kb      INT,
  judge0_token        TEXT,
  submitted_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coding_submissions_student   ON coding_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_coding_submissions_question  ON coding_submissions(question_id);

-- ── Student Development Plans ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_development_plans (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  drive_id            UUID REFERENCES assessment_drives(id) ON DELETE SET NULL,
  plan_type           TEXT DEFAULT 'post_drive',  -- post_drive, on_demand, weekly
  status              TEXT DEFAULT 'active',       -- active, completed, archived
  ai_summary          TEXT,
  skill_gaps          JSONB DEFAULT '[]',           -- [{skill, current_level, target_level, priority}]
  recommended_actions JSONB DEFAULT '[]',           -- [{action, resource_url, deadline, completed}]
  milestones          JSONB DEFAULT '[]',
  score_at_generation NUMERIC(5,2),
  generated_at        TIMESTAMPTZ DEFAULT NOW(),
  expires_at          TIMESTAMPTZ,
  UNIQUE(student_id, drive_id)
);

CREATE INDEX IF NOT EXISTS idx_dev_plans_student ON student_development_plans(student_id);

-- ── Student Goals ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS student_goals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  target_role      TEXT,
  target_date      DATE,
  status           TEXT DEFAULT 'active',  -- active, achieved, dropped
  progress_percent NUMERIC(5,2) DEFAULT 0,
  milestones       JSONB DEFAULT '[]',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_student ON student_goals(student_id);

-- ── Skill Progress Tracking ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS skill_progress (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_name        TEXT NOT NULL,
  proficiency_score NUMERIC(5,2) DEFAULT 0,  -- 0–100
  last_assessed     TIMESTAMPTZ DEFAULT NOW(),
  assessment_source TEXT,  -- drive, practice, course
  UNIQUE(student_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_skill_progress_student ON skill_progress(student_id);
