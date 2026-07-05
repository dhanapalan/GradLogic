-- Adds Bloom's Taxonomy classification to question_bank so the superadmin
-- Question Bank landing page can filter by cognitive level. Nullable —
-- existing questions have no historical classification and are left
-- unclassified rather than backfilled with a guess.

ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS bloom_level VARCHAR(20);

ALTER TABLE question_bank
  DROP CONSTRAINT IF EXISTS chk_bloom_level;

ALTER TABLE question_bank
  ADD CONSTRAINT chk_bloom_level CHECK (
    bloom_level IS NULL OR bloom_level IN (
      'remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'
    )
  );

CREATE INDEX IF NOT EXISTS idx_qb_bloom_level ON question_bank(bloom_level);
