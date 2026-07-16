-- =============================================================================
-- 51 — Assessment Builder: link drives to Question Collections (pool source)
-- =============================================================================

CREATE TABLE IF NOT EXISTS drive_source_collections (
  drive_id      UUID NOT NULL REFERENCES assessment_drives(id) ON DELETE CASCADE,
  collection_id UUID NOT NULL REFERENCES question_collections(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (drive_id, collection_id)
);

CREATE INDEX IF NOT EXISTS idx_drive_source_collections_collection
  ON drive_source_collections(collection_id);
