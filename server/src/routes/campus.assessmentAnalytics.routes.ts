import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/campus.assessmentAnalytics.controller.js";

const router = Router();

/** Org/College admin, faculty, placement officer — not students. */
const VIEW_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "placement_cell",
  "super_admin",
  "hr",
] as const;

router.use(authenticate);

router.get("/meta", authorize(...VIEW_ROLES), ctrl.getMeta);
router.get("/summary", authorize(...VIEW_ROLES), ctrl.getDashboard);
router.get("/assessments", authorize(...VIEW_ROLES), ctrl.getAssessments);
router.get("/students", authorize(...VIEW_ROLES), ctrl.getStudents);
router.get("/departments", authorize(...VIEW_ROLES), ctrl.getDepartments);
router.get("/export", authorize(...VIEW_ROLES), ctrl.exportReport);

export default router;
