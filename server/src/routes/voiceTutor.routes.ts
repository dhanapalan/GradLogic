// =============================================================================
// AI Voice Tutor (Phase 6) — student-only routes.
//
// GET  /api/voice-tutor/knowledge-object/:id  — student-safe question projection
// POST /api/voice-tutor/converse              — SSE stream of one tutor turn
//
// No new pattern exists in this codebase for SSE yet — this is the first.
// Response is a standard text/event-stream: repeated `data: {...}\n\n` frames
// of type "delta" (a text chunk as it's generated) followed by one "done"
// frame (final text + SSML + requiresReview) or one "error" frame.
// =============================================================================

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { logger } from "../config/logger.js";
import {
  converse,
  converseRequestSchema,
  getKnowledgeObject,
} from "../services/voiceTutor.service.js";
import { AppError } from "../middleware/errorHandler.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

/**
 * GET /api/voice-tutor/knowledge-object/:id
 * The question a student is about to open the Voice Tutor for. Never
 * includes correct_answer/test_cases/starter_code.
 */
router.get(
  "/knowledge-object/:id",
  validate(z.object({ id: z.string().uuid() }), "params"),
  async (req, res, next) => {
    try {
      const { id } = req.params as unknown as { id: string };
      const ko = await getKnowledgeObject(id);
      res.json({ success: true, data: ko });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/voice-tutor/converse
 * SSE stream of one Voice Tutor turn (listen/explain/hint/example/translate/ask).
 */
router.post(
  "/converse",
  validate(converseRequestSchema, "body"),
  async (req: Request, res: Response) => {
    const params = {
      ...(req.body as z.infer<typeof converseRequestSchema>),
      studentId: req.user!.userId,
    };
    logAiUsage("voice_tutor", req.user!.userId);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (event: Record<string, unknown>) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    // If the student closes the tab / navigates away mid-stream, stop
    // writing — there's nothing to interrupt server-side (no cancellable
    // Anthropic stream handle is threaded through here), but this avoids
    // writing to a dead socket.
    let clientGone = false;
    req.on("close", () => {
      clientGone = true;
    });

    try {
      const result = await converse(params, (chunk) => {
        if (!clientGone) send({ type: "delta", text: chunk });
      });
      if (!clientGone) {
        send({ type: "done", text: result.text, ssml: result.ssml, requiresReview: result.requiresReview });
      }
    } catch (err) {
      logger.error("Voice Tutor converse failed:", err);
      if (!clientGone) {
        const message = err instanceof AppError ? err.message : "The AI Voice Tutor hit an error";
        send({ type: "error", message });
      }
    } finally {
      if (!clientGone) res.end();
    }
  },
);

export default router;
