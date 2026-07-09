import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import * as authService from "../services/auth.service.js";
import * as twoFactorService from "../services/twoFactor.service.js";
import { ApiResponse } from "../types/index.js";
import { env } from "../config/env.js";

// ── OAuth CSRF state helpers ──────────────────────────────────────────────────
// State = base64(nonce + "." + timestamp) signed with HMAC-SHA256.
// Valid for 10 minutes; no server-side storage needed.

function generateOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload = `${nonce}.${ts}`;
  const sig = crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

function verifyOAuthState(state: string): boolean {
  try {
    const decoded = Buffer.from(state, "base64url").toString();
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [nonce, ts, sig] = parts;
    const payload = `${nonce}.${ts}`;
    const expected = crypto.createHmac("sha256", env.JWT_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return false;
    // Expire after 10 minutes
    if (Date.now() - parseInt(ts) > 10 * 60 * 1000) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export const login = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password, req.ip, {
      userAgent: req.headers["user-agent"],
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * Body: { refreshToken }  → rotates tokens and returns a new pair + permissions.
 */
export const refresh = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body;
    const result = await authService.refreshSession(refreshToken, {
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Body: { refreshToken }  → revokes the presented refresh token.
 */
export const logout = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { refreshToken } = req.body ?? {};
    await authService.logout(refreshToken, req.user?.userId, req.ip);
    res.json({ success: true, message: "Logged out" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/change-password  (authenticated)
 * Body: { currentPassword, newPassword }
 */
export const changePassword = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ success: true, message: "Password changed successfully. Please log in again." });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 * Body: { email }  → always returns success (no account enumeration).
 */
export const forgotPassword = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;
    await authService.requestPasswordReset(email, req.ip);
    res.json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
export const resetPassword = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { token, password } = req.body;
    await authService.resetPassword(token, password, req.ip);
    res.json({ success: true, message: "Password reset successfully. You can now log in." });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/permissions  (authenticated)
 * Returns the caller's effective permission set for the client RBAC layer.
 */
export const permissions = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const perms = await authService.getUserPermissions(req.user!.role);
    res.json({ success: true, data: { permissions: perms } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/register/student
 */
export const registerStudent = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const result = await authService.registerStudent(req.body, req.ip);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

/**
 * POST /api/auth/register/company
 */
export const registerCompany = async (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
  try {
    const result = await authService.registerCompany(req.body, req.ip);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
};

/**
 * GET /api/auth/me
 * Returns the current user from the JWT.
 */
export const me = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const setupPassword = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { password } = req.body;
    const userId = req.user!.userId;

    await authService.updatePassword(userId, password);

    res.json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    next(err);
  }
};

// =============================================================================
// TWO-FACTOR AUTHENTICATION (TOTP)
// =============================================================================

/**
 * POST /api/auth/2fa/verify  (public — completes a 2FA login)
 * Body: { challengeToken, code }
 */
export const verifyTwoFactor = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { challengeToken, code } = req.body;
    const result = await authService.verifyTwoFactorLogin(challengeToken, code, req.ip, {
      userAgent: req.headers["user-agent"],
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/2fa/status  (authenticated)
 */
export const twoFactorStatus = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const status = await twoFactorService.getStatus(req.user!.userId);
    res.json({ success: true, data: status });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/2fa/setup  (authenticated)
 * Begins enrollment; returns the secret + otpauth URI for the authenticator app.
 */
export const twoFactorSetup = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const result = await twoFactorService.beginSetup(req.user!.userId, req.user!.email);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/2fa/enable  (authenticated)
 * Body: { code }  → confirms enrollment.
 */
export const twoFactorEnable = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    await twoFactorService.enable(req.user!.userId, req.body.code, req.ip);
    res.json({ success: true, message: "Two-factor authentication enabled" });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/2fa/disable  (authenticated)
 * Body: { code }
 */
export const twoFactorDisable = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    await twoFactorService.disable(req.user!.userId, req.body.code, req.ip);
    res.json({ success: true, message: "Two-factor authentication disabled" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/microsoft
 * Return URL to redirect user for MS Login
 */
export const microsoftLoginUrl = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const state = generateOAuthState();
    const url = await authService.getMicrosoftAuthUrl(state);
    res.json({ success: true, data: { url, state } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/microsoft
 * Exchange code for JWT
 */
export const microsoftLogin = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const { code, state } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: "Authorization code is required" });
      return;
    }
    if (!state || !verifyOAuthState(state)) {
      res.status(400).json({ success: false, message: "Invalid or expired OAuth state. Please try signing in again." });
      return;
    }
    const result = await authService.loginWithMicrosoft(code, req.ip);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
