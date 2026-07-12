import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { createStudentSchema, updateStudentSchema } from "../validators/student.schemas.js";
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
  "/",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_manage"),
  validate(createStudentSchema),
  superadminStudentsController.createStudent
);

router.post(
  "/bulk-import",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_manage"),
  superadminStudentsController.bulkImport
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

router.put(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_manage"),
  validate(updateStudentSchema),
  superadminStudentsController.updateStudent
);

router.delete(
  "/:id",
  authenticate,
  authorize("super_admin"),
  requirePermission("students_manage"),
  superadminStudentsController.softDeleteStudent
);

export default router;
