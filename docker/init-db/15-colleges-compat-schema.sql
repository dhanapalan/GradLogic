-- ============================================================================
-- colleges compatibility columns for the superadmin college controller.
-- The base colleges table only carries name/college_code/approval_status; the
-- superadmin CRUD expects contact + status fields. Idempotent.
-- ============================================================================

ALTER TABLE colleges ADD COLUMN IF NOT EXISTS status  VARCHAR(20) DEFAULT 'pending';
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS email   VARCHAR(255);
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS phone   VARCHAR(30);
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS city    VARCHAR(120);
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS state   VARCHAR(120);
-- Declared in prisma schema; used by approve/reject + campus bulk actions
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed status from the existing approval_status so filters behave sensibly.
UPDATE colleges
   SET status = COALESCE(
     status,
     CASE approval_status::text
       WHEN 'approved' THEN 'active'
       WHEN 'rejected' THEN 'suspended'
       ELSE 'pending'
     END
   );

CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges(status) WHERE deleted_at IS NULL;
