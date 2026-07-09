import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import * as superadminStudentsController from "../controllers/superadminStudents.controller.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_view"),
  superadminStudentsController.listStudents
);

router.post(
  "/bulk-action",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_manage"),
  superadminStudentsController.bulkAction
);

router.get(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_view"),
  superadminStudentsController.getStudentProfile
);

export default router;
