/**
 * Student Portal Module 07 — Results & Performance Analytics routes.
 * Student role only. Consume-only facade over evaluation + analytics engines.
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/studentResultsAnalytics.controller.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

router.get("/history", ctrl.getHistory);
router.get("/:attemptId/questions", ctrl.getAttemptQuestions);
router.get("/:attemptId", ctrl.getAttempt);

export default router;
