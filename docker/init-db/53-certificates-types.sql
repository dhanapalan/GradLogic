ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS cert_type TEXT NOT NULL DEFAULT 'course_completion',
  ADD COLUMN IF NOT EXISTS drive_id UUID REFERENCES assessment_drives(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journey_id UUID;

-- Backfill null-safe default for older rows before check constraint
UPDATE certificates SET cert_type = 'course_completion' WHERE cert_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'certificates_cert_type_check'
  ) THEN
    ALTER TABLE certificates
      ADD CONSTRAINT certificates_cert_type_check
      CHECK (cert_type IN (
        'practice_completion',
        'course_completion',
        'placement_track_completion'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_certificates_type ON certificates(cert_type);
CREATE INDEX IF NOT EXISTS idx_certificates_drive ON certificates(drive_id)
  WHERE drive_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS certificates_student_drive_uniq
  ON certificates (student_id, drive_id)
  WHERE drive_id IS NOT NULL AND cert_type = 'practice_completion';

CREATE UNIQUE INDEX IF NOT EXISTS certificates_student_path_track_uniq
  ON certificates (student_id, path_id)
  WHERE path_id IS NOT NULL AND cert_type = 'placement_track_completion';
