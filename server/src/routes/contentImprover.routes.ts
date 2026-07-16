// =============================================================================
// AI Content Improver (Phase 13) — superadmin-only routes.
//
// POST /api/content-improver/:questionId/improve   — propose a new version (never touches the live row)
// GET  /api/content-improver/:questionId/versions   — version history
// POST /api/content-improver/versions/:versionId/apply    — explicit apply
// POST /api/content-improver/versions/:versionId/reject   — explicit reject
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  improveQuestion,
  getVersionHistory,
  applyVersion,
  rejectVersion,
  IMPROVEMENT_TYPES,
} from "../services/contentImprover.service.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("super_admin", "hr"));

router.post(
  "/:questionId/improve",
  validate(z.object({ improvementType: z.enum(IMPROVEMENT_TYPES) })),
  async (req, res, next) => {
    try {
      const questionId = req.params.questionId as string;
      const { improvementType } = req.body as { improvementType: (typeof IMPROVEMENT_TYPES)[number] };
      const version = await improveQuestion(questionId, improvementType, req.user!.userId);
      logAiUsage(`content_improver:${improvementType}`, req.user!.userId);
      res.status(201).json({ success: true, data: version });
    } catch (err) {
      next(err);
    }
  },
);

router.get("/:questionId/versions", async (req, res, next) => {
  try {
    const versions = await getVersionHistory(req.params.questionId);
    res.json({ success: true, data: versions });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/apply", async (req, res, next) => {
  try {
    const updated = await applyVersion(req.params.versionId);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.post("/versions/:versionId/reject", async (req, res, next) => {
  try {
    await rejectVersion(req.params.versionId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
