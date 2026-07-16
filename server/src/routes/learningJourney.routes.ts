import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as svc from "../services/learningJourney.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer", "instructor"] as const;

router.use(authenticate);
router.use(authorize(...ADMIN));

router.get("/dashboard", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getJourneyDashboard() });
  } catch (err) {
    next(err);
  }
});

router.get("/templates", async (req, res, next) => {
  try {
    const data = await svc.listJourneyTemplates({
      domain: (req.query.domain as string) || undefined,
      status: (req.query.status as string) || undefined,
      search: (req.query.search as string) || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/templates/seed-phase1", async (req, res, next) => {
  try {
    const data = await svc.seedPhase1Templates(req.user?.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
