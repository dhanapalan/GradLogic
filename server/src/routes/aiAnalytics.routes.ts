// =============================================================================
// AI Analytics Dashboard (Phase 11) — superadmin-only route.
// GET /api/ai-analytics/dashboard
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { getAiAnalyticsDashboard } from "../services/aiAnalytics.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("super_admin"));

router.get("/dashboard", async (_req, res, next) => {
  try {
    const dashboard = await getAiAnalyticsDashboard();
    res.json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
});

export default router;
