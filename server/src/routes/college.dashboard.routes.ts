import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as collegeDashboardController from "../controllers/college.dashboard.controller.js";

const router = Router();

// College Portal dashboard — campus roles including Placement Cell + Faculty (Module 01)
router.use(
  authenticate,
  authorize("college_admin", "college", "college_staff", "placement_cell", "instructor")
);

router.get("/summary", collegeDashboardController.getSummary);
router.get("/charts", collegeDashboardController.getCharts);
router.get("/activities", collegeDashboardController.getActivities);
router.get("/pending-actions", collegeDashboardController.getPendingActions);
router.get("/filter-options", collegeDashboardController.getFilterOptions);

// Legacy endpoints (kept for Analytics / other consumers)
router.get("/drives", collegeDashboardController.getDrives);
router.get("/performance", collegeDashboardController.getPerformance);
router.get("/integrity", collegeDashboardController.getIntegrity);
router.get("/placement", collegeDashboardController.getPlacement);
router.get("/top-performers", collegeDashboardController.getTopPerformers);
router.get("/daily-target", collegeDashboardController.getDailyTarget);
router.put(
  "/daily-target",
  authorize("college_admin", "college", "college_staff"),
  collegeDashboardController.updateDailyTarget
);

export default router;
