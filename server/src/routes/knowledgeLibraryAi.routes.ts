import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { logAiUsage } from "../services/aiUsage.service.js";
import * as svc from "../services/knowledgeLibraryAi.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer"] as const;

router.use(authenticate);
router.use(authorize(...ADMIN));

router.get(
  "/search",
  async (req, res, next) => {
    try {
      const parsed = z
        .object({
          q: z.string().min(2).max(200),
          limit: z.coerce.number().int().min(1).max(30).optional().default(10),
        })
        .safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
      }
      const data = await svc.adminAiSearch(parsed.data.q, parsed.data.limit);
      logAiUsage("kl_ai_search", req.user!.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/related/:questionId", async (req, res, next) => {
  try {
    const data = await svc.getRelatedQuestions(req.params.questionId, Number(req.query.limit) || 10);
    if (!data) {
      res.status(404).json({ success: false, message: "Question not found" });
      return;
    }
    logAiUsage("kl_ai_related", req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/duplicates/:questionId", async (req, res, next) => {
  try {
    const data = await svc.findDuplicatesForQuestion(req.params.questionId, Number(req.query.limit) || 10);
    if (!data) {
      res.status(404).json({ success: false, message: "Question not found" });
      return;
    }
    logAiUsage("kl_ai_duplicates", req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/embeddings/coverage", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getEmbeddingCoverage() });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/embeddings/backfill",
  validate(
    z.object({
      limit: z.number().int().min(1).max(100).optional(),
      questionIds: z.array(z.string().uuid()).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await svc.backfillEmbeddings(req.body.limit ?? 50, req.body.questionIds);
      logAiUsage("kl_ai_embed_backfill", req.user!.userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
