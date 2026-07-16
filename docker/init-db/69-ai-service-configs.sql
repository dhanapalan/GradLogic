-- Platform Administration → AI Configuration
-- CRUD registry for AI services/providers (keys stay encrypted in api_keys).

CREATE TABLE IF NOT EXISTS ai_service_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  purpose TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  api_endpoint TEXT,
  organization_id TEXT,
  project_id TEXT,
  deployment_name TEXT,
  region TEXT,
  env_var TEXT,
  timeout_ms INT NOT NULL DEFAULT 30000,
  retry_count INT NOT NULL DEFAULT 2,
  max_tokens INT,
  temperature NUMERIC(4,3),
  top_p NUMERIC(4,3),
  streaming_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit_rpm INT,
  concurrency INT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  used_by JSONB NOT NULL DEFAULT '[]'::jsonb,
  note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_service_configs_active
  ON ai_service_configs (is_enabled)
  WHERE deleted_at IS NULL;

-- Seed built-in services (idempotent)
INSERT INTO ai_service_configs (
  service_key, name, purpose, provider, model, env_var, is_system, is_enabled, used_by, note
) VALUES
  (
    'question_bank',
    'Question Bank',
    'AI question generation',
    'groq',
    'llama-3.3-70b-versatile',
    NULL,
    TRUE,
    TRUE,
    '["AI Question Generator","Question bank RAG search","Document ingestion"]'::jsonb,
    'Key is held by the Python engine (ai-engine/question_bank_engine/.env · GROQ_API_KEY).'
  ),
  (
    'voice_interview',
    'Voice Interview',
    'AI voice mock interviews',
    'vapi',
    NULL,
    'VAPI_API_KEY',
    TRUE,
    TRUE,
    '["Voice mock interviews"]'::jsonb,
    NULL
  ),
  (
    'resume_extraction',
    'Resume & Feedback',
    'Resume parsing and feedback',
    'anthropic',
    NULL,
    'ANTHROPIC_API_KEY',
    TRUE,
    TRUE,
    '["Resume extraction","AI feedback"]'::jsonb,
    NULL
  ),
  (
    'drive_generation',
    'Drive Question Fallback',
    'Legacy drive question generation',
    'openai',
    NULL,
    'OPENAI_API_KEY',
    TRUE,
    TRUE,
    '["Assessment drive question generation (fallback)"]'::jsonb,
    'Optional — a built-in mock generator is used when unset.'
  ),
  (
    'code_execution',
    'Code Execution',
    'Coding-challenge sandbox',
    'judge0',
    NULL,
    'JUDGE0_API_KEY',
    TRUE,
    TRUE,
    '["Coding-challenge evaluation","Code sandbox execution"]'::jsonb,
    'Self-hosted Judge0 needs no key.'
  )
ON CONFLICT (service_key) DO NOTHING;
