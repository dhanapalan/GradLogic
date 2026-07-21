-- ============================================================================
-- IDOR / cross-tenant test fixture — TWO isolated colleges, each with an admin
-- and a student. Lets the authenticated pentest exercise T3 (a college admin
-- reading ANOTHER college's student), which needs ≥2 tenants worth of data.
--
-- VALIDATION ENVIRONMENT ONLY. All rows are clearly test data (@test.local,
-- password 'idortest123'). Remove with the teardown block at the bottom when
-- done — do NOT leave these accounts on any environment that becomes real.
--
-- Run:
--   cd /opt/talentsecure && set -a; . ./.env; set +a
--   docker exec -i talentsecure-postgres \
--     psql -U "${PG_USER:-talentsecure}" -d "${PG_DATABASE:-talentsecure}" \
--     < docs/security/idor-fixture.sql
-- ============================================================================

BEGIN;

-- Two isolated tenants
INSERT INTO colleges (college_code, name, is_active) VALUES
  ('IDOR-A', 'IDOR Test College A', TRUE),
  ('IDOR-B', 'IDOR Test College B', TRUE)
ON CONFLICT (college_code) DO NOTHING;

-- One college_admin per college (these are the accounts we log in as)
INSERT INTO users (role, name, email, password, college_id, is_active)
SELECT 'college_admin', 'IDOR Admin A', 'idor-admin-a@test.local',
       crypt('idortest123', gen_salt('bf', 12)), c.id, TRUE
FROM colleges c WHERE c.college_code = 'IDOR-A'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (role, name, email, password, college_id, is_active)
SELECT 'college_admin', 'IDOR Admin B', 'idor-admin-b@test.local',
       crypt('idortest123', gen_salt('bf', 12)), c.id, TRUE
FROM colleges c WHERE c.college_code = 'IDOR-B'
ON CONFLICT (email) DO NOTHING;

-- One student per college (the IDOR target resources)
INSERT INTO users (role, name, email, password, college_id, is_active, is_profile_complete)
SELECT 'student', 'IDOR Student A1', 'idor-stu-a1@test.local',
       crypt('idortest123', gen_salt('bf', 12)), c.id, TRUE, TRUE
FROM colleges c WHERE c.college_code = 'IDOR-A'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (role, name, email, password, college_id, is_active, is_profile_complete)
SELECT 'student', 'IDOR Student B1', 'idor-stu-b1@test.local',
       crypt('idortest123', gen_salt('bf', 12)), c.id, TRUE, TRUE
FROM colleges c WHERE c.college_code = 'IDOR-B'
ON CONFLICT (email) DO NOTHING;

-- student_details rows — campus.students listing/detail JOINs on these
INSERT INTO student_details (user_id, college_id, student_identifier)
SELECT u.id, u.college_id, 'IDOR-A-001'
FROM users u WHERE u.email = 'idor-stu-a1@test.local'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO student_details (user_id, college_id, student_identifier)
SELECT u.id, u.college_id, 'IDOR-B-001'
FROM users u WHERE u.email = 'idor-stu-b1@test.local'
ON CONFLICT (user_id) DO NOTHING;

COMMIT;

-- Confirm what exists (note the student user ids — the IDOR probe targets them)
SELECT u.id, u.email, u.role, c.college_code, sd.student_identifier
FROM users u
LEFT JOIN colleges c        ON c.id = u.college_id
LEFT JOIN student_details sd ON sd.user_id = u.id
WHERE u.email LIKE 'idor-%@test.local'
ORDER BY c.college_code, u.role;

-- ============================================================================
-- TEARDOWN — run this after testing to remove the fixture:
--
--   DELETE FROM student_details WHERE user_id IN
--     (SELECT id FROM users WHERE email LIKE 'idor-%@test.local');
--   DELETE FROM users    WHERE email LIKE 'idor-%@test.local';
--   DELETE FROM colleges WHERE college_code IN ('IDOR-A','IDOR-B');
-- ============================================================================
