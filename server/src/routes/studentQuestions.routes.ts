/** Module 07 — question bookmarks (student). */
import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/studentResultsAnalytics.controller.js";

const router = Router();
router.use(authenticate);
router.use(authorize("student"));

router.post("/:id/bookmark", ctrl.postBookmark);

export default router;
