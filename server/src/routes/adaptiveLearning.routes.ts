// =============================================================================
// Adaptive Learning (Phase 8) — student-only routes.
//
// GET /api/adaptive-learning/track          — attempts/time/accuracy per skill
// GET /api/adaptive-learning/weak-skills    — weakest skills, ranked
// GET /api/adaptive-learning/recommend      — next lesson/question/difficulty/time
// GET /api/adaptive-learning/learning-path  — auto-generated ordered path
//
// All aggregation reads real practice_attempts history; nothing here is
// client-suppliable — studentId always comes from the JWT.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import {
  getSkillAccuracy,
  getWeakSkills,
  recommendNext,
  generateLearningPath,
} from "../services/adaptive.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

router.get("/track", async (req, res, next) => {
  try {
    const skills = await getSkillAccuracy(req.user!.userId);
    res.json({ success: true, data: skills });
  } catch (err) {
    next(err);
  }
});

// Query-param validation is done inline (not via the shared `validate`
// middleware's "query" mode) — Express 5 makes req.query a getter-only
// accessor, so `req.query = parsed` throws; this affects any route using
// validate(schema, "query") in this codebase (e.g. GET /question-bank/random)
// and is a pre-existing issue outside this feature's scope to fix broadly.
const weakSkillsQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(8).optional().default(5) });

router.get("/weak-skills", async (req, res, next) => {
  try {
    const parsed = weakSkillsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid query", message: parsed.error.message });
    }
    const skills = await getWeakSkills(req.user!.userId, parsed.data.limit);
    res.json({ success: true, data: skills });
  } catch (err) {
    next(err);
  }
});

router.get("/recommend", async (req, res, next) => {
  try {
    const recommendation = await recommendNext(req.user!.userId);
    res.json({ success: true, data: recommendation });
  } catch (err) {
    next(err);
  }
});

const learningPathQuerySchema = z.object({ maxSteps: z.coerce.number().int().min(1).max(8).optional().default(5) });

router.get("/learning-path", async (req, res, next) => {
  try {
    const parsed = learningPathQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid query", message: parsed.error.message });
    }
    const path = await generateLearningPath(req.user!.userId, parsed.data.maxSteps);
    res.json({ success: true, data: path });
  } catch (err) {
    next(err);
  }
});

export default router;
