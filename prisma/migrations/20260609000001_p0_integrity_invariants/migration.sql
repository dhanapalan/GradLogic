-- P0 Integrity Invariants Migration
-- Implements the three load-bearing constraints from the GradLogic target architecture.

-- 1. Server-authoritative deadline on exam sessions
--    time_remaining_seconds is kept for legacy reads; server_deadline is the source of truth.
ALTER TABLE drive_students
  ADD COLUMN IF NOT EXISTS server_deadline TIMESTAMPTZ;

-- 2. Partial unique index — one active session per student per drive (US-6.4)
--    A student can only have one IN_PROGRESS record; completed/assigned rows are unrestricted.
CREATE UNIQUE INDEX IF NOT EXISTS uq_drive_students_active_session
  ON drive_students (student_id, drive_id)
  WHERE status = 'in_progress';

-- 3. Complete the question pool snapshot for coding questions
--    Pool rows already copy question_text/options/correct_answer; add test_cases + starter_code
--    so editing the question bank can never affect a running or finished exam.
ALTER TABLE drive_pool_questions
  ADD COLUMN IF NOT EXISTS test_cases   JSONB,
  ADD COLUMN IF NOT EXISTS starter_code JSONB;
