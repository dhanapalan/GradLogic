import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as ctrl from "../controllers/assessmentRule.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET  /api/assessment-rules
router.get(
    "/",
    authorize("super_admin", "hr", "engineer"),
    ctrl.list,
);

// POST /api/assessment-rules/seed-phase1 — Placement Preparation templates
router.post(
    "/seed-phase1",
    authorize("super_admin", "hr"),
    ctrl.seedPhase1,
);

// GET  /api/assessment-rules/:id
router.get(
    "/:id",
    authorize("super_admin", "hr", "engineer"),
    ctrl.getById,
);

// POST /api/assessment-rules
router.post(
    "/",
    authorize("super_admin", "hr", "engineer"),
    ctrl.create,
);

// PUT  /api/assessment-rules/:id
router.put(
    "/:id",
    authorize("super_admin", "hr", "engineer"),
    ctrl.update,
);

// POST /api/assessment-rules/:id/clone
router.post(
    "/:id/clone",
    authorize("super_admin", "hr", "engineer"),
    ctrl.clone,
);

// POST /api/assessment-rules/:id/archive
router.post(
    "/:id/archive",
    authorize("super_admin", "hr", "engineer"),
    ctrl.archive,
);

// GET  /api/assessment-rules/:id/versions
router.get(
    "/:id/versions",
    authorize("super_admin", "hr", "engineer"),
    ctrl.getVersions,
);

// POST /api/assessment-rules/:id/versions
router.post(
    "/:id/versions",
    authorize("super_admin", "hr", "engineer"),
    ctrl.createVersion,
);

export default router;
