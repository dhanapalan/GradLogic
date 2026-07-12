-- Relax passing_year CHECK: allow any plausible calendar year, not only 2000–2100.
ALTER TABLE student_details DROP CONSTRAINT IF EXISTS chk_student_details_passing_year;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_details_passing_year'
  ) THEN
    ALTER TABLE student_details
      ADD CONSTRAINT chk_student_details_passing_year
      CHECK (
        passing_year IS NULL
        OR (passing_year >= 1900 AND passing_year <= 2200)
      );
  END IF;
END $$;
