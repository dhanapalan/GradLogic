-- =============================================================================
-- 50 — Learning Journey (templates extend learning_paths + student_journeys)
-- =============================================================================

-- Template enrichment on existing learning_paths
ALTER TABLE learning_paths
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'beginner',
  ADD COLUMN IF NOT EXISTS objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS revision_intervals_days INT[] NOT NULL DEFAULT ARRAY[1, 7, 30],
  ADD COLUMN IF NOT EXISTS readiness_weights JSONB NOT NULL DEFAULT '{
    "course_completion": 0.25,
    "assessment_scores": 0.20,
    "coding_performance": 0.20,
    "mock_test_performance": 0.15,
    "skill_mastery": 0.10,
    "consistency": 0.10
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_learning_paths_domain ON learning_paths(domain)
  WHERE domain IS NOT NULL;

-- Per-student journey instance (distinct from Adaptive's computed study plan)
CREATE TABLE IF NOT EXISTS student_journeys (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id          UUID NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  college_id           UUID REFERENCES colleges(id) ON DELETE SET NULL,
  batch_id             UUID REFERENCES college_batches(id) ON DELETE SET NULL,
  status               TEXT NOT NULL DEFAULT 'not_started'
                        CHECK (status IN ('not_started','in_progress','completed','paused','archived')),
  skill_level          TEXT DEFAULT 'beginner',
  goal                 TEXT,
  progress_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
  placement_readiness  NUMERIC(5,2) NOT NULL DEFAULT 0,
  assigned_by          UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_student_journeys_student ON student_journeys(student_id);
CREATE INDEX IF NOT EXISTS idx_student_journeys_template ON student_journeys(template_id);
CREATE INDEX IF NOT EXISTS idx_student_journeys_status ON student_journeys(status);

CREATE TABLE IF NOT EXISTS student_journey_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id  UUID NOT NULL REFERENCES student_journeys(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_journey_events_journey
  ON student_journey_events(journey_id, created_at DESC);

-- Idempotent Phase-1 template seeds (by domain)
INSERT INTO learning_paths (title, description, domain, difficulty, duration_days, estimated_hours, status, objectives, target_role)
SELECT v.title, v.description, v.domain, v.difficulty, v.duration_days, v.estimated_hours, 'published', v.objectives::jsonb, v.target_role
FROM (VALUES
  (
    'Aptitude Placement Track',
    'Quantitative aptitude roadmap from foundations to placement-speed practice.',
    'aptitude',
    'beginner',
    28,
    40.0,
    '["Master percentages, ratios, and DI","Build speed for campus aptitude papers","Reach placement-ready aptitude score"]',
    'software_engineer'
  ),
  (
    'Logical Reasoning Track',
    'Series, syllogisms, puzzles, and analytical reasoning for placement papers.',
    'reasoning',
    'beginner',
    28,
    36.0,
    '["Complete reasoning foundations","Solve timed placement-style sets","Sustain accuracy above 70%"]',
    'software_engineer'
  ),
  (
    'Python Placement Track',
    'Python programming path from basics through OOP and coding drills.',
    'python_coding',
    'beginner',
    42,
    60.0,
    '["Complete Python basics","Solve placement coding challenges","Demonstrate OOP fluency"]',
    'software_engineer'
  ),
  (
    'Java Placement Track',
    'Java fundamentals, collections, and interview-ready coding practice.',
    'java_coding',
    'beginner',
    42,
    60.0,
    '["Complete Java basics","Master collections","Solve placement coding challenges"]',
    'software_engineer'
  ),
  (
    'AI Fundamentals Track',
    'Artificial Intelligence fundamentals for fresher placement readiness.',
    'ai_fundamentals',
    'beginner',
    35,
    45.0,
    '["Understand AI concepts","Map AI to career skills","Complete AI fundamentals assessments"]',
    'data_analyst'
  ),
  (
    'ML Basics Track',
    'Machine Learning basics — core models, evaluation, and practice.',
    'ml_basics',
    'intermediate',
    35,
    48.0,
    '["Learn supervised learning basics","Evaluate models","Apply ML workflows on practice sets"]',
    'data_analyst'
  )
) AS v(title, description, domain, difficulty, duration_days, estimated_hours, objectives, target_role)
WHERE NOT EXISTS (
  SELECT 1 FROM learning_paths lp WHERE lp.domain = v.domain
);
