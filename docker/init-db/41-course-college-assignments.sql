-- Per-college course availability. A course with zero rows here is available
-- to every college (backward compatible with existing published courses);
-- once at least one row exists, only those colleges see it.
CREATE TABLE IF NOT EXISTS course_college_assignments (
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  college_id  UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (course_id, college_id)
);

CREATE INDEX IF NOT EXISTS idx_course_college_assignments_college ON course_college_assignments(college_id);
