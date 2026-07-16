// =============================================================================
// AI Learning Companion (Phase 15) — student-only route.
// POST /api/learning-companion/converse — SSE, same framing as voice-tutor/converse
// =============================================================================

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { logger } from "../config/logger.js";
import { converseCompanion, companionConverseRequestSchema } from "../services/learningCompanion.service.js";
import { getLatestAssessmentInsight } from "../services/assessmentIntegration.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

/** Latest Assessment Hub evaluation → Companion study object */
router.get("/post-assessment", async (req, res, next) => {
  try {
    const data = await getLatestAssessmentInsight(req.user!.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/converse", async (req: Request, res: Response) => {
  const parsed = companionConverseRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "Invalid request", message: parsed.error.message });
    return;
  }
  logAiUsage(`learning_companion:${parsed.data.action}`, req.user!.userId);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
  });

  try {
    const result = await converseCompanion(parsed.data, (chunk) => {
      if (!clientGone) send({ type: "delta", text: chunk });
    });
    if (!clientGone) send({ type: "done", text: result.text, requiresReview: result.requiresReview, ragUsed: result.ragUsed });
  } catch (err) {
    logger.error("Learning Companion converse failed:", err);
    if (!clientGone) {
      const message = err instanceof AppError ? err.message : "The AI Learning Companion hit an error";
      send({ type: "error", message });
    }
  } finally {
    if (!clientGone) res.end();
  }
});

export default router;
