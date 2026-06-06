-- Creates judge0's user and database inside the shared postgres instance.
-- Runs only on first volume initialisation. For existing volumes, run manually:
--   docker exec talentsecure-postgres psql -U talentsecure -c "CREATE USER judge0 WITH PASSWORD 'judge0secret';"
--   docker exec talentsecure-postgres psql -U talentsecure -c "CREATE DATABASE judge0_db OWNER judge0;"
CREATE USER judge0 WITH PASSWORD 'judge0secret';
CREATE DATABASE judge0_db OWNER judge0;
