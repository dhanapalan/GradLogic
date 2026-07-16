import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/campus.campaigns.controller.js";
import * as results from "../controllers/campus.campaignResults.controller.js";
import * as integrity from "../controllers/campus.campaignIntegrity.controller.js";

const router = Router();

const VIEW_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "placement_cell",
  "super_admin",
  "hr",
] as const;

const WRITE_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "super_admin",
  "hr",
] as const;

const MANAGE_ROLES = ["college_admin", "college", "super_admin", "hr"] as const;

router.use(authenticate);

router.get("/meta", authorize(...VIEW_ROLES), ctrl.getMeta);
router.post("/preview-audience", authorize(...WRITE_ROLES), ctrl.previewAudience);
router.get("/", authorize(...VIEW_ROLES), ctrl.listCampaigns);
router.post("/", authorize(...WRITE_ROLES), ctrl.createCampaign);

// Module 07 — Evaluation & Results (before /:id catch-alls that could collide)
router.get("/:id/results", authorize(...VIEW_ROLES), results.listResults);
router.post("/:id/evaluate", authorize(...WRITE_ROLES), results.evaluateCampaign);
router.post("/:id/results/publish", authorize(...WRITE_ROLES), results.publishResults);
router.get("/:id/results/:evaluationId", authorize(...VIEW_ROLES), results.getEvaluation);
router.put(
  "/:id/results/:evaluationId/questions/:questionId",
  authorize(...WRITE_ROLES),
  results.scoreShortAnswer
);

// Module 08 — Analytics & Reports
router.get("/:id/analytics", authorize(...VIEW_ROLES), results.getAnalytics);
router.get("/:id/analytics/export", authorize(...VIEW_ROLES), results.exportAnalytics);

// Module 09 — Integrity (AI Proctoring)
router.get("/:id/integrity", authorize(...VIEW_ROLES), integrity.getDashboard);
router.put("/:id/integrity/settings", authorize(...WRITE_ROLES), integrity.updateSettings);
router.get(
  "/:id/integrity/attempts/:attemptId",
  authorize(...VIEW_ROLES),
  integrity.getAttemptTimeline
);
router.patch(
  "/:id/integrity/incidents/:incidentId",
  authorize(...WRITE_ROLES),
  integrity.reviewIncident
);

router.get("/:id", authorize(...VIEW_ROLES), ctrl.getCampaign);
router.put("/:id", authorize(...WRITE_ROLES), ctrl.updateCampaign);
router.patch("/:id/publish", authorize(...WRITE_ROLES), ctrl.publishCampaign);
router.patch("/:id/close", authorize(...WRITE_ROLES), ctrl.closeCampaign);
router.patch("/:id/archive", authorize(...WRITE_ROLES), ctrl.archiveCampaign);
router.delete("/:id", authorize(...MANAGE_ROLES), ctrl.softDeleteCampaign);

export default router;
