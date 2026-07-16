// =============================================================================
// Knowledge Graph (Phase 12) — superadmin-only route.
// GET /api/knowledge-graph
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { generateKnowledgeGraph } from "../services/knowledgeGraph.service.js";

const router = Router();
router.use(authenticate);
router.use(authorize("super_admin"));

router.get("/", async (_req, res, next) => {
  try {
    const graph = await generateKnowledgeGraph();
    res.json({ success: true, data: graph });
  } catch (err) {
    next(err);
  }
});

export default router;
