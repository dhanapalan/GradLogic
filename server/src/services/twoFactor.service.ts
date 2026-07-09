import { queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { recordAuditEvent } from "./adminAudit.service.js";
import {
  generateBase32Secret,
  buildOtpauthUrl,
  verifyTOTP,
  encryptSecret,
  decryptSecret,
} from "./totp.js";

/**
 * Two-Factor Authentication (TOTP) service.
 *
 * Setup is a two-step commit:
 *   1. beginSetup()  → generate + store a *temporary* secret, return the
 *      provisioning URI/secret for the user's authenticator app.
 *   2. enable(code)  → the user proves possession by entering a valid code;
 *      only then is 2FA switched on and the secret promoted to permanent.
 *
 * This prevents locking a user out with a secret they never successfully scanned.
 */

interface TwoFactorRow {
  two_factor_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_temp_secret: string | null;
}

export async function getStatus(userId: string): Promise<{ enabled: boolean }> {
  const row = await queryOne<{ two_factor_enabled: boolean }>(
    "SELECT two_factor_enabled FROM users WHERE id = $1",
    [userId]
  );
  return { enabled: !!row?.two_factor_enabled };
}

/** Step 1: start enrollment. Returns the secret + otpauth URI (never logged). */
export async function beginSetup(
  userId: string,
  accountName: string
): Promise<{ secret: string; otpauthUrl: string }> {
  const secret = generateBase32Secret();
  await queryOne(
    "UPDATE users SET two_factor_temp_secret = $1, updated_at = NOW() WHERE id = $2 RETURNING id",
    [encryptSecret(secret), userId]
  );
  return { secret, otpauthUrl: buildOtpauthUrl(secret, accountName) };
}

/** Step 2: confirm enrollment with a valid code from the authenticator app. */
export async function enable(userId: string, code: string, ip?: string): Promise<void> {
  const row = await queryOne<TwoFactorRow>(
    "SELECT two_factor_enabled, two_factor_secret, two_factor_temp_secret FROM users WHERE id = $1",
    [userId]
  );
  if (!row?.two_factor_temp_secret) {
    throw new AppError("Start two-factor setup before verifying", 400);
  }

  const secret = decryptSecret(row.two_factor_temp_secret);
  if (!verifyTOTP(secret, code)) {
    throw new AppError("Invalid verification code. Please try again.", 400);
  }

  await queryOne(
    `UPDATE users
     SET two_factor_enabled = TRUE,
         two_factor_secret = two_factor_temp_secret,
         two_factor_temp_secret = NULL,
         updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [userId]
  );

  recordAuditEvent({
    userId,
    action: "TWO_FACTOR_ENABLED",
    resourceType: "user",
    resourceId: userId,
    ipAddress: ip,
  }).catch(() => {});
}

/** Disable 2FA. Requires a valid current code to prevent hijacked-session abuse. */
export async function disable(userId: string, code: string, ip?: string): Promise<void> {
  const row = await queryOne<TwoFactorRow>(
    "SELECT two_factor_enabled, two_factor_secret, two_factor_temp_secret FROM users WHERE id = $1",
    [userId]
  );
  if (!row?.two_factor_enabled || !row.two_factor_secret) {
    throw new AppError("Two-factor authentication is not enabled", 400);
  }

  const secret = decryptSecret(row.two_factor_secret);
  if (!verifyTOTP(secret, code)) {
    throw new AppError("Invalid verification code. Please try again.", 400);
  }

  await queryOne(
    `UPDATE users
     SET two_factor_enabled = FALSE,
         two_factor_secret = NULL,
         two_factor_temp_secret = NULL,
         updated_at = NOW()
     WHERE id = $1 RETURNING id`,
    [userId]
  );

  recordAuditEvent({
    userId,
    action: "TWO_FACTOR_DISABLED",
    resourceType: "user",
    resourceId: userId,
    ipAddress: ip,
  }).catch(() => {});
}

/** Verify a login-time code against the user's active secret. */
export async function verifyForLogin(userId: string, code: string): Promise<boolean> {
  const row = await queryOne<TwoFactorRow>(
    "SELECT two_factor_enabled, two_factor_secret, two_factor_temp_secret FROM users WHERE id = $1",
    [userId]
  );
  if (!row?.two_factor_enabled || !row.two_factor_secret) return false;
  return verifyTOTP(decryptSecret(row.two_factor_secret), code);
}
