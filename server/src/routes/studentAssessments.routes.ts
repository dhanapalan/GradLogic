import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/studentAssessments.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("student"));

router.get("/meta", ctrl.getMeta);
router.get("/my-assessments", ctrl.listMyAssessments);
router.get("/my-assessments/:campaignId/instructions", ctrl.getInstructions);
router.post("/my-assessments/:campaignId/start", ctrl.startAssessment);
router.get("/my-assessments/:campaignId/attempt", ctrl.getAttempt);
router.get("/my-assessments/:campaignId/attempt/sync", ctrl.syncAttemptTimer);
router.get("/my-assessments/:campaignId/attempt/summary", ctrl.getSubmissionSummary);
router.put("/my-assessments/:campaignId/attempt", ctrl.saveAttempt);
router.post("/my-assessments/:campaignId/attempt/submit", ctrl.submitAttempt);
router.get("/my-assessments/:campaignId/attempt/completion", ctrl.getSubmissionCompletion);
// Module 09 — Integrity (separate from save/submit/scoring)
router.get("/my-assessments/:campaignId/attempt/integrity", ctrl.getIntegrityStatus);
router.post("/my-assessments/:campaignId/attempt/integrity/events", ctrl.logIntegrityEvent);
router.get("/my-assessments/:campaignId/result", ctrl.getStudentResult);
router.get("/my-assessments/:campaignId", ctrl.getMyAssessment);

export default router;
