// =============================================================================
// Multi-language Learning / AI Translator (Phase 14) — student-only route.
// GET /api/translator/:questionId?language=ta
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { translateKnowledgeObject } from "../services/translator.service.js";
import { VOICE_TUTOR_LANGUAGES } from "../services/voiceTutor.service.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student", "super_admin", "hr", "engineer"));

const querySchema = z.object({
  language: z.enum(Object.keys(VOICE_TUTOR_LANGUAGES) as [string, ...string[]]),
});

router.get("/:questionId", async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid query", message: parsed.error.message });
    }
    const language = parsed.data.language as keyof typeof VOICE_TUTOR_LANGUAGES;
    const translated = await translateKnowledgeObject(req.params.questionId as string, language);
    logAiUsage("translator", req.user!.userId);
    res.json({ success: true, data: translated });
  } catch (err) {
    next(err);
  }
});

export default router;
