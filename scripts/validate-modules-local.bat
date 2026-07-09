@echo off
REM Local validation script for Modular Feature System + route guards
REM Run from repo root after: docker compose up -d

echo.
echo === 1. Health check ===
curl -s http://localhost:3000/api/health
echo.

echo.
echo === 2. Feature modules in DB ===
docker exec talentsecure-postgres psql -U talentsecure -d talentsecure_db -c "SELECT key, name, status FROM feature_modules WHERE deleted_at IS NULL ORDER BY name;"

echo.
echo === 3. Demo College module assignments ===
docker exec talentsecure-postgres psql -U talentsecure -d talentsecure_db -c "SELECT fm.key, cma.enabled FROM college_module_assignments cma JOIN feature_modules fm ON fm.id = cma.module_id JOIN colleges c ON c.id = cma.college_id WHERE c.name = 'Demo College' ORDER BY fm.key;"

echo.
echo === 4. Expected enabled features for Demo College (Campus Core only) ===
echo    students, assessments, settings
echo    BLOCKED: analytics, question_bank, workflows, soft_skills, technical_skills
echo.
echo === 5. Manual browser tests ===
echo    Login: http://localhost:3000/auth/login
echo    College: college@gradlogic.com
echo.
echo    ALLOWED URLs:
echo      http://localhost:3000/app/college-portal/dashboard
echo      http://localhost:3000/app/college-portal/students
echo      http://localhost:3000/app/college-portal/assessments
echo      http://localhost:3000/app/college-portal/settings
echo.
echo    BLOCKED URLs (should show Feature Not Enabled):
echo      http://localhost:3000/app/college-portal/analytics
echo      http://localhost:3000/app/college-portal/question-bank
echo      http://localhost:3000/app/college-portal/workflows
echo.
echo    Super Admin modules page:
echo      http://localhost:3000/app/superadmin/modules
echo.
