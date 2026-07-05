-- Links question_bank rows to specific colleges. Used by the superadmin AI
-- Question Generator's "assign to colleges" option: an unassigned question is
-- global; an assigned question is earmarked for the listed colleges.

CREATE TABLE IF NOT EXISTS question_college_assignments (
  question_id UUID NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
  college_id  UUID NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (question_id, college_id)
);

CREATE INDEX IF NOT EXISTS idx_qca_college ON question_college_assignments(college_id);
