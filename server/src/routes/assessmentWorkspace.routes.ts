/**
 * Module 06 — Assessment Workspace attempt-scoped facade.
 * Delegates to existing campaign attempt engine; student-only.
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/assessmentWorkspaceHub.controller.js";

const router = Router();

router.use(authenticate);
router.use(authorize("student"));

router.post("/launch", ctrl.postLaunch);
router.get("/:attemptId/questions", ctrl.getQuestions);
router.post("/:attemptId/response", ctrl.postResponse);
router.put("/:attemptId/response", ctrl.putResponse);
router.post("/:attemptId/autosave", ctrl.postAutosave);
router.post("/:attemptId/heartbeat", ctrl.postHeartbeat);
router.post("/:attemptId/telemetry", ctrl.postTelemetry);
router.post("/:attemptId/resume", ctrl.postResume);
router.post("/:attemptId/submit", ctrl.postSubmit);
router.get("/:attemptId/summary", ctrl.getSummary);
router.get("/:attemptId", ctrl.getWorkspace);

export default router;
