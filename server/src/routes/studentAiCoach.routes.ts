/**
 * Student Portal Module 08 — AI Learning Coach routes.
 * Student role only. Consume-only facade over LI + adaptive + AI stream.
 */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/studentAiCoach.controller.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

router.get("/dashboard", ctrl.getDashboard);
router.get("/recommendations", ctrl.getRecommendations);
router.get("/study-plan", ctrl.getStudyPlan);
router.get("/learning-path", ctrl.getLearningPath);
router.get("/practice-recommendations", ctrl.getPracticeRecommendations);
router.get("/weak-areas", ctrl.getWeakAreas);
router.get("/progress", ctrl.getProgress);
router.get("/explain-result", ctrl.getExplainResultContext);

router.post("/generate-study-plan", ctrl.postGenerateStudyPlan);
router.post("/chat", ctrl.postChat);
router.post("/explain-result", ctrl.postExplainResult);
router.post("/explain-question", ctrl.postExplainQuestion);

export default router;
