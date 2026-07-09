import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import * as auditController from "../controllers/auditTrail.controller.js";

const router = Router();

/**
 * List audit logs with filtering
 * GET /api/superadmin/audit-trail?page=1&limit=50&action=LOGIN&from_date=2026-01-01
 */
router.get(
  "/",
  authenticate,
  authorize("super_admin"),
  requirePermission("audit_view"),
  auditController.listAuditTrail
);

/**
 * Get audit statistics
 * GET /api/superadmin/audit-trail/stats?days=30
 */
router.get(
  "/stats",
  authenticate,
  authorize("super_admin"),
  requirePermission("audit_view"),
  auditController.getAuditStats
);

/**
 * Get single audit entry details
 * GET /api/superadmin/audit-trail/:id
 */
router.get(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("audit_view"),
  auditController.getAuditEntry
);

/**
 * Export audit logs
 * POST /api/superadmin/audit-trail/export
 * Body: { format: "csv|json", from_date, to_date, action }
 */
router.post(
  "/export",
  authenticate,
  authorize("super_admin"),
  requirePermission("audit_export"),
  auditController.exportAuditLogs
);

export default router;
