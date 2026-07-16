import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as svc from "../services/courseBuilder.service.js";
import * as aiSvc from "../services/courseBuilderAi.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer", "instructor"] as const;

router.use(authenticate);
router.use(authorize(...ADMIN));

router.get("/dashboard", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getDashboardSummary() });
  } catch (err) {
    next(err);
  }
});

router.get("/modules/:moduleId/assets", async (req, res, next) => {
  try {
    res.json({ success: true, data: await svc.listModuleAssets(req.params.moduleId) });
  } catch (err) {
    next(err);
  }
});

router.get("/courses/:courseId/assets", async (req, res, next) => {
  try {
    res.json({ success: true, data: await svc.listCourseAssets(req.params.courseId) });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/modules/:moduleId/assets",
  validate(
    z.object({
      asset_type: z.enum([
        "question",
        "coding_challenge",
        "flashcard",
        "content",
        "lesson",
        "voice_lesson",
      ]),
      asset_id: z.string().uuid(),
      role: z.enum(["lesson", "practice", "coding", "assessment", "resource", "voice"]),
      sort_order: z.number().int().optional(),
      meta: z.record(z.unknown()).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const row = await svc.attachModuleAsset({
        moduleId: req.params.moduleId,
        assetType: req.body.asset_type,
        assetId: req.body.asset_id,
        role: req.body.role,
        sortOrder: req.body.sort_order,
        meta: req.body.meta,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/assets/:id", async (req, res, next) => {
  try {
    await svc.detachModuleAsset(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.patch(
  "/assets/:id/meta",
  validate(z.object({ meta: z.record(z.unknown()) })),
  async (req, res, next) => {
    try {
      const row = await svc.updateAssetMeta(req.params.id, req.body.meta);
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/courses/:courseId/assessment-config", async (req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getAssessmentConfig(req.params.courseId) });
  } catch (err) {
    next(err);
  }
});

router.put(
  "/courses/:courseId/assessment-config",
  validate(
    z.object({
      passing_percent: z.number().min(1).max(100).optional(),
      attempts: z.number().int().min(1).optional(),
      min_practice_per_module: z.number().int().min(0).optional(),
      require_assessment: z.boolean().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await svc.updateAssessmentConfig(req.params.courseId, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/courses/:courseId/validate", async (req, res, next) => {
  try {
    res.json({ success: true, data: await svc.validateCourse(req.params.courseId) });
  } catch (err) {
    next(err);
  }
});

router.post("/courses/:courseId/publish", async (req, res, next) => {
  try {
    const data = await svc.publishCourse(req.params.courseId);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const e = err as { status?: number; validation?: unknown; message?: string };
    if (e.status === 400 && e.validation) {
      res.status(400).json({
        success: false,
        error: e.message || "Validation failed",
        data: e.validation,
      });
      return;
    }
    next(err);
  }
});

router.post(
  "/ai/outline",
  validate(
    z.object({
      prompt: z.string().min(8).max(2000),
      category: z
        .enum(["aptitude", "reasoning", "python_coding", "java_coding", "data_science"])
        .optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await aiSvc.generateCourseOutline({
        prompt: req.body.prompt,
        category: req.body.category,
        difficulty: req.body.difficulty,
        userId: req.user?.userId || null,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/ai/commit",
  validate(z.object({ outline: z.record(z.unknown()) })),
  async (req, res, next) => {
    try {
      const outline = aiSvc.courseOutlineSchema.parse(req.body.outline);
      const data = await aiSvc.commitCourseOutline({
        outline,
        userId: req.user!.userId,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/templates", async (_req, res, next) => {
  try {
    res.json({ success: true, data: aiSvc.listPhase1Templates() });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/templates/:templateId/create",
  validate(
    z.object({
      title: z.string().min(1).max(200).optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await aiSvc.instantiateTemplate({
        templateId: req.params.templateId,
        userId: req.user!.userId,
        title: req.body.title,
        difficulty: req.body.difficulty,
      });
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/analytics", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getAnalytics() });
  } catch (err) {
    next(err);
  }
});

export default router;
