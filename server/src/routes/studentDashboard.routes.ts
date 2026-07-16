/**
 * Student Portal Module 02 — dashboard facade routes.
 * Module 04 — My Learning Hub routes mounted on /api/learning + calendar.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/studentDashboard.controller.js";
import * as learningCtrl from "../controllers/studentLearningHub.controller.js";
import * as assessmentsCtrl from "../controllers/studentAssessmentsHub.controller.js";

const studentOnly = [authenticate, authorize("student")] as const;

/** GET /api/dashboard/student */
export const dashboardRouter = Router();
dashboardRouter.get("/student", ...studentOnly, ctrl.getDashboard);

/**
 * /api/assessments/*
 * Module 02: GET /upcoming (widget), /recent-results
 * Module 05: dashboard, tabs, detail, launch/resume
 */
export const assessmentsDashboardRouter = Router();

/** Module 02 widget — unchanged unless paginated Module 05 list is requested. */
assessmentsDashboardRouter.get(
  "/upcoming",
  ...studentOnly,
  (req: Request, res: Response, next: NextFunction) => {
    if (req.query.page != null || req.query.paginated === "1") {
      return assessmentsCtrl.getUpcomingList(req, res, next);
    }
    return ctrl.getUpcomingAssessments(req, res, next);
  }
);
assessmentsDashboardRouter.get("/recent-results", ...studentOnly, ctrl.getRecentResults);

// Module 05 static routes (before :assessmentId)
assessmentsDashboardRouter.get("/dashboard", ...studentOnly, assessmentsCtrl.getDashboard);
assessmentsDashboardRouter.get("/assigned", ...studentOnly, assessmentsCtrl.getAssigned);
assessmentsDashboardRouter.get("/live", ...studentOnly, assessmentsCtrl.getLive);
assessmentsDashboardRouter.get("/in-progress", ...studentOnly, assessmentsCtrl.getInProgress);
assessmentsDashboardRouter.get("/completed", ...studentOnly, assessmentsCtrl.getCompleted);
assessmentsDashboardRouter.get("/missed", ...studentOnly, assessmentsCtrl.getMissed);
assessmentsDashboardRouter.get("/practice", ...studentOnly, assessmentsCtrl.getPractice);
assessmentsDashboardRouter.get(
  "/:assessmentId/attempts",
  ...studentOnly,
  assessmentsCtrl.getAttempts
);
assessmentsDashboardRouter.post(
  "/:assessmentId/launch",
  ...studentOnly,
  assessmentsCtrl.postLaunch
);
assessmentsDashboardRouter.post(
  "/:assessmentId/resume",
  ...studentOnly,
  assessmentsCtrl.postResume
);
assessmentsDashboardRouter.get("/:assessmentId", ...studentOnly, assessmentsCtrl.getAssessment);

/**
 * /api/learning/*
 * Module 02: GET /assigned
 * Module 04: dashboard, summary, paths, courses, lessons, progress, etc.
 */
export const learningDashboardRouter = Router();
learningDashboardRouter.get("/assigned", ...studentOnly, ctrl.getAssignedLearning);
learningDashboardRouter.get("/dashboard", ...studentOnly, learningCtrl.getDashboard);
learningDashboardRouter.get("/summary", ...studentOnly, learningCtrl.getSummary);
learningDashboardRouter.get("/paths", ...studentOnly, learningCtrl.getPaths);
learningDashboardRouter.get("/paths/:id", ...studentOnly, learningCtrl.getPath);
learningDashboardRouter.get("/courses", ...studentOnly, learningCtrl.getCourses);
learningDashboardRouter.get("/courses/:id", ...studentOnly, learningCtrl.getCourse);
learningDashboardRouter.get("/lessons/:id", ...studentOnly, learningCtrl.getLesson);
learningDashboardRouter.post("/lessons/:id/progress", ...studentOnly, learningCtrl.postLessonProgress);
learningDashboardRouter.get("/progress", ...studentOnly, learningCtrl.getProgress);
learningDashboardRouter.get("/resources", ...studentOnly, learningCtrl.getResources);
learningDashboardRouter.get("/assignments", ...studentOnly, learningCtrl.getAssignments);
learningDashboardRouter.get("/assessments", ...studentOnly, learningCtrl.getAssessments);
learningDashboardRouter.get("/certificates", ...studentOnly, learningCtrl.getCertificates);
learningDashboardRouter.get("/bookmarks", ...studentOnly, learningCtrl.getBookmarks);
learningDashboardRouter.post("/bookmarks", ...studentOnly, learningCtrl.postBookmark);
learningDashboardRouter.delete("/bookmarks/:id", ...studentOnly, learningCtrl.deleteBookmark);
learningDashboardRouter.get("/recommendations", ...studentOnly, learningCtrl.getRecommendations);

/** GET /api/recommendations */
export const recommendationsRouter = Router();
recommendationsRouter.get("/", ...studentOnly, ctrl.getRecommendations);

/** GET /api/campus-drives/eligible · POST /api/campus-drives/:driveId/apply */
export const campusDrivesStudentRouter = Router();
campusDrivesStudentRouter.get("/eligible", ...studentOnly, ctrl.getEligibleCampusDrives);
campusDrivesStudentRouter.post("/:driveId/apply", ...studentOnly, ctrl.applyCampusDrive);

/** GET /api/achievements */
export const achievementsRouter = Router();
achievementsRouter.get("/", ...studentOnly, ctrl.getAchievements);

/** GET /api/calendar/events · learning-events · assessments */
export const calendarRouter = Router();
calendarRouter.get("/events", ...studentOnly, ctrl.getCalendarEvents);
calendarRouter.get("/learning-events", ...studentOnly, learningCtrl.getLearningEvents);
calendarRouter.get("/assessments", ...studentOnly, assessmentsCtrl.getCalendarAssessments);

