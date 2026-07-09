import bcrypt from "bcryptjs";
import crypto from "crypto";
import { queryOne } from "../config/database.js";
import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";
import { UserRow, AuthPayload, UserRole } from "../types/index.js";
import { logLogin, logLoginFailure } from "./audit.service.js";
import { recordAuditEvent } from "./adminAudit.service.js";
import {
  issueTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  issueTwoFactorChallenge,
  verifyTwoFactorChallenge,
  type TokenMeta,
} from "./token.service.js";
import { getPermissionsForRole } from "./rbac.service.js";
import { verifyForLogin } from "./twoFactor.service.js";
import { sendPasswordResetEmail } from "./email.service.js";
import { ConfidentialClientApplication, Configuration, LogLevel } from "@azure/msal-node";

// MSAL Configuration
let _msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
  if (!_msalClient) {
    if (!env.MSAL_CLIENT_ID || !env.MSAL_CLIENT_SECRET || !env.MSAL_TENANT_ID) {
      throw new AppError("Microsoft SSO environment variables are not properly configured", 500);
    }

    const msalConfig: Configuration = {
      auth: {
        clientId: env.MSAL_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${env.MSAL_TENANT_ID}`,
        clientSecret: env.MSAL_CLIENT_SECRET,
      },
      system: {
        loggerOptions: {
          loggerCallback(loglevel, message) {
            if (loglevel === LogLevel.Error) {
              console.error(`MSAL ERROR: ${message}`);
            }
          },
          piiLoggingEnabled: false,
          logLevel: LogLevel.Error,
        },
      },
    };
    _msalClient = new ConfidentialClientApplication(msalConfig);
  }
  return _msalClient;
}

function resolveDisplayName(user: UserRow): string {
  if (typeof user.name === "string" && user.name.trim().length > 0) {
    return user.name.trim();
  }
  const composed = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return composed || user.email;
}

type LoginUserRow = UserRow & {
  college_name?: string | null;
  two_factor_enabled?: boolean;
};

/**
 * Build the full authenticated session (tokens + permissions + user profile)
 * for a resolved user row. Shared by password login and the 2FA verify step.
 */
async function finalizeLogin(user: LoginUserRow, ip?: string, meta: TokenMeta = {}) {
  const payload: AuthPayload = {
    userId: user.id,
    email: user.email,
    role: user.role.toLowerCase() as UserRole,
    college_id: user.college_id ?? null,
  };

  const tokens = await issueTokens(payload, { ip, ...meta });
  const permissions = await getPermissionsForRole(user.role);

  // Audit: successful login (both the security log and the admin audit trail)
  logLogin(user.id, user.email, user.role, ip).catch(() => { });
  recordAuditEvent({
    userId: user.id,
    action: "LOGIN_SUCCESS",
    resourceType: "session",
    resourceId: user.id,
    ipAddress: ip,
  }).catch(() => { });
  queryOne("UPDATE users SET last_login = NOW(), last_login_at = NOW() WHERE id = $1", [user.id]).catch(() => { });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    permissions,
    user: {
      id: user.id,
      role: user.role,
      name: resolveDisplayName(user),
      email: user.email,
      college_id: user.college_id ?? null,
      college_name: user.college_name ?? null,
      department: user.department ?? null,
      phone_number: user.phone_number ?? null,
      is_profile_complete: user.is_profile_complete ?? false,
      must_change_password: user.must_change_password ?? false,
      two_factor_enabled: user.two_factor_enabled ?? false,
    },
  };
}

/**
 * Authenticate a user by email + password.
 *
 * If the account has 2FA enabled, no session is issued yet — instead a
 * short-lived challenge token is returned and the client must complete
 * verifyTwoFactorLogin() with a valid TOTP code.
 */
export async function loginUser(
  email: string,
  password: string,
  ip?: string,
  meta: TokenMeta = {},
) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await queryOne<LoginUserRow>(
    `SELECT u.*, c.name as college_name 
     FROM users u
     LEFT JOIN colleges c ON c.id = u.college_id
     WHERE u.email = $1 AND u.is_active = TRUE`,
    [normalizedEmail],
  );

  if (!user) {
    logLoginFailure(email, ip, "User not found or inactive").catch(() => { });
    throw new AppError("Invalid email or password", 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    logLoginFailure(email, ip, "Invalid password").catch(() => { });
    throw new AppError("Invalid email or password", 401);
  }

  // 2FA gate: password is correct, but require a TOTP code before issuing tokens.
  if (user.two_factor_enabled) {
    return {
      requires2FA: true as const,
      challengeToken: issueTwoFactorChallenge(user.id),
    };
  }

  return finalizeLogin(user, ip, meta);
}

/**
 * Complete a 2FA login: verify the TOTP code against the challenge token's user
 * and, on success, issue the full session.
 */
export async function verifyTwoFactorLogin(
  challengeToken: string,
  code: string,
  ip?: string,
  meta: TokenMeta = {},
) {
  const userId = verifyTwoFactorChallenge(challengeToken);

  const ok = await verifyForLogin(userId, code);
  if (!ok) {
    logLoginFailure("(2fa)", ip, "Invalid 2FA code").catch(() => { });
    throw new AppError("Invalid verification code. Please try again.", 401);
  }

  const user = await queryOne<LoginUserRow>(
    `SELECT u.*, c.name as college_name
     FROM users u
     LEFT JOIN colleges c ON c.id = u.college_id
     WHERE u.id = $1 AND u.is_active = TRUE`,
    [userId],
  );
  if (!user) {
    throw new AppError("Account not found or inactive", 401);
  }

  return finalizeLogin(user, ip, meta);
}


/**
 * Return the authenticated user's profile from the database.
 */
export async function getMe(userId: string) {
  const user = await queryOne<
    UserRow & {
      college_name?: string | null;
      student_identifier?: string | null;
      degree?: string | null;
      specialization?: string | null;
      class_name?: string | null;
      section?: string | null;
      passing_year?: number | null;
      cgpa?: number | null;
      percentage?: number | null;
      resume_url?: string | null;
      skills?: string[] | null;
      linkedin_url?: string | null;
      github_url?: string | null;
      profile_photo_url?: string | null;
    }
  >(
    `SELECT
        u.*,
        c.name AS college_name,
        sd.student_identifier,
        sd.degree,
        sd.specialization,
        sd.class_name,
        sd.section,
        sd.passing_year,
        sd.cgpa,
        sd.percentage,
        sd.resume_url,
        sd.skills,
        sd.linkedin_url,
        sd.github_url,
        sd.face_photo_url AS profile_photo_url
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
     WHERE u.id = $1`,
    [userId],
  );
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return {
    id: user.id,
    role: user.role,
    name: resolveDisplayName(user),
    email: user.email,
    college_id: user.college_id ?? null,
    phone_number: user.phone_number ?? null,
    dob: user.dob ?? null,
    is_profile_complete: user.is_profile_complete ?? false,
    college_name: user.college_name ?? null,
    student_identifier: user.student_identifier ?? null,
    degree: user.degree ?? null,
    specialization: user.specialization ?? null,
    class_name: user.class_name ?? null,
    section: user.section ?? null,
    passing_year: user.passing_year ?? null,
    cgpa: user.cgpa ?? null,
    percentage: user.percentage ?? null,
    resume_url: user.resume_url ?? null,
    skills: user.skills ?? [],
    linkedin_url: user.linkedin_url ?? null,
    github_url: user.github_url ?? null,
    profile_photo_url: user.profile_photo_url ?? null,
    is_active: user.is_active,
    created_at: user.created_at,
    two_factor_enabled: (user as { two_factor_enabled?: boolean }).two_factor_enabled ?? false,
  };
}

/**
 * Update a user's password and clear the must_change_password flag.
 * Used by the forced first-login password change (setup-password).
 */
export async function updatePassword(userId: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 12);

  const result = await queryOne(
    `UPDATE users 
     SET password = $1, must_change_password = FALSE, password_changed_at = NOW(), updated_at = NOW()
     WHERE id = $2
     RETURNING id`,
    [hashedPassword, userId]
  );

  if (!result) {
    throw new AppError("User not found", 404);
  }

  recordAuditEvent({
    userId,
    action: "PASSWORD_CHANGED",
    resourceType: "user",
    resourceId: userId,
    changes: { via: "setup-password" },
  }).catch(() => { });
}

/**
 * Generate Microsoft OAuth2 Login URL
 */
export async function getMicrosoftAuthUrl(state: string) {
  const authCodeUrlParameters = {
    scopes: ["user.read"],
    redirectUri: env.MSAL_REDIRECT_URI,
    state,
  };
  return await getMsalClient().getAuthCodeUrl(authCodeUrlParameters);
}

/**
 * Handle MSAL Callback & Login User
 */
export async function loginWithMicrosoft(code: string, ip?: string) {
  const tokenRequest = {
    code,
    scopes: ["user.read"],
    redirectUri: env.MSAL_REDIRECT_URI,
  };

  try {
    const response = await getMsalClient().acquireTokenByCode(tokenRequest);
    const account = response.account;

    if (!account) {
      throw new AppError("Failed to retrieve Microsoft account", 401);
    }

    const email = account.username.toLowerCase();

    // Check if user exists in our DB
    const user = await queryOne<UserRow>(
      "SELECT * FROM users WHERE email = $1 AND is_active = TRUE",
      [email]
    );

    if (!user) {
      logLoginFailure(email, ip, "Microsoft SSO - User not found").catch(() => { });
      throw new AppError("User not found or inactive. Please contact an administrator.", 401);
    }

    await queryOne("UPDATE users SET last_login = NOW(), last_login_at = NOW() WHERE id = $1", [user.id]);

    const payload: AuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role.toLowerCase() as UserRole,
      college_id: user.college_id ?? null,
    };

    const tokens = await issueTokens(payload, { ip });
    const permissions = await getPermissionsForRole(user.role);

    logLogin(user.id, user.email, user.role, ip).catch(() => { });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      permissions,
      user: {
        id: user.id,
        role: user.role,
        name: resolveDisplayName(user),
        email: user.email,
        college_id: user.college_id ?? null,
        department: user.department ?? null,
        phone_number: user.phone_number ?? null,
        is_profile_complete: user.is_profile_complete ?? false,
        must_change_password: user.must_change_password ?? false,
      },
    };
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    console.error("MSAL Token Error:", err);
    throw new AppError("Microsoft Login failed", 401);
  }
}

// =============================================================================
// PUBLIC SELF-REGISTRATION
// =============================================================================

export interface StudentRegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  degree?: string;
  specialization?: string;
  passing_year?: number;
  college_name?: string;   // free-text; we find-or-create the college
}

export interface CompanyRegisterInput {
  name: string;              // contact person name
  email: string;
  password: string;
  company_name: string;
  industry?: string;
  headquarters?: string;
}

/**
 * Self-registration for students.
 * Creates user + student_details + optionally find-or-create a college.
 */
export async function registerStudent(input: StudentRegisterInput, ip?: string) {
  const email = input.email.toLowerCase().trim();

  const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) throw new AppError("An account with this email already exists", 409);

  const hashed = await bcrypt.hash(input.password, 12);

  // Find or create college by name (if provided)
  let collegeId: string | null = null;
  if (input.college_name?.trim()) {
    const existingCollege = await queryOne<{ id: string }>(
      "SELECT id FROM colleges WHERE LOWER(name) = LOWER($1) LIMIT 1",
      [input.college_name.trim()]
    );
    if (existingCollege) {
      collegeId = existingCollege.id;
    } else {
      const slug = input.college_name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40);
      const code = `${slug}_${Date.now()}`.slice(0, 50);
      const newCollege = await queryOne<{ id: string }>(
        "INSERT INTO colleges (name, college_code, is_active) VALUES ($1,$2,TRUE) RETURNING id",
        [input.college_name.trim(), code]
      );
      collegeId = newCollege?.id ?? null;
    }
  }

  const user = await queryOne<{ id: string; role: string }>(
    `INSERT INTO users (name, email, password, role, college_id, status, is_active)
     VALUES ($1,$2,$3,'student',$4,'Active',TRUE) RETURNING id, role`,
    [input.name.trim(), email, hashed, collegeId]
  );
  if (!user) throw new AppError("Registration failed", 500);

  // Create student_details row
  if (collegeId) {
    await queryOne(
      `INSERT INTO student_details (user_id, college_id, degree, specialization, passing_year, phone_number)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (user_id) DO NOTHING`,
      [user.id, collegeId, input.degree ?? null, input.specialization ?? null, input.passing_year ?? null, input.phone ?? null]
    );
  }

  const payload: AuthPayload = {
    userId: user.id,
    email,
    role: "student",
    college_id: collegeId,
  };
  const tokens = await issueTokens(payload, { ip });
  const permissions = await getPermissionsForRole("student");

  logLogin(user.id, email, "student", ip).catch(() => { });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    permissions,
    user: { id: user.id, role: "student", name: input.name.trim(), email, college_id: collegeId, is_profile_complete: false, must_change_password: false },
  };
}

/**
 * Self-registration for company/HR users.
 * Creates user + companies profile row.
 */
export async function registerCompany(input: CompanyRegisterInput, ip?: string) {
  const email = input.email.toLowerCase().trim();

  const existing = await queryOne("SELECT id FROM users WHERE email = $1", [email]);
  if (existing) throw new AppError("An account with this email already exists", 409);

  const hashed = await bcrypt.hash(input.password, 12);

  const user = await queryOne<{ id: string }>(
    `INSERT INTO users (name, email, password, role, status, is_active)
     VALUES ($1,$2,$3,'company','Active',TRUE) RETURNING id`,
    [input.name.trim(), email, hashed]
  );
  if (!user) throw new AppError("Registration failed", 500);

  // Create company profile
  await queryOne(
    "INSERT INTO companies (user_id, name, industry, headquarters) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id) DO NOTHING",
    [user.id, input.company_name.trim(), input.industry ?? null, input.headquarters ?? null]
  );

  const payload: AuthPayload = {
    userId: user.id,
    email,
    role: "company",
    college_id: null,
  };
  const tokens = await issueTokens(payload, { ip });
  const permissions = await getPermissionsForRole("company");

  logLogin(user.id, email, "company", ip).catch(() => { });

  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    permissions,
    user: { id: user.id, role: "company", name: input.name.trim(), email, college_id: null, is_profile_complete: false, must_change_password: false },
  };
}

// =============================================================================
// SESSION MANAGEMENT — refresh / logout
// =============================================================================

/**
 * Exchange a valid refresh token for a new access + refresh pair (rotation).
 * Also returns the caller's current permission set.
 */
export async function refreshSession(rawRefreshToken: string, meta: TokenMeta = {}) {
  const rotated = await rotateRefreshToken(rawRefreshToken, meta);
  const permissions = await getPermissionsForRole(rotated.payload.role);
  return {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    permissions,
  };
}

/** Revoke a single refresh token (logout on this device). */
export async function logout(rawRefreshToken: string | undefined, actorId?: string, ip?: string) {
  if (rawRefreshToken) {
    await revokeRefreshToken(rawRefreshToken);
  }
  if (actorId) {
    recordAuditEvent({
      userId: actorId,
      action: "LOGOUT",
      resourceType: "session",
      resourceId: actorId,
      ipAddress: ip,
    }).catch(() => { });
  }
}

/** Revoke every session for a user (logout everywhere / after password reset). */
export async function logoutAll(userId: string) {
  await revokeAllUserTokens(userId);
}

// =============================================================================
// PASSWORD MANAGEMENT — self-service change / forgot / reset
// =============================================================================

/**
 * Authenticated self-service password change. Verifies the current password,
 * then rotates it. Existing sessions are revoked (except this one is refreshed
 * by the client) to defend against a compromised session.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await queryOne<{ id: string; password: string }>(
    "SELECT id, password FROM users WHERE id = $1 AND is_active = TRUE",
    [userId],
  );
  if (!user) throw new AppError("User not found", 404);

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) throw new AppError("Current password is incorrect", 400);

  const same = await bcrypt.compare(newPassword, user.password);
  if (same) throw new AppError("New password must be different from the current password", 400);

  const hashed = await bcrypt.hash(newPassword, 12);
  await queryOne(
    `UPDATE users
     SET password = $1, must_change_password = FALSE, password_changed_at = NOW(), updated_at = NOW()
     WHERE id = $2 RETURNING id`,
    [hashed, userId],
  );

  // Invalidate all other sessions after a password change.
  await revokeAllUserTokens(userId);

  recordAuditEvent({
    userId,
    action: "PASSWORD_CHANGED",
    resourceType: "user",
    resourceId: userId,
    changes: { via: "self-service" },
  }).catch(() => { });
}

/**
 * Begin the forgot-password flow. Always resolves successfully (no account
 * enumeration). If the account exists, a single-use reset token (hashed at
 * rest) is stored and an email is sent.
 */
export async function requestPasswordReset(email: string, ip?: string) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await queryOne<{ id: string; email: string; name: string | null; full_name: string | null }>(
    "SELECT id, email, name, full_name FROM users WHERE email = $1 AND is_active = TRUE",
    [normalizedEmail],
  );

  // Do not reveal whether the account exists.
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_EXPIRES_MIN * 60 * 1000);

  await queryOne(
    `UPDATE users
     SET password_reset_token_hash = $1, password_reset_expires_at = $2, updated_at = NOW()
     WHERE id = $3 RETURNING id`,
    [tokenHash, expiresAt, user.id],
  );

  const resetUrl = `${env.CLIENT_URL}/auth/reset-password?token=${rawToken}`;
  await sendPasswordResetEmail({
    name: user.full_name || user.name || "there",
    email: user.email,
    resetUrl,
  });

  recordAuditEvent({
    userId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    resourceType: "user",
    resourceId: user.id,
    ipAddress: ip,
  }).catch(() => { });
}

/**
 * Complete the forgot-password flow using the token from the email link.
 */
export async function resetPassword(rawToken: string, newPassword: string, ip?: string) {
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const user = await queryOne<{ id: string; password_reset_expires_at: string | null }>(
    `SELECT id, password_reset_expires_at
     FROM users
     WHERE password_reset_token_hash = $1 AND is_active = TRUE`,
    [tokenHash],
  );

  if (!user || !user.password_reset_expires_at ||
      new Date(user.password_reset_expires_at).getTime() < Date.now()) {
    throw new AppError("This password reset link is invalid or has expired", 400);
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await queryOne(
    `UPDATE users
     SET password = $1,
         must_change_password = FALSE,
         password_changed_at = NOW(),
         password_reset_token_hash = NULL,
         password_reset_expires_at = NULL,
         updated_at = NOW()
     WHERE id = $2 RETURNING id`,
    [hashed, user.id],
  );

  // Reset invalidates every existing session.
  await revokeAllUserTokens(user.id);

  recordAuditEvent({
    userId: user.id,
    action: "PASSWORD_RESET_COMPLETED",
    resourceType: "user",
    resourceId: user.id,
    ipAddress: ip,
  }).catch(() => { });
}

/** Return the caller's resolved permission set (for the client RBAC layer). */
export async function getUserPermissions(role: string) {
  return getPermissionsForRole(role);
}
