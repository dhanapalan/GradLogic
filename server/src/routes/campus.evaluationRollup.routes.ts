import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/campus.evaluationRollup.controller.js";

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

router.use(authenticate);
router.get("/rollup", authorize(...VIEW_ROLES), ctrl.getRollup);

export default router;
