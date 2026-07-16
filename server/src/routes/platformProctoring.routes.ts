/**
 * Platform Proctoring facade — /api/platform/proctoring/*
 * Delegates to college campaign integrity (Module 09). No duplicate scoring engine.
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/platformProctoring.controller.js";

const router = Router();

const COLLEGE_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "placement_cell",
  "super_admin",
  "hr",
] as const;

router.use(authenticate);

/** College: configure campaign proctoring */
router.put(
  "/campaigns/:campaignId/settings",
  authorize(...COLLEGE_ROLES),
  ctrl.putCampaignSettings
);

/** College/Faculty: proctoring report (dashboard) */
router.get(
  "/campaigns/:campaignId/report",
  authorize(...COLLEGE_ROLES),
  ctrl.getCampaignReport
);

/** College/Faculty: violation timeline for one attempt */
router.get(
  "/attempts/:attemptId/timeline",
  authorize(...COLLEGE_ROLES),
  ctrl.getAttemptTimeline
);

/** College/Faculty: review / dismiss incident */
router.patch(
  "/incidents/:incidentId",
  authorize(...COLLEGE_ROLES),
  ctrl.reviewIncident
);

/** Student: log integrity event (alias of student-assessments integrity events) */
router.post("/events", authorize("student"), ctrl.postStudentEvent);

/** Student: webcam frame analyze → integrity events */
router.post("/analyze", authorize("student"), ctrl.analyzeFrame);

export default router;
