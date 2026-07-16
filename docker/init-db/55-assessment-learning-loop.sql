-- Continuous learning loop fields on post-assessment insights:
-- Evaluate → Weak skills → KL lesson → Practice set → Journey → Readiness
ALTER TABLE student_assessment_insights
  ADD COLUMN IF NOT EXISTS recommended_lesson_id UUID,
  ADD COLUMN IF NOT EXISTS recommended_lesson_title TEXT,
  ADD COLUMN IF NOT EXISTS recommended_lesson_source TEXT,
  ADD COLUMN IF NOT EXISTS recommended_lesson_href TEXT,
  ADD COLUMN IF NOT EXISTS assigned_practice_topic TEXT,
  ADD COLUMN IF NOT EXISTS assigned_practice_difficulty TEXT,
  ADD COLUMN IF NOT EXISTS assigned_practice_drive_id UUID REFERENCES assessment_drives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_practice_href TEXT,
  ADD COLUMN IF NOT EXISTS loop_status JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS loop_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sai_practice_drive
  ON student_assessment_insights (assigned_practice_drive_id)
  WHERE assigned_practice_drive_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sai_lesson
  ON student_assessment_insights (recommended_lesson_id)
  WHERE recommended_lesson_id IS NOT NULL;
