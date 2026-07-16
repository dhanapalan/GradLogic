-- =============================================================================
-- 49 — Course Catalog assignment enrichment (notes, meta, optional batch)
-- =============================================================================

ALTER TABLE course_college_assignments
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES college_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_course_college_assignments_batch
  ON course_college_assignments(batch_id)
  WHERE batch_id IS NOT NULL;
