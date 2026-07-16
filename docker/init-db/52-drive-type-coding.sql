-- Assessment Hub · Coding Assessments (Phase 1: Python / Java)
ALTER TABLE assessment_drives DROP CONSTRAINT IF EXISTS assessment_drives_drive_type_check;
ALTER TABLE assessment_drives ADD CONSTRAINT assessment_drives_drive_type_check
  CHECK (drive_type IN (
    'hiring',
    'skill_development',
    'practice_test',
    'mock_test',
    'coding_assessment'
  ));
