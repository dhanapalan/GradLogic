// =============================================================================
// AI Question Bank — proxy to the Python question engine (LangChain + ChromaDB)
// and importer that publishes reviewed questions into the question_bank table.
// =============================================================================

import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { query } from "../config/database.js";
import { logger } from "../config/logger.js";

const router = Router();

const ENGINE_URL = process.env.QUESTION_ENGINE_URL || "http://host.docker.internal:8001";
const ENGINE_API_KEY = process.env.QUESTION_ENGINE_API_KEY || "dev-key-question-engine";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(pdf|docx|txt|md)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else cb(new Error("Only PDF, DOCX, TXT and Markdown files are supported"));
  },
});

const VALID_CATEGORIES = new Set([
  "reasoning", "maths", "aptitude", "data_structures",
  "programming", "python_coding", "java_coding", "data_science",
]);

/**
 * GET /api/qb-ai/health
 * Engine reachability + knowledge base status. Never 500s — reports offline.
 */
router.get(
  "/health",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  async (_req, res) => {
    try {
      const resp = await fetch(`${ENGINE_URL}/health`, { signal: AbortSignal.timeout(5000) });
      const body = await resp.json();
      res.json({ success: true, data: { online: resp.ok, engine: body } });
    } catch {
      res.json({
        success: true,
        data: {
          online: false,
          engine: null,
          hint: `Question engine not reachable at ${ENGINE_URL}. Start it with: cd ai-engine/question_bank_engine && python -m api`,
        },
      });
    }
  }
);

/**
 * POST /api/qb-ai/documents
 * Upload a source document; forwarded to the engine which chunks + embeds it.
 */
router.post(
  "/documents",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  upload.single("file"),
  async (req, res, next) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) return res.status(400).json({ success: false, error: "No file uploaded" });

      const form = new FormData();
      form.append("file", new Blob([file.buffer]), file.originalname);

      const resp = await fetch(`${ENGINE_URL}/documents/ingest`, {
        method: "POST",
        headers: { "x-api-key": ENGINE_API_KEY },
        body: form,
        signal: AbortSignal.timeout(120000),
      });

      const body = await resp.json() as any;
      if (!resp.ok) {
        return res.status(502).json({ success: false, error: body?.detail || "Engine ingestion failed" });
      }
      res.json({ success: true, data: body });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/qb-ai/generate
 * Generate questions for a topic via the engine (RAG-grounded when enabled).
 */
router.post(
  "/generate",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  validate(
    z.object({
      topic: z.string().min(3).max(200),
      difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
      question_type: z.enum(["multiple_choice", "true_false", "short_answer"]).default("multiple_choice"),
      count: z.number().int().min(1).max(10).default(3),
      use_rag: z.boolean().default(true),
    })
  ),
  async (req, res, next) => {
    try {
      const resp = await fetch(`${ENGINE_URL}/questions/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(180000),
      });
      const body = await resp.json() as any;
      if (!resp.ok) {
        return res.status(502).json({ success: false, error: body?.detail || "Generation failed" });
      }
      res.json({ success: true, data: body });
    } catch (err: any) {
      if (err?.name === "TimeoutError" || err?.cause?.code === "ECONNREFUSED") {
        return res.status(503).json({
          success: false,
          error: "Question engine is offline or timed out. Start it and try again.",
        });
      }
      next(err);
    }
  }
);

/**
 * POST /api/qb-ai/import
 * Publish reviewed AI-generated questions into the global question_bank.
 */
router.post(
  "/import",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  validate(
    z.object({
      questions: z
        .array(
          z.object({
            question: z.string().min(5),
            options: z.array(z.string()).optional(),
            correct_answer: z.string().min(1),
            explanation: z.string().optional(),
            category: z.string().default("aptitude"),
            difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
            tags: z.array(z.string()).optional(),
            marks: z.number().int().min(1).max(20).default(1),
          })
        )
        .min(1)
        .max(50),
      college_ids: z.array(z.string().uuid()).max(100).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const userId = (req as any).user?.userId;
      const { questions, college_ids } = req.body as {
        questions: Array<{
          question: string;
          options?: string[];
          correct_answer: string;
          explanation?: string;
          category: string;
          difficulty: "easy" | "medium" | "hard";
          tags?: string[];
          marks: number;
        }>;
        college_ids?: string[];
      };

      let imported = 0;
      let assigned = 0;
      for (const q of questions) {
        const category = VALID_CATEGORIES.has(q.category) ? q.category : "aptitude";
        // Guarantee the 'ai-generated' provenance tag regardless of client input.
        const tags = Array.from(new Set([...(q.tags || []), "ai-generated"]));
        try {
          const rows = await query<{ id: string }>(
            `INSERT INTO question_bank
               (category, type, difficulty_level, question_text, options, correct_answer,
                explanation, marks, tags, created_by, is_active)
             VALUES ($1, 'multiple_choice', $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
             RETURNING id`,
            [
              category,
              q.difficulty,
              q.question,
              JSON.stringify(q.options || []),
              q.correct_answer,
              q.explanation || null,
              q.marks,
              tags,
              userId || null,
            ]
          );
          imported++;

          const questionId = rows[0]?.id;
          if (questionId && college_ids && college_ids.length > 0) {
            for (const collegeId of college_ids) {
              await query(
                `INSERT INTO question_college_assignments (question_id, college_id, assigned_by)
                 VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
                [questionId, collegeId, userId || null]
              );
              assigned++;
            }
          }
        } catch (e) {
          logger.error("Failed to import AI question:", e);
        }
      }

      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId || "system",
          "IMPORT_AI_QUESTIONS",
          "question_bank",
          null,
          req.ip,
          JSON.stringify({ imported, total: questions.length, college_count: college_ids?.length || 0 }),
        ]
      ).catch((e) => logger.error("Audit log failed for AI import:", e));

      res.status(201).json({
        success: true,
        message:
          `Imported ${imported} of ${questions.length} question(s) into the question bank` +
          (college_ids && college_ids.length > 0 ? ` and assigned to ${college_ids.length} college(s)` : ""),
        data: { imported, total: questions.length, assignments: assigned },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
