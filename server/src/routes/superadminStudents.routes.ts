import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as superadminStudentsController from "../controllers/superadminStudents.controller.js";

const router = Router();

router.get(
  "/",
  authenticate,
  authorize("super_admin"),
  superadminStudentsController.listStudents
);

router.post(
  "/bulk-action",
  authenticate,
  authorize("super_admin"),
  superadminStudentsController.bulkAction
);

router.get(
  "/:id",
  authenticate,
  authorize("super_admin"),
  superadminStudentsController.getStudentProfile
);

export default router;
