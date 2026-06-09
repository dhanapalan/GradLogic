import { z } from "zod";

/**
 * Single source of truth for password strength across the whole platform.
 * Applies to registration, admin-created accounts, and forced password setup.
 *
 * Policy: ≥8 chars, ≤128 chars, at least one lowercase, one uppercase, one digit.
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

/** Body schema for POST /api/auth/setup-password */
export const setupPasswordSchema = z.object({
  password: passwordSchema,
});
