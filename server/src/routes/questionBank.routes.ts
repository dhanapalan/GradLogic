import { Router } from "express";
import multer from "multer";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";
import * as qbController from "../controllers/questionBank.controller.js";

const router = Router();

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    cb(null, isPdf);
  },
});

// ── Validation Schemas ───────────────────────────────────────────────────────

const categoryEnum = z.enum([
  "reasoning",
  "maths",
  "aptitude",
  "data_structures",
  "programming",
  "python_coding",
  "java_coding",
  "data_science",
]);

const questionTypeEnum = z.enum(["multiple_choice", "coding_challenge"]);

const difficultyEnum = z.enum(["easy", "medium", "hard"]);

const bloomLevelEnum = z.enum([
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
]);

const createQuestionSchema = z
  .object({
    category: categoryEnum,
    type: questionTypeEnum,
    difficulty_level: difficultyEnum,
    question_text: z.string().min(5, "Question text must be at least 5 characters"),
    options: z.array(z.string()).min(2).nullable().optional(),
    correct_answer: z.string().nullable().optional(),
    test_cases: z
      .array(
        z.object({
          input: z.string(),
          expectedOutput: z.string(),
          hidden: z.boolean().optional(),
        }),
      )
      .nullable()
      .optional(),
    starter_code: z.record(z.string()).nullable().optional(),
    time_limit_ms: z.number().int().min(1000).max(30000).optional(),
    memory_limit_kb: z.number().int().min(1024).max(524288).optional(),
    marks: z.number().min(0).max(100).optional(),
    tags: z.array(z.string()).optional(),
    explanation: z.string().nullable().optional(),
    bloom_level: bloomLevelEnum.nullable().optional(),
    status: z.string().optional(),
    hint: z.string().nullable().optional(),
    learning_objectives: z.array(z.string()).optional(),
    reference_links: z.array(z.string()).optional(),
  })
  .refine(
    (q) =>
      q.type !== "multiple_choice" ||
      (q.options && q.options.length >= 2 && q.correct_answer !== null && q.correct_answer !== undefined),
    { message: "MCQ questions require options (≥ 2) and a correct_answer" },
  )
  .refine(
    (q) =>
      q.type !== "coding_challenge" ||
      (q.test_cases && q.test_cases.length > 0),
    { message: "Coding challenges require at least one test case" },
  );

const updateQuestionSchema = z.object({
  category: categoryEnum.optional(),
  type: questionTypeEnum.optional(),
  difficulty_level: difficultyEnum.optional(),
  question_text: z.string().min(5).optional(),
  options: z.array(z.string()).min(2).nullable().optional(),
  correct_answer: z.string().nullable().optional(),
  test_cases: z
    .array(
      z.object({
        input: z.string(),
        expectedOutput: z.string(),
        hidden: z.boolean().optional(),
      }),
    )
    .nullable()
    .optional(),
  starter_code: z.record(z.string()).nullable().optional(),
  time_limit_ms: z.number().int().min(1000).max(30000).optional(),
  memory_limit_kb: z.number().int().min(1024).max(524288).optional(),
  marks: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  explanation: z.string().nullable().optional(),
  hint: z.string().nullable().optional(),
  learning_objectives: z.array(z.string()).optional(),
  reference_links: z.array(z.string()).optional(),
  // Allow bloom/status on update so browse edit stays in sync with create/list
  bloom_level: bloomLevelEnum.nullable().optional(),
  status: z.string().min(1).max(40).optional(),
});

const bulkCreateSchema = z.object({
  questions: z.array(createQuestionSchema).min(1).max(500),
});

const randomQuerySchema = z.object({
  category: categoryEnum,
  type: questionTypeEnum,
  difficulty_level: difficultyEnum,
  count: z.coerce.number().int().min(1).max(100).optional().default(10),
});

// ── Routes ───────────────────────────────────────────────────────────────────

// Public read endpoints (authenticated users)
router.get("/", authenticate, qbController.list);
router.get("/categories", authenticate, qbController.categoryCounts);
router.get("/random", authenticate, validate(randomQuerySchema, "query"), qbController.random);
router.get("/:id", authenticate, qbController.getById);

// Platform admin / HR write endpoints (college roles: read-only — no global QB mutate)
router.post(
  "/",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  validate(createQuestionSchema, "body"),
  qbController.create,
);
router.post(
  "/bulk",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  validate(bulkCreateSchema, "body"),
  qbController.bulkCreate,
);
// Parse an uploaded question PDF into MCQ candidates (read-only — the admin
// reviews the result in the UI, then inserts the confirmed set via /bulk).
router.post(
  "/import-pdf/parse",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  pdfUpload.single("file"),
  qbController.parsePdfImport,
);
router.put(
  "/:id",
  authenticate,
  authorize("admin", "super_admin", "hr"),
  validate(updateQuestionSchema, "body"),
  qbController.update,
);
router.delete("/:id", authenticate, authorize("admin", "super_admin", "hr"), qbController.deactivate);
router.delete("/:id/permanent", authenticate, authorize("admin", "super_admin"), qbController.hardDelete);

export default router;
