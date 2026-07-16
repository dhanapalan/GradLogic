-- Assessment Builder assemble config (sections / mix metadata)
ALTER TABLE assessment_drives
  ADD COLUMN IF NOT EXISTS assembler_config JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE drive_source_collections
  ADD COLUMN IF NOT EXISTS section_name TEXT;

CREATE INDEX IF NOT EXISTS idx_drive_assembler_config
  ON assessment_drives USING GIN (assembler_config);
