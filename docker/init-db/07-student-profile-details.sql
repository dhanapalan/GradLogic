-- =============================================================================
-- Nallas Campus Connect — Extended Student Profile Fields
-- =============================================================================
-- Adds personal/contact/academic/professional fields requested for onboarding.
-- Idempotent and safe for existing databases.
-- =============================================================================

ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS middle_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(120),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(30),
  ADD COLUMN IF NOT EXISTS alternate_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS alternate_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS specialization VARCHAR(150),
  ADD COLUMN IF NOT EXISTS passing_year INT,
  ADD COLUMN IF NOT EXISTS cgpa NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS resume_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS skills TEXT[],
  ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS github_url VARCHAR(500);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_details_gender'
  ) THEN
    ALTER TABLE student_details
      ADD CONSTRAINT chk_student_details_gender
      CHECK (
        gender IS NULL OR gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_details_passing_year'
  ) THEN
    ALTER TABLE student_details
      ADD CONSTRAINT chk_student_details_passing_year
      CHECK (passing_year IS NULL OR (passing_year >= 1900 AND passing_year <= 2200));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_details_cgpa'
  ) THEN
    ALTER TABLE student_details
      ADD CONSTRAINT chk_student_details_cgpa
      CHECK (cgpa IS NULL OR (cgpa >= 0 AND cgpa <= 10));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_student_details_percentage'
  ) THEN
    ALTER TABLE student_details
      ADD CONSTRAINT chk_student_details_percentage
      CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_student_details_passing_year
  ON student_details (passing_year);

CREATE INDEX IF NOT EXISTS idx_student_details_specialization
  ON student_details (specialization);

CREATE INDEX IF NOT EXISTS idx_student_details_gender
  ON student_details (gender);

-- Recompute onboarding completion for all students based on extended required fields.
UPDATE users u
SET is_profile_complete = EXISTS (
  SELECT 1
  FROM student_details sd
  WHERE sd.user_id = u.id
    AND COALESCE(NULLIF(sd.first_name, ''), NULLIF(SPLIT_PART(COALESCE(u.name, ''), ' ', 1), '')) IS NOT NULL
    AND COALESCE(NULLIF(sd.last_name, ''), NULLIF(TRIM(REGEXP_REPLACE(COALESCE(u.name, ''), '^\\S+\\s*', '')), '')) IS NOT NULL
    AND sd.dob IS NOT NULL
    AND COALESCE(NULLIF(sd.phone_number, ''), NULLIF(u.phone_number, '')) IS NOT NULL
    AND sd.degree IS NOT NULL
    AND sd.specialization IS NOT NULL
    AND sd.passing_year IS NOT NULL
    AND (sd.cgpa IS NOT NULL OR sd.percentage IS NOT NULL)
    AND sd.student_identifier IS NOT NULL
    AND sd.resume_url IS NOT NULL
)
WHERE LOWER(u.role::text) = 'student';
