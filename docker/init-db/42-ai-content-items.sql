-- Generic staging table for AI-generated content that isn't a question_bank
-- row (flashcards, lessons, voice-lesson scripts). Mirrors question_bank's
-- review lifecycle (pending_review -> approved/rejected -> published) so
-- Flashcards/Lessons/Voice Lessons can flow through the same
-- generate -> review -> publish pipeline as Questions, without forcing them
-- into the question-shaped question_bank table.
CREATE TABLE IF NOT EXISTS ai_content_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type   TEXT NOT NULL CHECK (content_type IN ('flashcard', 'lesson', 'voice_lesson')),
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,
  explanation    TEXT,
  category       TEXT NOT NULL DEFAULT 'aptitude',
  difficulty     TEXT NOT NULL DEFAULT 'medium',
  tags           TEXT[] NOT NULL DEFAULT '{}',
  status         TEXT NOT NULL DEFAULT 'pending_review'
                   CHECK (status IN ('pending_review', 'approved', 'rejected', 'published')),
  rejection_reason TEXT,
  published_lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_content_items_status ON ai_content_items(status);
CREATE INDEX IF NOT EXISTS idx_ai_content_items_type ON ai_content_items(content_type);

-- Flashcards have no home table today — question_bank is question-shaped
-- (options/correct_answer), flashcards are just front/back.
CREATE TABLE IF NOT EXISTS flashcards (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  front       TEXT NOT NULL,
  back        TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'aptitude',
  difficulty  TEXT NOT NULL DEFAULT 'medium',
  tags        TEXT[] NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_category ON flashcards(category);
