// =============================================================================
// AI Placement Coach (Phase 9) — student-only routes.
//
// GET  /api/placement-coach/report          — readiness/weak-skills/interview
//                                              questions/coding challenges/study plan
// POST /api/placement-coach/voice/converse  — SSE placement-coaching conversation
//                                              (same framing as /api/voice-tutor/converse)
// =============================================================================

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { logger } from "../config/logger.js";
import { getPlacementCoachReport } from "../services/placementCoach.service.js";
import { converseCoach, coachConverseRequestSchema } from "../services/placementVoiceCoach.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

const reportQuerySchema = z.object({
  targetCompany: z.string().max(200).optional(),
  targetRole: z.string().max(200).optional(),
});

router.get("/report", async (req, res, next) => {
  try {
    const parsed = reportQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid query", message: parsed.error.message });
    }
    const report = await getPlacementCoachReport(req.user!.userId, parsed.data.targetCompany, parsed.data.targetRole);
    res.json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
});

router.post("/voice/converse", async (req: Request, res: Response) => {
  const parsed = coachConverseRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: "Invalid request", message: parsed.error.message });
    return;
  }
  const params = { ...parsed.data, studentId: req.user!.userId };
  logAiUsage("placement_coach_voice", req.user!.userId);

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
    const result = await converseCoach(params, (chunk) => {
      if (!clientGone) send({ type: "delta", text: chunk });
    });
    if (!clientGone) send({ type: "done", text: result.text, requiresReview: result.requiresReview });
  } catch (err) {
    logger.error("Placement Coach voice converse failed:", err);
    if (!clientGone) {
      const message = err instanceof AppError ? err.message : "The AI Placement Coach hit an error";
      send({ type: "error", message });
    }
  } finally {
    if (!clientGone) res.end();
  }
});

export default router;
