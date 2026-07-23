import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/campus.departments.controller.js";

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

/** Admin-only: departments define the shared list every student/faculty form draws from. */
const MANAGE_ROLES = ["college_admin", "college", "super_admin", "hr"] as const;

router.use(authenticate);

router.get("/", authorize(...VIEW_ROLES), ctrl.listDepartments);
router.post("/", authorize(...MANAGE_ROLES), ctrl.createDepartment);
router.put("/:id", authorize(...MANAGE_ROLES), ctrl.updateDepartment);

export default router;
