// =============================================================================
// API Key Store — DB-backed overrides for third-party service keys.
// Encrypted at rest (AES-256-GCM, key derived from JWT_SECRET). On boot and
// on every write, the decrypted value is applied to `env` in-process so all
// existing call sites (ai.service.ts, vapi.service.ts, ...) keep reading
// `env.ANTHROPIC_API_KEY` etc without changes. Deleting the override reverts
// to the process env value (fully in effect after the next restart, since a
// couple of call sites cache a client at module load).
// =============================================================================

import crypto from "crypto";
import { env } from "../config/env.js";
import { query, queryOne } from "../config/database.js";
import { logger } from "../config/logger.js";

// service_key → env var it overrides. "question_bank" is intentionally
// excluded — that key lives in the Python engine's own .env, not here.
export const MANAGED_SERVICE_KEYS = {
  voice_interview: "VAPI_API_KEY",
  resume_extraction: "ANTHROPIC_API_KEY",
  drive_generation: "GROQ_API_KEY",
  code_execution: "JUDGE0_API_KEY",
} as const;

export type ManagedServiceKey = keyof typeof MANAGED_SERVICE_KEYS;

// The original process-env value for each managed key, captured once at
// module load — used to revert when a DB override is removed.
const originalEnvValues: Record<string, string> = {};
for (const envVar of Object.values(MANAGED_SERVICE_KEYS)) {
  originalEnvValues[envVar] = (env as any)[envVar] || "";
}

function deriveEncryptionKey(): Buffer {
  return crypto.scryptSync(env.JWT_SECRET, "api-key-store-salt", 32);
}

function encrypt(plaintext: string): { ciphertext: string; iv: string; authTag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(ciphertext: string, iv: string, authTag: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(),
    Buffer.from(iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function applyToEnv(envVar: string, value: string): void {
  (env as any)[envVar] = value;
}

interface ApiKeyRow {
  service_key: string;
  encrypted_value: string;
  iv: string;
  auth_tag: string;
  last4: string;
  updated_by: string | null;
  updated_at: string;
}

// Called once at server boot — loads every active DB override into `env`.
export async function applyBootOverrides(): Promise<void> {
  const rows = await query<ApiKeyRow>("SELECT * FROM api_keys");
  for (const row of rows) {
    const envVar = MANAGED_SERVICE_KEYS[row.service_key as ManagedServiceKey];
    if (!envVar) continue;
    try {
      const value = decrypt(row.encrypted_value, row.iv, row.auth_tag);
      applyToEnv(envVar, value);
      logger.info(`✓ API key override loaded from DB for ${row.service_key}`);
    } catch (err) {
      logger.error(`Failed to decrypt stored API key for ${row.service_key}`, err);
    }
  }
}

export async function setKey(
  serviceKey: ManagedServiceKey,
  value: string,
  userId: string,
): Promise<void> {
  const envVar = MANAGED_SERVICE_KEYS[serviceKey];
  if (!envVar) throw new Error(`Unknown or unmanaged service key: ${serviceKey}`);
  if (!value || value.length < 8) throw new Error("Key value is too short");

  const { ciphertext, iv, authTag } = encrypt(value);
  const last4 = value.slice(-4);

  await query(
    `INSERT INTO api_keys (service_key, encrypted_value, iv, auth_tag, last4, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (service_key) DO UPDATE SET
       encrypted_value = EXCLUDED.encrypted_value,
       iv = EXCLUDED.iv,
       auth_tag = EXCLUDED.auth_tag,
       last4 = EXCLUDED.last4,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [serviceKey, ciphertext, iv, authTag, last4, userId],
  );

  applyToEnv(envVar, value);
}

export async function revokeKey(serviceKey: ManagedServiceKey): Promise<void> {
  const envVar = MANAGED_SERVICE_KEYS[serviceKey];
  if (!envVar) throw new Error(`Unknown or unmanaged service key: ${serviceKey}`);

  await query("DELETE FROM api_keys WHERE service_key = $1", [serviceKey]);
  applyToEnv(envVar, originalEnvValues[envVar] || "");
}

export interface KeyMeta {
  source: "database" | "environment" | "unset";
  updated_at: string | null;
  updated_by: string | null;
}

export async function getMeta(serviceKey: string): Promise<KeyMeta> {
  const row = await queryOne<{ updated_at: string; updated_by: string | null }>(
    "SELECT updated_at, updated_by FROM api_keys WHERE service_key = $1",
    [serviceKey],
  );
  if (row) return { source: "database", updated_at: row.updated_at, updated_by: row.updated_by };

  const envVar = MANAGED_SERVICE_KEYS[serviceKey as ManagedServiceKey];
  if (envVar) {
    return {
      source: originalEnvValues[envVar] ? "environment" : "unset",
      updated_at: null,
      updated_by: null,
    };
  }
  return { source: "unset", updated_at: null, updated_by: null };
}

/** Masked last-4 from DB override only (never invent from env). */
export async function getLast4(serviceKey: string): Promise<string | null> {
  const row = await queryOne<{ last4: string }>(
    "SELECT last4 FROM api_keys WHERE service_key = $1",
    [serviceKey],
  );
  return row?.last4 || null;
}

/** Decrypt stored key for server-side probes. Never expose via HTTP. */
export async function getDecryptedKey(serviceKey: string): Promise<string | null> {
  const row = await queryOne<ApiKeyRow>("SELECT * FROM api_keys WHERE service_key = $1", [
    serviceKey,
  ]);
  if (!row) return null;
  try {
    return decrypt(row.encrypted_value, row.iv, row.auth_tag);
  } catch {
    return null;
  }
}

/**
 * Store encrypted key for any service_key. When envVar is set (system services),
 * also apply to in-process `env` for existing call sites.
 */
export async function setKeyForService(
  serviceKey: string,
  value: string,
  userId: string,
  envVar?: string | null,
): Promise<void> {
  if (!value || value.length < 8) throw new Error("Key value is too short");

  const mapped = envVar || MANAGED_SERVICE_KEYS[serviceKey as ManagedServiceKey] || null;
  const { ciphertext, iv, authTag } = encrypt(value);
  const last4 = value.slice(-4);

  await query(
    `INSERT INTO api_keys (service_key, encrypted_value, iv, auth_tag, last4, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (service_key) DO UPDATE SET
       encrypted_value = EXCLUDED.encrypted_value,
       iv = EXCLUDED.iv,
       auth_tag = EXCLUDED.auth_tag,
       last4 = EXCLUDED.last4,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [serviceKey, ciphertext, iv, authTag, last4, userId],
  );

  if (mapped) {
    if (!(mapped in originalEnvValues)) {
      originalEnvValues[mapped] = String((env as any)[mapped] || "");
    }
    applyToEnv(mapped, value);
  }
}

export async function revokeKeyForService(
  serviceKey: string,
  envVar?: string | null,
): Promise<void> {
  await query("DELETE FROM api_keys WHERE service_key = $1", [serviceKey]);
  const mapped = envVar || MANAGED_SERVICE_KEYS[serviceKey as ManagedServiceKey] || null;
  if (mapped) {
    applyToEnv(mapped, originalEnvValues[mapped] || "");
  }
}
