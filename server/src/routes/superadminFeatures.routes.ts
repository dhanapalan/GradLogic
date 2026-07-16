import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as svc from "../services/superadminFeatures.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer"] as const;

router.use(authenticate);

// ── Knowledge library published views ────────────────────────────────────────

router.get("/flashcards", authorize(...ADMIN), async (req, res, next) => {
  try {
    const data = await svc.listFlashcards({
      category: (req.query.category as string) || undefined,
      search: (req.query.search as string) || undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/lessons", authorize(...ADMIN), async (req, res, next) => {
  try {
    const data = await svc.listPublishedLessons({
      voiceOnly: req.query.voice === "1" || req.query.voice === "true",
      search: (req.query.search as string) || undefined,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Content library (interview / case / resources) ───────────────────────────

router.get("/content-library", authorize(...ADMIN), async (req, res, next) => {
  try {
    const data = await svc.listContentLibrary({
      content_type: req.query.content_type as svc.ContentLibraryType | undefined,
      search: (req.query.search as string) || undefined,
      status: (req.query.status as string) || "published",
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/content-library",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      content_type: z.enum(["interview_question", "case_study", "learning_resource", "resource"]),
      title: z.string().min(1),
      body: z.string().optional(),
      category: z.string().optional(),
      difficulty: z.string().optional(),
      tags: z.array(z.string()).optional(),
      meta: z.record(z.unknown()).optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await svc.createContentLibraryItem({
        ...req.body,
        created_by: (req as any).user?.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/content-library/:id",
  authorize("super_admin", "hr"),
  async (req, res, next) => {
    try {
      const data = await svc.updateContentLibraryItem(req.params.id, req.body);
      if (!data) return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/content-library/:id", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    const data = await svc.archiveContentLibraryItem(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Learning journey templates ───────────────────────────────────────────────

router.get("/journey-templates", authorize(...ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.listLearningPaths() });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/journey-templates",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      target_role: z.string().optional(),
      duration_days: z.number().int().positive().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await svc.createLearningPath({
        ...req.body,
        created_by: (req as any).user?.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put("/journey-templates/:id", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    const data = await svc.updateLearningPath(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// ── Certificates ─────────────────────────────────────────────────────────────

router.get("/certificates", authorize(...ADMIN), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listCertificatesAdmin((req.query.search as string) || undefined),
    });
  } catch (err) {
    next(err);
  }
});

// ── Batches & enrollments ────────────────────────────────────────────────────

router.get("/batches", authorize(...ADMIN), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listBatches((req.query.college_id as string) || undefined),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/batches",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      college_id: z.string().uuid(),
      name: z.string().min(1),
      academic_year: z.string().optional(),
      program_label: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await svc.createBatch({
        ...req.body,
        created_by: (req as any).user?.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put("/batches/:id", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    const data = await svc.updateBatch(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/enrollments", authorize(...ADMIN), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listBatchEnrollments(
        (req.query.batch_id as string) || undefined,
        (req.query.search as string) || undefined
      ),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/enrollments",
  authorize("super_admin", "hr"),
  validate(z.object({ batch_id: z.string().uuid(), student_id: z.string().uuid() })),
  async (req, res, next) => {
    try {
      const data = await svc.enrollStudentInBatch(req.body.batch_id, req.body.student_id);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  "/enrollments/:id",
  authorize("super_admin", "hr"),
  validate(z.object({ status: z.enum(["active", "withdrawn", "completed"]) })),
  async (req, res, next) => {
    try {
      const data = await svc.setEnrollmentStatus(req.params.id, req.body.status);
      if (!data) return res.status(404).json({ success: false, error: "Not found" });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

// ── Analytics helpers ────────────────────────────────────────────────────────

router.get("/analytics/learning", authorize(...ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getLearningAnalytics() });
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/courses", authorize(...ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getCourseAnalytics() });
  } catch (err) {
    next(err);
  }
});

router.get("/analytics/voice", authorize(...ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getVoiceAnalytics() });
  } catch (err) {
    next(err);
  }
});

export default router;
