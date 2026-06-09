-- P2 pgvector Migration
-- Adds semantic embedding support so questions can be deduplicated and searched
-- without a separate vector database. All vectors live in Postgres alongside
-- the relational data they describe.

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to question_bank
-- vector(1536) matches OpenAI text-embedding-3-small and sentence-transformers/all-mpnet-base-v2
-- Using 384 for sentence-transformers/all-MiniLM-L6-v2 (lighter, runs in the AI engine)
ALTER TABLE question_bank
  ADD COLUMN IF NOT EXISTS embedding vector(384);

-- HNSW index for approximate nearest-neighbour search (cosine distance)
-- Much faster than exact search at the cost of ~5% recall — acceptable for dedup/search.
CREATE INDEX IF NOT EXISTS idx_qb_embedding_hnsw
  ON question_bank
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
