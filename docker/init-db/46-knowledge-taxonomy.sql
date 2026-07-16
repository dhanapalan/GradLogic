-- =============================================================================
-- 46 — Knowledge Library taxonomy (Sprint 3)
-- Category (existing `categories`) → Subject → Topic
-- Optional topic_id on knowledge assets (nullable, non-breaking).
-- =============================================================================

-- Ensure category slugs cover question_bank enum (underscore style)
INSERT INTO categories (name, slug, description)
SELECT v.name, v.slug, v.description
FROM (VALUES
  ('Reasoning', 'reasoning', 'Logical and analytical reasoning'),
  ('Aptitude', 'aptitude', 'Quantitative and verbal aptitude'),
  ('Maths', 'maths', 'Mathematics fundamentals'),
  ('Data Structures', 'data_structures', 'DSA concepts and problems'),
  ('Programming', 'programming', 'General programming'),
  ('Python Coding', 'python_coding', 'Python language and coding'),
  ('Java Coding', 'java_coding', 'Java language and coding'),
  ('Data Science', 'data_science', 'Data science and ML basics')
) AS v(name, slug, description)
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.slug = v.slug AND c.deleted_at IS NULL
);

CREATE TABLE IF NOT EXISTS knowledge_subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  slug        VARCHAR(160) NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_subjects_category
  ON knowledge_subjects(category_id) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS knowledge_topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  UUID NOT NULL REFERENCES knowledge_subjects(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  slug        VARCHAR(160) NOT NULL,
  description TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (subject_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_subject
  ON knowledge_topics(subject_id) WHERE deleted_at IS NULL;

-- Default subject per category (idempotent)
INSERT INTO knowledge_subjects (category_id, name, slug, description, sort_order)
SELECT c.id, 'Core', 'core', 'Default subject under ' || c.name, 0
FROM categories c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM knowledge_subjects s
    WHERE s.category_id = c.id AND s.slug = 'core' AND s.deleted_at IS NULL
  );

-- Optional topic links on assets
ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES knowledge_topics(id) ON DELETE SET NULL;

ALTER TABLE flashcards
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES knowledge_topics(id) ON DELETE SET NULL;

ALTER TABLE content_library_items
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES knowledge_topics(id) ON DELETE SET NULL;

ALTER TABLE ai_content_items
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES knowledge_topics(id) ON DELETE SET NULL;

ALTER TABLE question_collections
  ADD COLUMN IF NOT EXISTS topic_id UUID REFERENCES knowledge_topics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_question_bank_topic_id ON question_bank(topic_id) WHERE topic_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_flashcards_topic_id ON flashcards(topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_library_topic_id ON content_library_items(topic_id) WHERE topic_id IS NOT NULL;
