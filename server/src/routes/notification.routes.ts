import { Router } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import * as assessmentsCtrl from "../controllers/studentAssessmentsHub.controller.js";
import { authenticate, authorize } from "../middleware/auth.js";

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Module 05 — assessment-scoped notifications (before /:id)
router.get(
  "/assessments",
  authorize("student"),
  assessmentsCtrl.getAssessmentNotifications
);

// Get user notifications
router.get("/", notificationController.getUserNotifications);

// Mark all as read
router.put("/read-all", notificationController.markAllAsRead);

// Ops/testing: trigger the EOD digest immediately
router.post(
  "/run-digest",
  authorize("super_admin", "college_admin", "college"),
  notificationController.runDigestNowHandler
);

// Mark specific notification as read
router.put("/:id/read", notificationController.markAsRead);

export default router;
