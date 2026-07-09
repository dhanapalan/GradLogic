import crypto from "crypto";
import jwt from "jsonwebtoken";
import { query, queryOne } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { AuthPayload, UserRole } from "../types/index.js";

/**
 * Token service — short-lived JWT access tokens paired with rotating,
 * DB-persisted opaque refresh tokens.
 *
 * Security properties:
 *  - Refresh tokens are random 256-bit values; only their SHA-256 hash is stored.
 *  - Each refresh rotates the token (old one is revoked, new one issued).
 *  - Reuse detection: presenting an already-revoked token revokes the whole
 *    token "family", forcing re-authentication (mitigates token theft/replay).
 *  - Logout revokes the presented refresh token.
 */

export interface TokenMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
}

function sha256(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function signAccessToken(payload: AuthPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  } as jwt.SignOptions);
}

async function persistRefreshToken(
  userId: string,
  familyId: string,
  meta: TokenMeta
): Promise<{ id: string; raw: string }> {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = sha256(raw);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const row = await queryOne<{ id: string }>(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [userId, tokenHash, familyId, expiresAt, meta.userAgent ?? null, meta.ip ?? null]
  );
  if (!row) throw new AppError("Failed to issue refresh token", 500);
  return { id: row.id, raw };
}

/** Issue a fresh access + refresh token pair (new rotation family). */
export async function issueTokens(payload: AuthPayload, meta: TokenMeta = {}): Promise<IssuedTokens> {
  const familyId = crypto.randomUUID();
  const { raw } = await persistRefreshToken(payload.userId, familyId, meta);
  return {
    accessToken: signAccessToken(payload),
    refreshToken: raw,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
  };
}

interface RefreshRow {
  id: string;
  user_id: string;
  family_id: string;
  expires_at: string;
  revoked_at: string | null;
}

/**
 * Rotate a refresh token: validate, revoke the old one, issue a new pair.
 * Returns the new tokens plus the fresh user payload.
 */
export async function rotateRefreshToken(
  rawToken: string,
  meta: TokenMeta = {}
): Promise<IssuedTokens & { payload: AuthPayload }> {
  if (!rawToken) throw new AppError("Refresh token required", 401);
  const tokenHash = sha256(rawToken);

  const existing = await queryOne<RefreshRow>(
    `SELECT id, user_id, family_id, expires_at, revoked_at
     FROM refresh_tokens WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!existing) {
    throw new AppError("Invalid refresh token", 401);
  }

  // Reuse detection: a revoked token being presented again means it may have
  // been stolen — revoke the entire family and force re-auth.
  if (existing.revoked_at) {
    await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE family_id = $1 AND revoked_at IS NULL`,
      [existing.family_id]
    );
    throw new AppError("Refresh token reuse detected. Please log in again.", 401);
  }

  if (new Date(existing.expires_at).getTime() < Date.now()) {
    throw new AppError("Refresh token expired. Please log in again.", 401);
  }

  // Load current user state (role/college/active may have changed).
  const user = await queryOne<{
    id: string;
    email: string;
    role: string;
    college_id: string | null;
    is_active: boolean;
  }>(
    `SELECT id, email, role, college_id, is_active FROM users WHERE id = $1`,
    [existing.user_id]
  );
  if (!user || !user.is_active) {
    await query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_id = $1`, [
      existing.family_id,
    ]);
    throw new AppError("Session expired. Please log in again.", 401);
  }

  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role.toLowerCase() as UserRole,
    college_id: user.college_id ?? null,
  };

  // Issue the replacement within the same family, then link + revoke the old one.
  const replacement = await persistRefreshToken(user.id, existing.family_id, meta);
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by = $2 WHERE id = $1`,
    [existing.id, replacement.id]
  );

  return {
    accessToken: signAccessToken(payload),
    refreshToken: replacement.raw,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    payload,
  };
}

/** Revoke a single refresh token (logout on this device). */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  if (!rawToken) return;
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [sha256(rawToken)]
  );
}

/** Revoke every active refresh token for a user (logout everywhere). */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

// ── 2FA login challenge token ─────────────────────────────────────────────────
// A short-lived, purpose-scoped JWT issued after a correct password when 2FA is
// enabled. It carries only { userId, purpose } and CANNOT be used as an access
// token (authenticate() rejects tokens that carry a `purpose` claim).

const TWO_FACTOR_CHALLENGE_TTL = "5m";

export function issueTwoFactorChallenge(userId: string): string {
  return jwt.sign({ userId, purpose: "2fa_challenge" }, env.JWT_SECRET, {
    expiresIn: TWO_FACTOR_CHALLENGE_TTL,
  } as jwt.SignOptions);
}

export function verifyTwoFactorChallenge(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { userId?: string; purpose?: string };
    if (payload.purpose !== "2fa_challenge" || !payload.userId) {
      throw new Error("invalid purpose");
    }
    return payload.userId;
  } catch {
    throw new AppError("Your 2FA session has expired. Please log in again.", 401);
  }
}
