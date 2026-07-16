-- Sprint 2.2 — optional register_number + semester on student_details
ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS register_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS semester VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_student_details_register_number
  ON student_details (college_id, register_number)
  WHERE register_number IS NOT NULL;
