// =============================================================================
// AI Knowledge Engine (Phase 5) — "the heart" of the AI Learning Companion.
//
// Thin HTTP layer over aiKnowledgeEngine.service.ts. Every route:
//   - validates its request body with Zod (existing `validate` middleware),
//   - calls exactly one service function, which itself validates the AI's
//     JSON response against a Zod schema before returning,
//   - returns { success, data } — never touches the database.
//
// Persisting a result (e.g. saving a generated hint onto a question) is the
// caller's job via the existing question-bank write endpoints.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as engine from "../services/aiKnowledgeEngine.service.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();

const canUse = authorize("super_admin", "hr", "engineer");

// Logs every capability call once, keyed by route path — cheaper than adding
// a logAiUsage() call to each of the 10 handlers individually. Registered
// before the per-route `authenticate` middleware runs, so req.user isn't set
// yet at this point — log on response finish instead, by which time the
// route's own authenticate middleware has populated req.user on this same
// request object.
router.use((req, res, next) => {
  res.on("finish", () => {
    if (req.method === "POST" && res.statusCode < 400) {
      logAiUsage(`knowledge_engine:${req.path.replace(/^\//, "")}`, req.user?.userId ?? null);
    }
  });
  next();
});

router.post(
  "/explain",
  authenticate,
  canUse,
  validate(z.object({ content: z.string().min(1).max(20000), audience: z.string().max(100).optional() })),
  async (req, res, next) => {
    try {
      const { content, audience } = req.body as { content: string; audience?: string };
      res.json({ success: true, data: await engine.explain(content, audience) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/summarize",
  authenticate,
  canUse,
  validate(z.object({ content: z.string().min(1).max(20000), maxWords: z.number().int().min(10).max(2000).optional() })),
  async (req, res, next) => {
    try {
      const { content, maxWords } = req.body as { content: string; maxWords?: number };
      res.json({ success: true, data: await engine.summarize(content, maxWords) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/improve",
  authenticate,
  canUse,
  validate(z.object({ content: z.string().min(1).max(20000), focus: z.string().max(200).optional() })),
  async (req, res, next) => {
    try {
      const { content, focus } = req.body as { content: string; focus?: string };
      res.json({ success: true, data: await engine.improve(content, focus) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/generate",
  authenticate,
  canUse,
  validate(z.object({ instruction: z.string().min(1).max(5000), count: z.number().int().min(1).max(20).default(3) })),
  async (req, res, next) => {
    try {
      const { instruction, count } = req.body as { instruction: string; count: number };
      res.json({ success: true, data: await engine.generateItems(instruction, count) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/translate",
  authenticate,
  canUse,
  validate(z.object({ content: z.string().min(1).max(20000), targetLanguage: z.string().min(2).max(50) })),
  async (req, res, next) => {
    try {
      const { content, targetLanguage } = req.body as { content: string; targetLanguage: string };
      res.json({ success: true, data: await engine.translate(content, targetLanguage) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/recommend",
  authenticate,
  canUse,
  validate(z.object({ context: z.string().min(1).max(20000), count: z.number().int().min(1).max(20).default(5) })),
  async (req, res, next) => {
    try {
      const { context, count } = req.body as { context: string; count: number };
      res.json({ success: true, data: await engine.recommend(context, count) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/validate",
  authenticate,
  canUse,
  validate(z.object({ content: z.string().min(1).max(20000), criteria: z.string().max(1000).optional() })),
  async (req, res, next) => {
    try {
      const { content, criteria } = req.body as { content: string; criteria?: string };
      res.json({ success: true, data: await engine.validateContent(content, criteria) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/difficulty",
  authenticate,
  canUse,
  validate(z.object({ questionText: z.string().min(1).max(10000) })),
  async (req, res, next) => {
    try {
      const { questionText } = req.body as { questionText: string };
      res.json({ success: true, data: await engine.predictDifficulty(questionText) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/bloom",
  authenticate,
  canUse,
  validate(z.object({ questionText: z.string().min(1).max(10000) })),
  async (req, res, next) => {
    try {
      const { questionText } = req.body as { questionText: string };
      res.json({ success: true, data: await engine.classifyBloom(questionText) });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/skills",
  authenticate,
  canUse,
  validate(z.object({ content: z.string().min(1).max(20000) })),
  async (req, res, next) => {
    try {
      const { content } = req.body as { content: string };
      res.json({ success: true, data: await engine.extractSkills(content) });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
