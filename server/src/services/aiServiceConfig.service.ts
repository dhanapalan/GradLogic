/**
 * Platform Administration → AI Configuration
 * CRUD for AI service/provider configs. API keys encrypted via apiKeyStore.
 */

import { query, queryOne } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";
import * as apiKeyStore from "./apiKeyStore.service.js";

export const KNOWN_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "azure_openai",
  "aws_bedrock",
  "groq",
  "openrouter",
  "ollama",
  "vapi",
  "judge0",
  "custom",
] as const;

export type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export interface AiServiceConfigRow {
  id: string;
  service_key: string;
  name: string;
  purpose: string | null;
  provider: string;
  model: string | null;
  api_endpoint: string | null;
  organization_id: string | null;
  project_id: string | null;
  deployment_name: string | null;
  region: string | null;
  env_var: string | null;
  timeout_ms: number;
  retry_count: number;
  max_tokens: number | null;
  temperature: number | null;
  top_p: number | null;
  streaming_enabled: boolean;
  rate_limit_rpm: number | null;
  concurrency: number | null;
  is_enabled: boolean;
  is_system: boolean;
  used_by: unknown;
  note: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AiServiceStatusDto {
  id: string;
  key: string;
  name: string;
  purpose: string;
  provider: string;
  model: string | null;
  api_endpoint: string | null;
  organization_id: string | null;
  project_id: string | null;
  deployment_name: string | null;
  region: string | null;
  timeout_ms: number;
  retry_count: number;
  max_tokens: number | null;
  temperature: number | null;
  top_p: number | null;
  streaming_enabled: boolean;
  rate_limit_rpm: number | null;
  concurrency: number | null;
  is_enabled: boolean;
  is_system: boolean;
  key_location: string;
  configured: boolean;
  last4: string | null;
  reachable: boolean | null;
  testable: boolean;
  editable: boolean;
  deletable: boolean;
  source: "database" | "environment" | "unset";
  updated_at: string | null;
  components: Record<string, string> | null;
  used_by: string[];
  note: string | null;
}

export interface CreateAiServiceInput {
  service_key: string;
  name: string;
  purpose?: string;
  provider: string;
  model?: string | null;
  api_endpoint?: string | null;
  organization_id?: string | null;
  project_id?: string | null;
  deployment_name?: string | null;
  region?: string | null;
  timeout_ms?: number;
  retry_count?: number;
  max_tokens?: number | null;
  temperature?: number | null;
  top_p?: number | null;
  streaming_enabled?: boolean;
  rate_limit_rpm?: number | null;
  concurrency?: number | null;
  is_enabled?: boolean;
  used_by?: string[];
  note?: string | null;
  api_key?: string | null;
}

export type UpdateAiServiceInput = Partial<Omit<CreateAiServiceInput, "service_key" | "api_key">> & {
  api_key?: string | null;
};

let schemaReady = false;

const SLUG_RE = /^[a-z][a-z0-9_]{1,62}$/;

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

function slugify(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 63);
}

export async function ensureAiServiceConfigSchema(): Promise<void> {
  if (schemaReady) return;

  await query(`
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
    )
  `);

  await query(`
    CREATE INDEX IF NOT EXISTS idx_ai_service_configs_active
      ON ai_service_configs (is_enabled)
      WHERE deleted_at IS NULL
  `).catch(() => {});

  await query(
    `
    INSERT INTO ai_service_configs (
      service_key, name, purpose, provider, model, env_var, is_system, is_enabled, used_by, note
    ) VALUES
      ('question_bank', 'Question Bank', 'AI question generation', 'groq',
       'llama-3.3-70b-versatile', NULL, TRUE, TRUE,
       '["AI Question Generator","Question bank RAG search","Document ingestion"]'::jsonb,
       'Key is held by the Python engine (ai-engine/question_bank_engine/.env · GROQ_API_KEY).'),
      ('voice_interview', 'Voice Interview', 'AI voice mock interviews', 'vapi',
       NULL, 'VAPI_API_KEY', TRUE, TRUE, '["Voice mock interviews"]'::jsonb, NULL),
      ('resume_extraction', 'Resume & Feedback', 'Resume parsing and feedback', 'anthropic',
       NULL, 'ANTHROPIC_API_KEY', TRUE, TRUE, '["Resume extraction","AI feedback"]'::jsonb, NULL),
      ('drive_generation', 'Drive Question Fallback', 'Legacy drive question generation', 'openai',
       NULL, 'OPENAI_API_KEY', TRUE, TRUE,
       '["Assessment drive question generation (fallback)"]'::jsonb,
       'Optional — a built-in mock generator is used when unset.'),
      ('code_execution', 'Code Execution', 'Coding-challenge sandbox', 'judge0',
       NULL, 'JUDGE0_API_KEY', TRUE, TRUE,
       '["Coding-challenge evaluation","Code sandbox execution"]'::jsonb,
       'Self-hosted Judge0 needs no key.')
    ON CONFLICT (service_key) DO NOTHING
  `
  ).catch(() => {});

  schemaReady = true;
}

async function getRow(serviceKey: string): Promise<AiServiceConfigRow | null> {
  return queryOne<AiServiceConfigRow>(
    `SELECT * FROM ai_service_configs WHERE service_key = $1 AND deleted_at IS NULL`,
    [serviceKey]
  );
}

function maskEnv(v?: string | null): string | null {
  return v && v.length >= 4 ? v.slice(-4) : null;
}

function envValueFor(envVar: string | null | undefined): string {
  if (!envVar) return "";
  return String((env as Record<string, unknown>)[envVar] || process.env[envVar] || "");
}

async function toStatusDto(
  row: AiServiceConfigRow,
  extras?: { components?: Record<string, string> | null; reachable?: boolean | null }
): Promise<AiServiceStatusDto> {
  const keyMeta = await apiKeyStore.getMeta(row.service_key);
  const dbLast4 = await apiKeyStore.getLast4(row.service_key);
  const envVal = envValueFor(row.env_var);
  const envLast4 = maskEnv(envVal);

  const source =
    keyMeta.source === "database"
      ? "database"
      : envVal
        ? "environment"
        : row.service_key === "question_bank"
          ? extras?.reachable
            ? "environment"
            : "unset"
          : "unset";

  const last4 = dbLast4 || envLast4;
  const configured =
    source !== "unset" ||
    (row.service_key === "question_bank" && !!extras?.reachable) ||
    (row.provider === "judge0" && extras?.reachable === true);

  const key_location =
    row.service_key === "question_bank"
      ? "ai-engine/question_bank_engine/.env · GROQ_API_KEY"
      : row.env_var
        ? `server .env · ${row.env_var}`
        : "Platform database (encrypted)";

  return {
    id: row.id,
    key: row.service_key,
    name: row.name,
    purpose: row.purpose || "",
    provider: row.provider,
    model: row.model,
    api_endpoint: row.api_endpoint,
    organization_id: row.organization_id,
    project_id: row.project_id,
    deployment_name: row.deployment_name,
    region: row.region,
    timeout_ms: Number(row.timeout_ms || 30000),
    retry_count: Number(row.retry_count || 2),
    max_tokens: row.max_tokens != null ? Number(row.max_tokens) : null,
    temperature: row.temperature != null ? Number(row.temperature) : null,
    top_p: row.top_p != null ? Number(row.top_p) : null,
    streaming_enabled: !!row.streaming_enabled,
    rate_limit_rpm: row.rate_limit_rpm != null ? Number(row.rate_limit_rpm) : null,
    concurrency: row.concurrency != null ? Number(row.concurrency) : null,
    is_enabled: !!row.is_enabled,
    is_system: !!row.is_system,
    key_location,
    configured,
    last4,
    reachable: extras?.reachable ?? null,
    testable: configured || row.provider === "judge0" || row.service_key === "question_bank",
    editable: row.service_key !== "question_bank",
    deletable: !row.is_system,
    source,
    updated_at: keyMeta.updated_at || row.updated_at,
    components: extras?.components ?? null,
    used_by: asStringArray(row.used_by),
    note: row.note,
  };
}

export async function listAiServices(): Promise<AiServiceStatusDto[]> {
  await ensureAiServiceConfigSchema();
  const rows = await query<AiServiceConfigRow>(
    `SELECT * FROM ai_service_configs WHERE deleted_at IS NULL ORDER BY is_system DESC, name ASC`
  );

  const engineUrl = process.env.QUESTION_ENGINE_URL || "http://host.docker.internal:8001";
  const [engineCheck, judge0Check] = await Promise.allSettled([
    fetch(`${engineUrl}/health`, { signal: AbortSignal.timeout(3000) }).then(async (r) =>
      r.ok ? ((await r.json()) as { components?: Record<string, string> }) : null
    ),
    fetch(`${env.JUDGE0_API_URL}/about`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok),
  ]);

  const engineHealth = engineCheck.status === "fulfilled" ? engineCheck.value : null;
  const judge0Online = judge0Check.status === "fulfilled" ? !!judge0Check.value : false;

  return Promise.all(
    rows.map((row) => {
      if (row.service_key === "question_bank") {
        return toStatusDto(row, {
          components: engineHealth?.components || null,
          reachable: !!engineHealth,
        });
      }
      if (row.service_key === "code_execution" || row.provider === "judge0") {
        return toStatusDto(row, { reachable: judge0Online });
      }
      return toStatusDto(row);
    })
  );
}

export async function getAiService(serviceKey: string): Promise<AiServiceStatusDto> {
  await ensureAiServiceConfigSchema();
  const row = await getRow(serviceKey);
  if (!row) throw new AppError("AI service not found", 404);
  const all = await listAiServices();
  const found = all.find((s) => s.key === serviceKey);
  if (!found) throw new AppError("AI service not found", 404);
  return found;
}

function validateProvider(provider: string) {
  const p = String(provider || "").trim().toLowerCase();
  if (!p) throw new AppError("provider is required", 400);
  return p;
}

export async function createAiService(
  input: CreateAiServiceInput,
  actorId: string
): Promise<AiServiceStatusDto> {
  await ensureAiServiceConfigSchema();

  const key = slugify(input.service_key || input.name);
  if (!SLUG_RE.test(key)) {
    throw new AppError("service_key must be a lowercase slug (a-z, 0-9, underscore)", 400);
  }
  if (!input.name?.trim()) throw new AppError("name is required", 400);
  const provider = validateProvider(input.provider);

  const existing = await queryOne<{ service_key: string }>(
    `SELECT service_key FROM ai_service_configs WHERE service_key = $1 AND deleted_at IS NULL`,
    [key]
  );
  if (existing) throw new AppError(`Service '${key}' already exists`, 409);

  await query(
    `INSERT INTO ai_service_configs (
       service_key, name, purpose, provider, model, api_endpoint,
       organization_id, project_id, deployment_name, region,
       timeout_ms, retry_count, max_tokens, temperature, top_p,
       streaming_enabled, rate_limit_rpm, concurrency, is_enabled,
       is_system, used_by, note, created_by, updated_by
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
       FALSE, $20::jsonb, $21, $22, $22
     )`,
    [
      key,
      input.name.trim(),
      input.purpose?.trim() || null,
      provider,
      input.model?.trim() || null,
      input.api_endpoint?.trim() || null,
      input.organization_id?.trim() || null,
      input.project_id?.trim() || null,
      input.deployment_name?.trim() || null,
      input.region?.trim() || null,
      Math.max(1000, Number(input.timeout_ms ?? 30000)),
      Math.max(0, Math.min(10, Number(input.retry_count ?? 2))),
      input.max_tokens != null ? Number(input.max_tokens) : null,
      input.temperature != null ? Number(input.temperature) : null,
      input.top_p != null ? Number(input.top_p) : null,
      input.streaming_enabled !== false,
      input.rate_limit_rpm != null ? Number(input.rate_limit_rpm) : null,
      input.concurrency != null ? Number(input.concurrency) : null,
      input.is_enabled !== false,
      JSON.stringify(input.used_by || []),
      input.note?.trim() || null,
      actorId,
    ]
  );

  if (input.api_key?.trim()) {
    await apiKeyStore.setKeyForService(key, input.api_key.trim(), actorId, null);
  }

  await writeAuditLog({
    actor_id: actorId,
    actor_role: "super_admin",
    action: "AI_SERVICE_CREATED",
    target_type: "ai_service_config",
    target_id: key,
    reason: `Created AI service ${input.name.trim()}`,
    metadata: { provider, service_key: key },
  }).catch(() => {});

  return getAiService(key);
}

export async function updateAiService(
  serviceKey: string,
  input: UpdateAiServiceInput,
  actorId: string
): Promise<AiServiceStatusDto> {
  await ensureAiServiceConfigSchema();
  const row = await getRow(serviceKey);
  if (!row) throw new AppError("AI service not found", 404);

  const provider = input.provider != null ? validateProvider(input.provider) : row.provider;

  const next = {
    name: input.name !== undefined ? input.name.trim() : row.name,
    purpose: input.purpose !== undefined ? input.purpose?.trim() || null : row.purpose,
    provider,
    model: input.model !== undefined ? input.model?.trim() || null : row.model,
    api_endpoint:
      input.api_endpoint !== undefined ? input.api_endpoint?.trim() || null : row.api_endpoint,
    organization_id:
      input.organization_id !== undefined
        ? input.organization_id?.trim() || null
        : row.organization_id,
    project_id:
      input.project_id !== undefined ? input.project_id?.trim() || null : row.project_id,
    deployment_name:
      input.deployment_name !== undefined
        ? input.deployment_name?.trim() || null
        : row.deployment_name,
    region: input.region !== undefined ? input.region?.trim() || null : row.region,
    timeout_ms:
      input.timeout_ms != null ? Math.max(1000, Number(input.timeout_ms)) : row.timeout_ms,
    retry_count:
      input.retry_count != null
        ? Math.max(0, Math.min(10, Number(input.retry_count)))
        : row.retry_count,
    max_tokens:
      input.max_tokens !== undefined
        ? input.max_tokens != null
          ? Number(input.max_tokens)
          : null
        : row.max_tokens,
    temperature:
      input.temperature !== undefined
        ? input.temperature != null
          ? Number(input.temperature)
          : null
        : row.temperature,
    top_p:
      input.top_p !== undefined
        ? input.top_p != null
          ? Number(input.top_p)
          : null
        : row.top_p,
    streaming_enabled:
      input.streaming_enabled != null ? !!input.streaming_enabled : row.streaming_enabled,
    rate_limit_rpm:
      input.rate_limit_rpm !== undefined
        ? input.rate_limit_rpm != null
          ? Number(input.rate_limit_rpm)
          : null
        : row.rate_limit_rpm,
    concurrency:
      input.concurrency !== undefined
        ? input.concurrency != null
          ? Number(input.concurrency)
          : null
        : row.concurrency,
    is_enabled: input.is_enabled != null ? !!input.is_enabled : row.is_enabled,
    used_by: input.used_by ? JSON.stringify(input.used_by) : JSON.stringify(asStringArray(row.used_by)),
    note: input.note !== undefined ? input.note?.trim() || null : row.note,
  };

  if (!next.name) throw new AppError("name is required", 400);

  await query(
    `UPDATE ai_service_configs SET
       name = $2, purpose = $3, provider = $4, model = $5, api_endpoint = $6,
       organization_id = $7, project_id = $8, deployment_name = $9, region = $10,
       timeout_ms = $11, retry_count = $12, max_tokens = $13, temperature = $14, top_p = $15,
       streaming_enabled = $16, rate_limit_rpm = $17, concurrency = $18, is_enabled = $19,
       used_by = $20::jsonb, note = $21, updated_by = $22, updated_at = NOW()
     WHERE service_key = $1 AND deleted_at IS NULL`,
    [
      serviceKey,
      next.name,
      next.purpose,
      next.provider,
      next.model,
      next.api_endpoint,
      next.organization_id,
      next.project_id,
      next.deployment_name,
      next.region,
      next.timeout_ms,
      next.retry_count,
      next.max_tokens,
      next.temperature,
      next.top_p,
      next.streaming_enabled,
      next.rate_limit_rpm,
      next.concurrency,
      next.is_enabled,
      next.used_by,
      next.note,
      actorId,
    ]
  );

  if (input.api_key?.trim()) {
    if (serviceKey === "question_bank") {
      throw new AppError("Question Bank keys are managed in the Python engine .env", 400);
    }
    await apiKeyStore.setKeyForService(serviceKey, input.api_key.trim(), actorId, row.env_var);
  }

  await writeAuditLog({
    actor_id: actorId,
    actor_role: "super_admin",
    action: "AI_SERVICE_UPDATED",
    target_type: "ai_service_config",
    target_id: serviceKey,
    reason: `Updated AI service ${serviceKey}`,
    metadata: { fields: Object.keys(input).filter((k) => k !== "api_key") },
  }).catch(() => {});

  return getAiService(serviceKey);
}

export async function deleteAiService(serviceKey: string, actorId: string): Promise<void> {
  await ensureAiServiceConfigSchema();
  const row = await getRow(serviceKey);
  if (!row) throw new AppError("AI service not found", 404);
  if (row.is_system) {
    throw new AppError("Built-in platform services cannot be deleted. Disable them instead.", 400);
  }

  await query(
    `UPDATE ai_service_configs SET deleted_at = NOW(), is_enabled = FALSE, updated_by = $2, updated_at = NOW()
     WHERE service_key = $1 AND deleted_at IS NULL`,
    [serviceKey, actorId]
  );
  await apiKeyStore.revokeKeyForService(serviceKey, null).catch(() => {});

  await writeAuditLog({
    actor_id: actorId,
    actor_role: "super_admin",
    action: "AI_SERVICE_DELETED",
    target_type: "ai_service_config",
    target_id: serviceKey,
    reason: `Deleted AI service ${serviceKey}`,
    metadata: {},
  }).catch(() => {});
}

export async function setAiServiceKey(
  serviceKey: string,
  value: string,
  actorId: string
): Promise<void> {
  await ensureAiServiceConfigSchema();
  const row = await getRow(serviceKey);
  if (!row) throw new AppError("AI service not found", 404);
  if (serviceKey === "question_bank") {
    throw new AppError("Question Bank keys are managed in the Python engine .env", 400);
  }
  await apiKeyStore.setKeyForService(serviceKey, value, actorId, row.env_var);

  await writeAuditLog({
    actor_id: actorId,
    actor_role: "super_admin",
    action: "AI_SERVICE_KEY_SET",
    target_type: "ai_service_config",
    target_id: serviceKey,
    reason: "API key set/rotated",
    metadata: {},
  }).catch(() => {});
}

export async function revokeAiServiceKey(serviceKey: string, actorId: string): Promise<void> {
  await ensureAiServiceConfigSchema();
  const row = await getRow(serviceKey);
  if (!row) throw new AppError("AI service not found", 404);
  if (serviceKey === "question_bank") {
    throw new AppError("Question Bank keys are managed in the Python engine .env", 400);
  }
  await apiKeyStore.revokeKeyForService(serviceKey, row.env_var);

  await writeAuditLog({
    actor_id: actorId,
    actor_role: "super_admin",
    action: "AI_SERVICE_KEY_REVOKED",
    target_type: "ai_service_config",
    target_id: serviceKey,
    reason: "API key override revoked",
    metadata: {},
  }).catch(() => {});
}

export async function testAiService(serviceKey: string): Promise<{
  ok: boolean;
  message: string;
  latency_ms: number;
}> {
  await ensureAiServiceConfigSchema();
  const started = Date.now();
  const finish = (ok: boolean, message: string) => ({
    ok,
    message,
    latency_ms: Date.now() - started,
  });

  const row = await getRow(serviceKey);
  if (!row) throw new AppError("AI service not found", 404);
  if (!row.is_enabled) return finish(false, "Service is disabled");

  try {
    switch (serviceKey) {
      case "question_bank": {
        const url = process.env.QUESTION_ENGINE_URL || "http://host.docker.internal:8001";
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) return finish(false, `Engine returned ${r.status}`);
        const body = (await r.json()) as { components?: { llm?: string } };
        const llmOk = body?.components?.llm === "healthy";
        return finish(llmOk, llmOk ? "Engine healthy · LLM reachable" : "Engine up but LLM unhealthy");
      }
      case "code_execution": {
        const r = await fetch(`${env.JUDGE0_API_URL}/about`, { signal: AbortSignal.timeout(5000) });
        return finish(r.ok, r.ok ? "Judge0 reachable" : `Judge0 returned ${r.status}`);
      }
      case "resume_extraction": {
        const key = envValueFor("ANTHROPIC_API_KEY");
        if (!key) return finish(false, "ANTHROPIC_API_KEY is not set");
        const r = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(5000),
        });
        return finish(r.ok, r.ok ? "Anthropic key valid" : `Anthropic returned ${r.status}`);
      }
      case "drive_generation": {
        const key = envValueFor("OPENAI_API_KEY");
        if (!key) return finish(false, "OPENAI_API_KEY is not set");
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
        });
        return finish(r.ok, r.ok ? "OpenAI key valid" : `OpenAI returned ${r.status}`);
      }
      case "voice_interview": {
        const key = envValueFor("VAPI_API_KEY");
        if (!key) return finish(false, "VAPI_API_KEY is not set");
        const r = await fetch("https://api.vapi.ai/assistant?limit=1", {
          headers: { Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(5000),
        });
        return finish(r.ok, r.ok ? "Vapi key valid" : `Vapi returned ${r.status}`);
      }
      default: {
        // Custom / pluggable: probe endpoint if set, else validate key presence
        const stored = await apiKeyStore.getDecryptedKey(serviceKey);
        const key = stored || envValueFor(row.env_var);
        if (row.api_endpoint) {
          if (!key && row.provider !== "ollama") {
            return finish(false, "API key not set");
          }
          let resp: Response;
          try {
            resp = await fetch(row.api_endpoint, {
              method: "GET",
              headers: key ? { Authorization: `Bearer ${key}` } : {},
              signal: AbortSignal.timeout(Math.min(row.timeout_ms || 5000, 10000)),
            });
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : "Request failed";
            return finish(false, msg);
          }
          return finish(
            resp.ok || resp.status === 401 || resp.status === 403,
            resp.ok
              ? "Endpoint reachable"
              : `Endpoint returned ${resp.status} (key may still be valid)`
          );
        }
        if (!key) return finish(false, "API key not set");
        return finish(true, "Key stored (no probe endpoint configured)");
      }
    }
  } catch (err: unknown) {
    const e = err as { name?: string; cause?: { code?: string }; message?: string };
    if (e?.name === "TimeoutError") return finish(false, "Timed out after 5s");
    if (e?.cause?.code === "ECONNREFUSED") return finish(false, "Connection refused — service offline");
    return finish(false, e?.message || "Test failed");
  }
}
