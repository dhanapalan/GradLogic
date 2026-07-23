// =============================================================================
// AI Question Bank — proxy to the Python question engine (LangChain + ChromaDB)
// and importer that publishes reviewed questions into the question_bank table.
// =============================================================================

import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import dns from "node:dns/promises";
import net from "node:net";
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
 * Rejects loopback, private, link-local, and other non-public IP ranges to
 * block SSRF via /fetch-url (cloud metadata, internal services, etc).
 */
function isDisallowedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 0) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true; // loopback
    if (normalized.startsWith("fe80:")) return true; // link-local
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
    if (normalized.startsWith("::ffff:")) return isDisallowedIp(normalized.slice(7));
    return false;
  }
  return true; // not a recognizable IP — refuse rather than risk it
}

/** Resolves a URL's hostname and throws if it points at a disallowed IP. */
async function assertPublicHost(urlStr: string): Promise<void> {
  const { hostname } = new URL(urlStr);
  if (hostname === "localhost") throw new Error("URL host is not allowed");
  const addresses = await dns.lookup(hostname, { all: true });
  for (const { address } of addresses) {
    if (isDisallowedIp(address)) throw new Error("URL host is not allowed");
  }
}

/**
 * GET /api/qb-ai/health
 * Engine reachability + knowledge base status. Never 500s — reports offline.
 */
router.get(
  "/health",
  authenticate,
  authorize("super_admin", "hr", "engineer", "college_admin", "college", "instructor"),
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
  authorize("super_admin", "hr", "engineer", "college_admin", "college", "instructor"),
  validate(
    z.object({
      topic: z.string().min(3).max(200),
      difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
      question_type: z
        .enum(["multiple_choice", "true_false", "short_answer", "flashcard", "lesson", "voice_lesson"])
        .default("multiple_choice"),
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
            hint: z.string().optional(),
            learning_objectives: z.array(z.string()).optional(),
            reference_links: z.array(z.string()).optional(),
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
          // status is explicit ('pending'), NOT the column default ('published') —
          // AI-generated content must clear Review Center before it's live. The
          // table default is correct for other insert paths (e.g. Books, which
          // is pre-authored reference material, not AI output).
          const rows = await query<{ id: string }>(
            `INSERT INTO question_bank
               (category, type, difficulty_level, question_text, options, correct_answer,
                explanation, marks, tags, created_by, is_active, status,
                hint, learning_objectives, reference_links)
             VALUES ($1, 'multiple_choice', $2, $3, $4, $5, $6, $7, $8, $9, TRUE, 'pending', $10, $11, $12)
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
              (q as any).hint || null,
              (q as any).learning_objectives || [],
              (q as any).reference_links || [],
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

/**
 * POST /api/qb-ai/import-content
 * Stage reviewed Flashcards/Lessons/Voice Lessons into ai_content_items
 * (pending_review) — the non-question-shaped counterpart to /import above.
 * Approve/reject/publish happen via /api/superadmin/ai-content/:id/*.
 */
router.post(
  "/import-content",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  validate(
    z.object({
      content_type: z.enum(["flashcard", "lesson", "voice_lesson"]),
      items: z
        .array(
          z.object({
            title: z.string().min(3),
            body: z.string().min(3),
            explanation: z.string().optional(),
            category: z.string().default("aptitude"),
            difficulty: z.enum(["easy", "medium", "hard", "expert"]).default("medium"),
            tags: z.array(z.string()).optional(),
          })
        )
        .min(1)
        .max(50),
    })
  ),
  async (req, res, next) => {
    try {
      const userId = (req as any).user?.userId;
      const { content_type, items } = req.body as {
        content_type: "flashcard" | "lesson" | "voice_lesson";
        items: Array<{
          title: string;
          body: string;
          explanation?: string;
          category: string;
          difficulty: string;
          tags?: string[];
        }>;
      };

      let imported = 0;
      for (const item of items) {
        const tags = Array.from(new Set([...(item.tags || []), "ai-generated"]));
        try {
          await query(
            `INSERT INTO ai_content_items
               (content_type, title, body, explanation, category, difficulty, tags, status, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending_review', $8)`,
            [content_type, item.title, item.body, item.explanation || null, item.category, item.difficulty, tags, userId || null]
          );
          imported++;
        } catch (e) {
          logger.error("Failed to stage AI content item:", e);
        }
      }

      res.status(201).json({
        success: true,
        message: `Staged ${imported} of ${items.length} item(s) for review`,
        data: { imported, total: items.length },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/qb-ai/fetch-url
 * Fetch a URL server-side and return its plain text (HTML tags stripped) —
 * feeds the SAME /documents ingestion pipeline above for Website/GitHub
 * sources in AI Content Studio. This endpoint only fetches + extracts text;
 * it does not duplicate any embedding/generation/import logic.
 */
router.post(
  "/fetch-url",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  validate(z.object({ url: z.string().url() })),
  async (req, res, next) => {
    try {
      let target = (req.body.url as string).trim();

      // github.com/<owner>/<repo>/blob/<ref>/<path> → raw.githubusercontent.com equivalent
      const ghBlob = target.match(
        /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/
      );
      if (ghBlob) {
        const [, owner, repo, ref, path] = ghBlob;
        target = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
      }

      // Validate the target (and every redirect hop) resolves to a public IP —
      // blocks SSRF to loopback/private/link-local/cloud-metadata addresses.
      let resp: Response;
      let hops = 0;
      while (true) {
        await assertPublicHost(target);
        const attempt = await fetch(target, {
          signal: AbortSignal.timeout(15000),
          headers: { "User-Agent": "TalentSecure-AI Content Studio" },
          redirect: "manual",
        });
        if (attempt.status >= 300 && attempt.status < 400) {
          const location = attempt.headers.get("location");
          if (!location || ++hops > 5) {
            return res.status(502).json({ success: false, error: "Too many redirects" });
          }
          target = new URL(location, target).toString();
          continue;
        }
        resp = attempt;
        break;
      }
      if (!resp.ok) {
        return res
          .status(502)
          .json({ success: false, error: `Fetch failed: HTTP ${resp.status}` });
      }

      const contentType = resp.headers.get("content-type") || "";
      const MAX_BYTES = 2 * 1024 * 1024; // 2 MB — plenty for source text, keeps the request bounded
      const buf = await resp.arrayBuffer();
      const raw = Buffer.from(buf.slice(0, MAX_BYTES)).toString("utf-8");

      let text = raw;
      let title: string | null = null;
      if (contentType.includes("html")) {
        const titleMatch = raw.match(/<title[^>]*>([^<]*)<\/title>/i);
        title = titleMatch ? titleMatch[1].trim() : null;
        text = raw
          .replace(/<script[\s\S]*?<\/script>/gi, " ")
          .replace(/<style[\s\S]*?<\/style>/gi, " ")
          .replace(/<!--[\s\S]*?-->/g, " ")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/[ \t]+/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }

      if (!text.trim()) {
        return res.status(422).json({ success: false, error: "No extractable text at that URL" });
      }

      res.json({ success: true, data: { text, title, sourceUrl: target } });
    } catch (err: any) {
      if (err?.name === "TimeoutError") {
        return res.status(504).json({ success: false, error: "Fetching the URL timed out" });
      }
      next(err);
    }
  }
);

// =============================================================================
// AI CONTENT ITEMS — review/publish for Flashcards, Lessons, Voice Lessons.
// Same lifecycle as question_bank review (pending_review -> approve/reject),
// but publish targets differ per type: flashcards -> flashcards table,
// lesson/voice_lesson -> lessons table (requires a target module).
// =============================================================================

/**
 * GET /api/qb-ai/content-items
 */
router.get(
  "/content-items",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  async (req, res, next) => {
    try {
      const { content_type, status } = req.query as Record<string, string>;
      const rows = await query(
        `SELECT * FROM ai_content_items
         WHERE ($1::text IS NULL OR content_type = $1)
           AND ($2::text IS NULL OR status = $2)
         ORDER BY created_at DESC`,
        [content_type || null, status || null]
      );
      res.json({ success: true, data: rows });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/qb-ai/content-items/:id/approve
 */
router.post(
  "/content-items/:id/approve",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  async (req, res, next) => {
    try {
      await query(
        "UPDATE ai_content_items SET status = 'approved', updated_at = NOW() WHERE id = $1 AND status = 'pending_review'",
        [req.params.id]
      );
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/qb-ai/content-items/:id/reject
 */
router.post(
  "/content-items/:id/reject",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  validate(z.object({ reason: z.string().min(3) })),
  async (req, res, next) => {
    try {
      await query(
        "UPDATE ai_content_items SET status = 'rejected', rejection_reason = $2, updated_at = NOW() WHERE id = $1",
        [req.params.id, req.body.reason]
      );
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

/**
 * POST /api/qb-ai/content-items/:id/publish
 * Flashcards publish standalone. Lesson/voice_lesson require a target
 * module_id and land as a real row in the lessons table.
 */
router.post(
  "/content-items/:id/publish",
  authenticate,
  authorize("super_admin", "hr", "engineer"),
  validate(z.object({ module_id: z.string().uuid().optional() })),
  async (req, res, next) => {
    try {
      const userId = (req as any).user?.userId;
      const [item] = await query<{
        id: string; content_type: string; title: string; body: string; category: string; difficulty: string; tags: string[]; status: string;
      }>("SELECT * FROM ai_content_items WHERE id = $1", [req.params.id]);

      if (!item) return res.status(404).json({ success: false, error: "Content item not found" });
      if (item.status !== "approved") {
        return res.status(400).json({ success: false, error: "Approve this item before publishing" });
      }

      if (item.content_type === "flashcard") {
        await query(
          `INSERT INTO flashcards (front, back, category, difficulty, tags, created_by)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [item.title, item.body, item.category, item.difficulty, item.tags, userId || null]
        );
      } else if (
        item.content_type === "interview_question" ||
        item.content_type === "case_study" ||
        item.content_type === "learning_resource"
      ) {
        await query(
          `INSERT INTO content_library_items
             (content_type, title, body, category, difficulty, tags, status, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,'published',$7)`,
          [
            item.content_type,
            item.title,
            item.body,
            item.category,
            item.difficulty,
            item.tags,
            userId || null,
          ]
        );
      } else {
        const moduleId = req.body.module_id;
        if (!moduleId) {
          return res.status(400).json({ success: false, error: "module_id is required to publish a lesson" });
        }
        const [existingCount] = await query<{ count: string }>(
          "SELECT COUNT(*)::int AS count FROM lessons WHERE module_id = $1",
          [moduleId]
        );
        const [lesson] = await query<{ id: string }>(
          `INSERT INTO lessons (module_id, title, content_type, content_text, sort_order)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            moduleId,
            item.title,
            item.content_type === "voice_lesson" ? "voice_script" : "text",
            item.body,
            Number(existingCount?.count || 0),
          ]
        );
        await query("UPDATE ai_content_items SET published_lesson_id = $2 WHERE id = $1", [item.id, lesson.id]);
      }

      await query("UPDATE ai_content_items SET status = 'published', updated_at = NOW() WHERE id = $1", [item.id]);
      res.json({ success: true });
    } catch (err) { next(err); }
  }
);

export default router;
