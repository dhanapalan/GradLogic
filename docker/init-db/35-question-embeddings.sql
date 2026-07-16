-- Phase 10 — AI Semantic Search.
--
-- No pgvector extension is installed in this database (confirmed:
-- `SELECT * FROM pg_available_extensions WHERE name = 'vector'` returns zero
-- rows), so this stores each embedding as a plain float array rather than a
-- `vector` column — cosine similarity is computed in application code
-- (server/src/services/aiSearch.service.ts), not via an indexed `<=>` operator.
-- This is intentionally a *different* column from the `embedding vector`
-- references already present (but never executed, since embed() always
-- returned an empty vector before this phase) in questionBank.service.ts's
-- dedup code — that pre-existing pgvector-shaped code is out of scope here.
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS search_embedding DOUBLE PRECISION[];
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS search_embedding_model VARCHAR(100);
