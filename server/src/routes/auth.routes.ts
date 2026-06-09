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
 * GET /api/auth/microsoft/url — returns MS Login URL
 */
router.get("/microsoft/url", authController.microsoftLoginUrl);

/**
 * POST /api/auth/microsoft — exchange MS code for JWT
 */
router.post("/microsoft", authController.microsoftLogin);

export default router;
