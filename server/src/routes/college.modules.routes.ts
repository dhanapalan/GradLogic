import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as modulesController from "../controllers/platformModules.controller.js";

const router = Router();

router.use(authenticate);

router.get(
  "/enabled",
  authorize("college_admin", "college", "college_staff"),
  modulesController.getCollegePortalFeatures
);

export default router;
