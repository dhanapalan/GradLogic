-- =============================================================================
-- Phase 10 — LMS Certificates + Learning Path Enrollment
-- =============================================================================

-- Certificates (issued on 100% course or program completion)
CREATE TABLE IF NOT EXISTS certificates (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id     UUID        REFERENCES courses(id) ON DELETE SET NULL,
  program_id    UUID        REFERENCES skill_programs(id) ON DELETE SET NULL,
  title         VARCHAR(300),          -- course/program name at time of issue
  issued_at     TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_cert_student_course  UNIQUE (student_id, course_id),
  CONSTRAINT uq_cert_student_program UNIQUE (student_id, program_id),
  CONSTRAINT cert_has_source CHECK (course_id IS NOT NULL OR program_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_cert_student ON certificates(student_id);
