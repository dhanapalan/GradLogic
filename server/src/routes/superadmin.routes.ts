import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as superadminController from "../controllers/superadmin.controller.js";
import usersRoutes from "./users.routes.js";
import rolesRoutes from "./roles.routes.js";
import auditTrailRoutes from "./auditTrail.routes.js";
import workflowsRoutes from "./workflows.routes.js";
import questionBankRoutes from "./questionBank.routes.js";
import superadminStudentsRoutes from "./superadminStudents.routes.js";

const router = Router();

// ────────────────────────────────────────────────────────────────────
// PHASE 3: GLOBAL STUDENTS
// ────────────────────────────────────────────────────────────────────
router.use("/students", superadminStudentsRoutes);

// ────────────────────────────────────────────────────────────────────
// PHASE 2: USERS MANAGEMENT
// ────────────────────────────────────────────────────────────────────
router.use("/users", usersRoutes);

// ────────────────────────────────────────────────────────────────────
// PHASE 2: ROLES MANAGEMENT
// ────────────────────────────────────────────────────────────────────
router.use("/roles", rolesRoutes);

// ────────────────────────────────────────────────────────────────────
// PHASE 2: AUDIT TRAIL
// ────────────────────────────────────────────────────────────────────
router.use("/audit-trail", auditTrailRoutes);

// ────────────────────────────────────────────────────────────────────
// PHASE 2: WORKFLOWS
// ────────────────────────────────────────────────────────────────────
router.use("/workflows", workflowsRoutes);

// ────────────────────────────────────────────────────────────────────
// QUESTION BANK (reuse the global question-bank router)
// ────────────────────────────────────────────────────────────────────
router.use("/question-bank", questionBankRoutes);

// Superadmin-only bulk actions — declared after the shared router above so
// generic /question-bank/:id routes there don't shadow this literal path.
router.post(
  "/question-bank/bulk-action",
  authenticate,
  authorize("super_admin"),
  superadminController.bulkQuestionAction
);

// ────────────────────────────────────────────────────────────────────
// ANALYTICS ENDPOINTS
// ────────────────────────────────────────────────────────────────────
router.get(
  "/analytics/platform",
  authenticate,
  authorize("super_admin"),
  superadminController.getAnalyticsPlatform
);

router.get(
  "/analytics/colleges",
  authenticate,
  authorize("super_admin"),
  superadminController.getAnalyticsColleges
);

router.get(
  "/analytics/students",
  authenticate,
  authorize("super_admin"),
  superadminController.getAnalyticsStudents
);

// ────────────────────────────────────────────────────────────────────
// AI USAGE MONITORING
// ────────────────────────────────────────────────────────────────────
router.get(
  "/ai-usage",
  authenticate,
  authorize("super_admin"),
  superadminController.getAIUsage
);

// ────────────────────────────────────────────────────────────────────
// AI SERVICES REGISTRY (key status)
// ────────────────────────────────────────────────────────────────────
router.get(
  "/ai-services",
  authenticate,
  authorize("super_admin"),
  superadminController.getAIServices
);

router.post(
  "/ai-services/:key/test",
  authenticate,
  authorize("super_admin"),
  superadminController.testAIService
);

// ────────────────────────────────────────────────────────────────────
// BACKUP EXPORT
// ────────────────────────────────────────────────────────────────────
router.get(
  "/backup/export",
  authenticate,
  authorize("super_admin"),
  superadminController.exportBackup
);

// ────────────────────────────────────────────────────────────────────
// BILLING SUMMARY
// ────────────────────────────────────────────────────────────────────
router.get(
  "/billing/summary",
  authenticate,
  authorize("super_admin"),
  superadminController.getBillingSummary
);

// ────────────────────────────────────────────────────────────────────
// SYSTEM SETTINGS
// ────────────────────────────────────────────────────────────────────
router.get(
  "/settings",
  authenticate,
  authorize("super_admin"),
  superadminController.getSystemSettings
);

router.put(
  "/settings",
  authenticate,
  authorize("super_admin"),
  superadminController.updateSystemSettings
);

// ────────────────────────────────────────────────────────────────────
// METRICS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/metrics/platform",
  authenticate,
  authorize("super_admin"),
  superadminController.getPlatformMetrics
);

router.get(
  "/metrics/growth",
  authenticate,
  authorize("super_admin"),
  superadminController.getGrowthData
);

router.get(
  "/metrics/alerts",
  authenticate,
  authorize("super_admin"),
  superadminController.getSystemAlerts
);

router.get(
  "/metrics/live",
  authenticate,
  authorize("super_admin"),
  superadminController.getLiveDashboard
);

router.get(
  "/metrics/dashboard",
  authenticate,
  authorize("super_admin"),
  superadminController.getDashboard
);

// ────────────────────────────────────────────────────────────────────
// COLLEGES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/colleges",
  authenticate,
  authorize("super_admin"),
  superadminController.listColleges
);

router.post(
  "/colleges",
  authenticate,
  authorize("super_admin"),
  superadminController.createCollege
);

// Pending college requests — must be declared before "/colleges/:id" so the
// literal path is not captured by the :id param.
router.get(
  "/colleges/requests",
  authenticate,
  authorize("super_admin"),
  superadminController.getPendingCollegeRequests
);

router.get(
  "/colleges/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.getCollege
);

router.get(
  "/colleges/:id/students",
  authenticate,
  authorize("super_admin"),
  superadminController.getCollegeStudents
);

router.put(
  "/colleges/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.updateCollege
);

router.delete(
  "/colleges/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.deleteCollege
);

router.get(
  "/colleges/requests/pending",
  authenticate,
  authorize("super_admin"),
  superadminController.getPendingCollegeRequests
);

router.post(
  "/colleges/:id/approve",
  authenticate,
  authorize("super_admin"),
  superadminController.approveCollege
);

router.post(
  "/colleges/:id/reject",
  authenticate,
  authorize("super_admin"),
  superadminController.rejectCollege
);

// ────────────────────────────────────────────────────────────────────
// CATEGORIES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/categories",
  authenticate,
  authorize("super_admin"),
  superadminController.listCategories
);

router.post(
  "/categories",
  authenticate,
  authorize("super_admin"),
  superadminController.createCategory
);

router.put(
  "/categories/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.updateCategory
);

router.delete(
  "/categories/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.deleteCategory
);

// ────────────────────────────────────────────────────────────────────
// REVIEW QUEUE ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/review-queue",
  authenticate,
  authorize("super_admin"),
  superadminController.getReviewQueue
);

router.post(
  "/review-queue/:id/approve",
  authenticate,
  authorize("super_admin"),
  superadminController.approveAIQuestion
);

router.post(
  "/review-queue/:id/reject",
  authenticate,
  authorize("super_admin"),
  superadminController.rejectAIQuestion
);

// ────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/announcements",
  authenticate,
  authorize("super_admin"),
  superadminController.listAnnouncements
);

router.post(
  "/announcements",
  authenticate,
  authorize("super_admin"),
  superadminController.createAnnouncement
);

router.post(
  "/announcements/:id/activate",
  authenticate,
  authorize("super_admin"),
  superadminController.activateAnnouncement
);

router.delete(
  "/announcements/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.deleteAnnouncement
);

// ────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/email-templates",
  authenticate,
  authorize("super_admin"),
  superadminController.listEmailTemplates
);

router.post(
  "/email-templates",
  authenticate,
  authorize("super_admin"),
  superadminController.createEmailTemplate
);

router.put(
  "/email-templates/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.updateEmailTemplate
);

router.delete(
  "/email-templates/:id",
  authenticate,
  authorize("super_admin"),
  superadminController.deleteEmailTemplate
);

export default router;
