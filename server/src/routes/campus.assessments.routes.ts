import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/campus.assessments.controller.js";

const router = Router();

const VIEW_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "placement_cell",
  "super_admin",
  "hr",
] as const;

const WRITE_ROLES = [
  "college_admin",
  "college",
  "college_staff",
  "instructor",
  "super_admin",
  "hr",
] as const;

const MANAGE_ROLES = ["college_admin", "college", "super_admin", "hr"] as const;

router.use(authenticate);

router.get("/meta", authorize(...VIEW_ROLES), ctrl.getMeta);
router.get("/", authorize(...VIEW_ROLES), ctrl.listAssessments);
router.post("/", authorize(...WRITE_ROLES), ctrl.createAssessment);

router.get("/:id", authorize(...VIEW_ROLES), ctrl.getAssessment);
router.put("/:id", authorize(...WRITE_ROLES), ctrl.updateAssessment);
router.post("/:id/duplicate", authorize(...WRITE_ROLES), ctrl.duplicateAssessment);
router.patch("/:id/publish", authorize(...WRITE_ROLES), ctrl.publishAssessment);
router.patch("/:id/archive", authorize(...WRITE_ROLES), ctrl.archiveAssessment);
router.delete("/:id", authorize(...MANAGE_ROLES), ctrl.softDeleteAssessment);

export default router;
