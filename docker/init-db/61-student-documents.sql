-- Sprint 2.4 — Student Documents (version-safe uploads)
CREATE TABLE IF NOT EXISTS student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id UUID NOT NULL REFERENCES colleges(id),
  user_id UUID NOT NULL REFERENCES users(id),
  doc_type VARCHAR(50) NOT NULL,
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT TRUE,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  storage_key TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  uploaded_by UUID REFERENCES users(id),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_documents_doc_type_check CHECK (
    doc_type IN (
      'resume',
      'photo',
      'id_card',
      'marksheet_10th',
      'marksheet_12th',
      'degree_certificate'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_student_documents_user
  ON student_documents (user_id, doc_type)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_documents_current
  ON student_documents (user_id, doc_type)
  WHERE is_current = TRUE AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_documents_hash
  ON student_documents (user_id, content_hash)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_documents_college
  ON student_documents (college_id)
  WHERE deleted_at IS NULL;
