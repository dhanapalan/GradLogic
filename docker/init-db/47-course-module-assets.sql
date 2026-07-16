-- =============================================================================
-- 47 — Course Builder: Knowledge Library asset assembly + course metadata
-- Polymorphic join: modules assemble reusable KL assets (no content authoring).
-- =============================================================================

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS language VARCHAR(32) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS subject VARCHAR(150),
  ADD COLUMN IF NOT EXISTS estimated_minutes INT;

CREATE TABLE IF NOT EXISTS course_module_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID NOT NULL REFERENCES course_modules(id) ON DELETE CASCADE,
  asset_type  VARCHAR(40) NOT NULL
    CHECK (asset_type IN (
      'question', 'coding_challenge', 'flashcard', 'content', 'lesson', 'voice_lesson'
    )),
  asset_id    UUID NOT NULL,
  role        VARCHAR(40) NOT NULL
    CHECK (role IN (
      'lesson', 'practice', 'coding', 'assessment', 'resource', 'voice'
    )),
  sort_order  INT NOT NULL DEFAULT 0,
  meta        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, asset_type, asset_id, role)
);

CREATE INDEX IF NOT EXISTS idx_course_module_assets_module
  ON course_module_assets(module_id);

CREATE INDEX IF NOT EXISTS idx_course_module_assets_asset
  ON course_module_assets(asset_type, asset_id);

CREATE INDEX IF NOT EXISTS idx_course_module_assets_role
  ON course_module_assets(module_id, role);
