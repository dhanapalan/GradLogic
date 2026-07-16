// =============================================================================
// AI Semantic Search (Phase 10) — student-only route.
//
// GET /api/ai-search?q=...&limit=10
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { aiSearch } from "../services/aiSearch.service.js";
import { logAiUsage } from "../services/aiUsage.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

const searchQuerySchema = z.object({
  q: z.string().min(2).max(200),
  limit: z.coerce.number().int().min(1).max(30).optional().default(10),
});

router.get("/", async (req, res, next) => {
  try {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: "Invalid query", message: parsed.error.message });
    }
    const result = await aiSearch(parsed.data.q, parsed.data.limit);
    logAiUsage("ai_search", req.user!.userId);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
