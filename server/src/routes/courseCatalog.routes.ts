import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import * as svc from "../services/courseCatalog.service.js";
import { generateCatalogInsights } from "../services/courseCatalogAi.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer", "instructor"] as const;

router.use(authenticate);
router.use(authorize(...ADMIN));

router.get("/dashboard", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getCatalogDashboard() });
  } catch (err) {
    next(err);
  }
});

router.get("/tracks", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.listPlacementTracks() });
  } catch (err) {
    next(err);
  }
});

router.get("/tracks/:slug", async (req, res, next) => {
  try {
    const data = await svc.getPlacementTrack(req.params.slug);
    if (!data) {
      res.status(404).json({ success: false, error: "Track not found" });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/courses", async (req, res, next) => {
  try {
    const data = await svc.listCatalogCourses({
      status: (req.query.status as string) || undefined,
      category: (req.query.category as string) || undefined,
      search: (req.query.search as string) || undefined,
      difficulty: (req.query.difficulty as string) || undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/courses/:id/preview", async (req, res, next) => {
  try {
    const data = await svc.getCoursePreview(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, error: "Course not found" });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post("/courses/:id/ai-insights", async (req, res, next) => {
  try {
    const data = await generateCatalogInsights(req.params.id, req.user?.userId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
