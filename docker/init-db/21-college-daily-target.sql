-- 21-college-daily-target.sql
-- Per-college daily practice target for students. The college placement office
-- sets how many practice sessions a student should complete each day; the
-- student portal shows today's progress against this value plus their streak.

ALTER TABLE colleges
  ADD COLUMN IF NOT EXISTS daily_practice_target INTEGER NOT NULL DEFAULT 1;

-- Keep the value sane (0 disables the target; cap avoids accidental huge goals).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_colleges_daily_practice_target'
  ) THEN
    ALTER TABLE colleges
      ADD CONSTRAINT chk_colleges_daily_practice_target
      CHECK (daily_practice_target >= 0 AND daily_practice_target <= 20);
  END IF;
END $$;
