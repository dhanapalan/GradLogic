-- Assessment Builder now lets admins create Practice Tests and Mock Tests,
-- not just hiring drives. The existing CHECK constraint only allowed
-- 'hiring'/'skill_development' — extend it rather than drop it.
ALTER TABLE assessment_drives DROP CONSTRAINT IF EXISTS assessment_drives_drive_type_check;
ALTER TABLE assessment_drives ADD CONSTRAINT assessment_drives_drive_type_check
  CHECK (drive_type IN ('hiring', 'skill_development', 'practice_test', 'mock_test'));
