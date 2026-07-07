import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as collegeDashboardController from "../controllers/college.dashboard.controller.js";

const router = Router();

// Apply auth to all dashboard routes
router.use(authenticate, authorize("college_admin", "college", "college_staff"));

router.get("/summary", collegeDashboardController.getSummary);
router.get("/drives", collegeDashboardController.getDrives);
router.get("/performance", collegeDashboardController.getPerformance);
router.get("/integrity", collegeDashboardController.getIntegrity);
router.get("/placement", collegeDashboardController.getPlacement);
router.get("/top-performers", collegeDashboardController.getTopPerformers);
router.get("/daily-target", collegeDashboardController.getDailyTarget);
router.put("/daily-target", collegeDashboardController.updateDailyTarget);

export default router;
