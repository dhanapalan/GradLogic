-- Ensure colleges.is_active / is_suspended exist (used by approve/reject + campus bulk actions).
-- Idempotent — safe on DBs that already have these columns via prisma db push.

ALTER TABLE colleges ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
