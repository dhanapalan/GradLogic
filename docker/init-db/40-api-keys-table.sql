-- Superadmin-managed API key overrides. Encrypted values only — the
-- plaintext key is never stored. When a row is active, it overrides the
-- corresponding env var at server boot / on save; deleting the row falls
-- back to the env var again (requires a restart to fully revert).
CREATE TABLE IF NOT EXISTS api_keys (
  service_key   TEXT PRIMARY KEY,
  encrypted_value TEXT NOT NULL,
  iv            TEXT NOT NULL,
  auth_tag      TEXT NOT NULL,
  last4         TEXT NOT NULL,
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
