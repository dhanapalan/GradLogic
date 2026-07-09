import { Router } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { authenticate } from "../middleware/auth.js";
import * as authController from "../controllers/auth.controller.js";
import { passwordSchema, setupPasswordSchema } from "../validators/password.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const studentRegisterSchema = z.object({
  name:           z.string().min(2, "Name must be at least 2 characters").max(200),
  email:          z.string().email("Invalid email"),
  password:       passwordSchema,
  phone:          z.string().optional(),
  degree:         z.string().optional(),
  specialization: z.string().optional(),
  passing_year:   z.number().int().min(2000).max(2040).optional(),
  college_name:   z.string().optional(),
});

const companyRegisterSchema = z.object({
  name:         z.string().min(2, "Name must be at least 2 characters").max(200),
  email:        z.string().email("Invalid email"),
  password:     passwordSchema,
  company_name: z.string().min(2, "Company name required").max(255),
  industry:     z.string().optional(),
  headquarters: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(10, "Refresh token is required"),
});

const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(10, "Reset token is required"),
  password: passwordSchema,
});

const twoFactorCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

const twoFactorVerifySchema = z.object({
  challengeToken: z.string().min(10, "2FA session is required"),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/**
 * POST /api/auth/login
 */
router.post("/login", validate(loginSchema), authController.login);

/**
 * POST /api/auth/register/student — public student self-registration
 */
router.post("/register/student", validate(studentRegisterSchema), authController.registerStudent);

/**
 * POST /api/auth/register/company — public company/HR self-registration
 */
router.post("/register/company", validate(companyRegisterSchema), authController.registerCompany);

/**
 * GET /api/auth/me — returns the authenticated user's profile
 */
router.get("/me", authenticate, authController.me);

/**
 * POST /api/auth/setup-password — force password change on first login
 */
router.post("/setup-password", authenticate, validate(setupPasswordSchema), authController.setupPassword);

/**
 * POST /api/auth/refresh — rotate refresh token, issue new access token
 */
router.post("/refresh", validate(refreshSchema), authController.refresh);

/**
 * POST /api/auth/logout — revoke the presented refresh token
 */
router.post("/logout", validate(logoutSchema), authController.logout);

/**
 * POST /api/auth/change-password — authenticated self-service change
 */
router.post("/change-password", authenticate, validate(changePasswordSchema), authController.changePassword);

/**
 * POST /api/auth/forgot-password — begin reset flow (emails a link)
 */
router.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);

/**
 * POST /api/auth/reset-password — complete reset flow with token
 */
router.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);

/**
 * GET /api/auth/permissions — caller's effective permission set (RBAC)
 */
router.get("/permissions", authenticate, authController.permissions);

// ── Two-Factor Authentication (TOTP) ─────────────────────────────────────────

/** POST /api/auth/2fa/verify — complete a 2FA login (public) */
router.post("/2fa/verify", validate(twoFactorVerifySchema), authController.verifyTwoFactor);

/** GET /api/auth/2fa/status — is 2FA enabled for the caller */
router.get("/2fa/status", authenticate, authController.twoFactorStatus);

/** POST /api/auth/2fa/setup — begin enrollment (returns secret + otpauth URI) */
router.post("/2fa/setup", authenticate, authController.twoFactorSetup);

/** POST /api/auth/2fa/enable — confirm enrollment with a code */
router.post("/2fa/enable", authenticate, validate(twoFactorCodeSchema), authController.twoFactorEnable);

/** POST /api/auth/2fa/disable — turn off 2FA (requires a valid code) */
router.post("/2fa/disable", authenticate, validate(twoFactorCodeSchema), authController.twoFactorDisable);

/**
 * GET /api/auth/microsoft/url — returns MS Login URL
 */
router.get("/microsoft/url", authController.microsoftLoginUrl);

/**
 * POST /api/auth/microsoft — exchange MS code for JWT
 */
router.post("/microsoft", authController.microsoftLogin);

export default router;
