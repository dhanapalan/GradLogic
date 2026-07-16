-- Practice Sets: student question bookmarks + optional bank hints
ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS hint TEXT;

CREATE TABLE IF NOT EXISTS practice_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_practice_bookmarks_student
  ON practice_bookmarks (student_id);
