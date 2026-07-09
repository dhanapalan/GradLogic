import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { authenticate, authorize } from "../middleware/auth.js";
import * as studentController from "../controllers/student.controller.js";
import * as modulesController from "../controllers/platformModules.controller.js";
import { passwordSchema } from "../validators/password.js";

const router = Router();

// ── Multer: registration image upload (face capture) ─────────────────────────
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// ── Multer: onboarding uploads (profile photo + resume) ──────────────────────
const onboardingUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // hard cap; resume is validated to 2MB in service
  fileFilter: (_req, file, cb) => {
    const resumeMimeTypes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);

    if (file.fieldname === "profile_photo") {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
        return;
      }
      cb(new Error("profile_photo must be an image file"));
      return;
    }

    if (file.fieldname === "resume") {
      if (resumeMimeTypes.has(file.mimetype)) {
        cb(null, true);
        return;
      }
      cb(new Error("resume must be PDF or DOC/DOCX"));
      return;
    }

    cb(new Error("Unsupported file field"));
  },
});

// ── Validation Schemas ───────────────────────────────────────────────────────

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email"),
  password: passwordSchema,
  college_id: z.string().uuid("college_id must be a valid UUID"),
});

const onboardingSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(120),
  middle_name: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  last_name: z.string().trim().min(1, "Last name is required").max(120),
  dob: z.string().trim().min(1, "Date of birth is required"),
  gender: z.preprocess(
    emptyToUndefined,
    z.enum(["male", "female", "non_binary", "prefer_not_to_say"]).optional(),
  ),
  phone_number: z.string().trim().min(7, "Mobile number is required").max(20),
  alternate_email: z.preprocess(
    emptyToUndefined,
    z.string().email("alternate_email must be a valid email").optional(),
  ),
  alternate_phone: z.preprocess(emptyToUndefined, z.string().trim().max(20).optional()),
  degree: z.string().min(2, "Degree is required"),
  specialization: z.string().trim().min(2, "Branch/Specialization is required").max(150),
  passing_year: z.coerce.number().int().min(2000).max(2100),
  cgpa: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(10).optional()),
  percentage: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(100).optional()),
  roll_number: z.string().trim().min(2, "Roll number / Student ID is required").max(100),
  class_name: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()),
  section: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  skills: z.preprocess(emptyToUndefined, z.string().trim().max(2000).optional()),
  linkedin_url: z.preprocess(emptyToUndefined, z.string().url("Invalid LinkedIn URL").optional()),
  github_url: z.preprocess(emptyToUndefined, z.string().url("Invalid GitHub URL").optional()),
}).refine((data) => data.cgpa !== undefined || data.percentage !== undefined, {
  message: "Either CGPA/GPA or Percentage is required",
  path: ["cgpa"],
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /api/students/register
 * Public endpoint — registers a new student.
 * Accepts multipart form with an optional webcam_photo file field.
 */
router.post(
  "/register",
  imageUpload.single("webcam_photo"),
  validate(registerSchema),
  studentController.register,
);

/**
 * PUT /api/students/me/onboarding
 * Student profile completion on first login.
 * Requires JWT and student role.
 */
router.put(
  "/me/onboarding",
  authenticate,
  authorize("student"),
  onboardingUpload.fields([
    { name: "profile_photo", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  validate(onboardingSchema),
  studentController.completeOnboarding,
);

/**
 * GET /api/students
 * List all students (Admin/HR/CxO read-only)
 */
router.get(
  "/",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo"),
  studentController.list
);

/**
 * GET /api/students/analytics
 * Analytics summary for students (Admin/HR/CxO)
 */
router.get(
  "/analytics",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo"),
  studentController.getAnalytics
);

/** Enabled portal features for the student's college (multi-tenant modules). */
router.get(
  "/portal-features",
  authenticate,
  authorize("student"),
  modulesController.getStudentPortalFeatures
);

/**
 * GET /api/students/:id
 * Get student by ID
 */
router.get(
  "/:id",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo", "college", "college_admin", "college_staff"),
  studentController.getById
);

/**
 * PUT /api/students/:id
 * Update student / profile (HR/Admin/Student)
 * Accepts optional multipart fields: profile_photo (image) and resume (PDF/DOC)
 */
router.put(
  "/:id",
  authenticate,
  authorize("super_admin", "admin", "hr", "student"),
  onboardingUpload.fields([
    { name: "profile_photo", maxCount: 1 },
    { name: "resume", maxCount: 1 },
  ]),
  studentController.update
);

/**
 * DELETE /api/students/:id
 * Delete student (HR/Admin)
 */
router.delete(
  "/:id",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  studentController.deleteStudent
);

/**
 * GET /api/students/:studentId/exams
 * Returns exam schedule for the given student.
 * Requires JWT authentication — Admin, HR, student, CxO.
 */
router.get(
  "/:studentId/exams",
  authenticate,
  authorize("super_admin", "admin", "hr", "cxo", "student"),
  studentController.getExamSchedule,
);

/**
 * POST /api/students/bulk
 * Bulk register students (Admin/HR)
 */
router.post(
  "/bulk",
  authenticate,
  authorize("super_admin", "admin", "hr"),
  studentController.bulkRegister
);

export default router;
