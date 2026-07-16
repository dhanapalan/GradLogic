// =============================================================================
// TalentSecure AI — Exam Session Routes
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/examSession.controller.js";

const router = Router();

// All routes require authentication (student role)
router.use(authenticate);
router.use(authorize("student"));

// Student exam session endpoints
router.get("/my-drives", ctrl.getMyDrives);
router.get("/available-mocks", ctrl.getAvailableMocks);
router.post("/:driveId/enroll", ctrl.enroll);
router.post("/:driveId/start", ctrl.startSession);
router.get("/:driveId/session", ctrl.getSession);
router.get("/:driveId/evaluation", ctrl.getEvaluation);
router.put("/:driveId/save", ctrl.saveAnswer);
router.post("/:driveId/submit", ctrl.submitExam);

export default router;
