import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import * as superadminController from "../controllers/superadmin.controller.js";
import usersRoutes from "./users.routes.js";
import rolesRoutes from "./roles.routes.js";
import auditTrailRoutes from "./auditTrail.routes.js";
import workflowsRoutes from "./workflows.routes.js";
import questionBankRoutes from "./questionBank.routes.js";
import superadminStudentsRoutes from "./superadminStudents.routes.js";
import platformModulesRoutes from "./platformModules.routes.js";
import * as modulesController from "../controllers/platformModules.controller.js";

const router = Router();

// ────────────────────────────────────────────────────────────────────
// PHASE 3: GLOBAL STUDENTS
// ────────────────────────────────────────────────────────────────────
router.use("/students", superadminStudentsRoutes);

// ────────────────────────────────────────────────────────────────────
// PLATFORM MODULES (multi-tenant feature system)
// ────────────────────────────────────────────────────────────────────
router.use("/modules", platformModulesRoutes);

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
  requirePermission("assessments_manage"),
  superadminController.bulkQuestionAction
);

// ────────────────────────────────────────────────────────────────────
// ANALYTICS ENDPOINTS
// ────────────────────────────────────────────────────────────────────
router.get(
  "/analytics/platform",
  authenticate,
  authorize("super_admin"),
  requirePermission("analytics_view"),
  superadminController.getAnalyticsPlatform
);

router.get(
  "/analytics/colleges",
  authenticate,
  authorize("super_admin"),
  requirePermission("analytics_view"),
  superadminController.getAnalyticsColleges
);

router.get(
  "/analytics/students",
  authenticate,
  authorize("super_admin"),
  requirePermission("analytics_view"),
  superadminController.getAnalyticsStudents
);

// ────────────────────────────────────────────────────────────────────
// AI USAGE MONITORING
// ────────────────────────────────────────────────────────────────────
router.get(
  "/ai-usage",
  authenticate,
  authorize("super_admin"),
  requirePermission("settings_view"),
  superadminController.getAIUsage
);

// ────────────────────────────────────────────────────────────────────
// AI SERVICES REGISTRY (key status)
// ────────────────────────────────────────────────────────────────────
router.get(
  "/ai-services",
  authenticate,
  authorize("super_admin"),
  requirePermission("settings_view"),
  superadminController.getAIServices
);

router.post(
  "/ai-services/:key/test",
  authenticate,
  authorize("super_admin"),
  requirePermission("settings_manage"),
  superadminController.testAIService
);

// ────────────────────────────────────────────────────────────────────
// BACKUP EXPORT
// ────────────────────────────────────────────────────────────────────
router.get(
  "/backup/export",
  authenticate,
  authorize("super_admin"),
  requirePermission("settings_manage"),
  superadminController.exportBackup
);

// ────────────────────────────────────────────────────────────────────
// BILLING SUMMARY
// ────────────────────────────────────────────────────────────────────
router.get(
  "/billing/summary",
  authenticate,
  authorize("super_admin"),
  requirePermission("billing_view"),
  superadminController.getBillingSummary
);

// ────────────────────────────────────────────────────────────────────
// SYSTEM SETTINGS
// ────────────────────────────────────────────────────────────────────
router.get(
  "/settings",
  authenticate,
  authorize("super_admin"),
  requirePermission("settings_view"),
  superadminController.getSystemSettings
);

router.put(
  "/settings",
  authenticate,
  authorize("super_admin"),
  requirePermission("settings_manage"),
  superadminController.updateSystemSettings
);

// ────────────────────────────────────────────────────────────────────
// METRICS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/metrics/platform",
  authenticate,
  authorize("super_admin"),
  requirePermission("dashboard_view"),
  superadminController.getPlatformMetrics
);

router.get(
  "/metrics/growth",
  authenticate,
  authorize("super_admin"),
  requirePermission("dashboard_view"),
  superadminController.getGrowthData
);

router.get(
  "/metrics/alerts",
  authenticate,
  authorize("super_admin"),
  requirePermission("dashboard_view"),
  superadminController.getSystemAlerts
);

router.get(
  "/metrics/live",
  authenticate,
  authorize("super_admin"),
  requirePermission("dashboard_view"),
  superadminController.getLiveDashboard
);

router.get(
  "/metrics/dashboard",
  authenticate,
  authorize("super_admin"),
  requirePermission("dashboard_view"),
  superadminController.getDashboard
);

// ────────────────────────────────────────────────────────────────────
// COLLEGES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/colleges",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_view"),
  superadminController.listColleges
);

router.post(
  "/colleges",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_manage"),
  superadminController.createCollege
);

// Pending college requests — must be declared before "/colleges/:id" so the
// literal path is not captured by the :id param.
router.get(
  "/colleges/requests",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_view"),
  superadminController.getPendingCollegeRequests
);

router.get(
  "/colleges/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_view"),
  superadminController.getCollege
);

router.get(
  "/colleges/:id/students",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_view"),
  superadminController.getCollegeStudents
);

router.get(
  "/colleges/:id/modules",
  authenticate,
  authorize("super_admin"),
  requirePermission("modules_view"),
  modulesController.getCollegeModules
);

router.put(
  "/colleges/:id/modules",
  authenticate,
  authorize("super_admin"),
  requirePermission("modules_manage"),
  modulesController.setCollegeModules
);

router.post(
  "/colleges/:id/modules/defaults",
  authenticate,
  authorize("super_admin"),
  requirePermission("modules_manage"),
  modulesController.applyCollegeModuleDefaults
);

router.put(
  "/colleges/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_manage"),
  superadminController.updateCollege
);

router.delete(
  "/colleges/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_manage"),
  superadminController.deleteCollege
);

router.get(
  "/colleges/requests/pending",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_view"),
  superadminController.getPendingCollegeRequests
);

router.post(
  "/colleges/:id/approve",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_manage"),
  superadminController.approveCollege
);

router.post(
  "/colleges/:id/reject",
  authenticate,
  authorize("super_admin"),
  requirePermission("colleges_manage"),
  superadminController.rejectCollege
);

// ────────────────────────────────────────────────────────────────────
// CATEGORIES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/categories",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_view"),
  superadminController.listCategories
);

router.post(
  "/categories",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_manage"),
  superadminController.createCategory
);

router.put(
  "/categories/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_manage"),
  superadminController.updateCategory
);

router.delete(
  "/categories/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_manage"),
  superadminController.deleteCategory
);

// ────────────────────────────────────────────────────────────────────
// REVIEW QUEUE ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/review-queue",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_view"),
  superadminController.getReviewQueue
);

router.post(
  "/review-queue/:id/approve",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_manage"),
  superadminController.approveAIQuestion
);

router.post(
  "/review-queue/:id/reject",
  authenticate,
  authorize("super_admin"),
  requirePermission("assessments_manage"),
  superadminController.rejectAIQuestion
);

// ────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/announcements",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_view"),
  superadminController.listAnnouncements
);

router.post(
  "/announcements",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_manage"),
  superadminController.createAnnouncement
);

router.post(
  "/announcements/:id/activate",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_manage"),
  superadminController.activateAnnouncement
);

router.delete(
  "/announcements/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_manage"),
  superadminController.deleteAnnouncement
);

// ────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

router.get(
  "/email-templates",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_view"),
  superadminController.listEmailTemplates
);

router.post(
  "/email-templates",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_manage"),
  superadminController.createEmailTemplate
);

router.put(
  "/email-templates/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_manage"),
  superadminController.updateEmailTemplate
);

router.delete(
  "/email-templates/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("notifications_manage"),
  superadminController.deleteEmailTemplate
);

export default router;
