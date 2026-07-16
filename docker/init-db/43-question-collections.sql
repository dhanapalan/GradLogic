-- Named, reusable groups of question_bank rows — distinct from category/tags,
-- which are per-question facets, not a curated set an admin assembles once
-- and reuses across multiple assessment drives.
CREATE TABLE IF NOT EXISTS question_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_collection_items (
  collection_id UUID NOT NULL REFERENCES question_collections(id) ON DELETE CASCADE,
  question_id   UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (collection_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_qc_items_question ON question_collection_items(question_id);

-- Assessment Builder needs to know which test type it's building — the
-- column already exists (drive_type varchar) but only 'hiring' was ever
-- written. No migration needed to add practice_test/mock_test values since
-- the column is unconstrained text; this comment documents the new values.
