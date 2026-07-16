import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as svc from "../services/knowledgeLibraryEnterprise.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer"] as const;

router.use(authenticate);
router.use(authorize(...ADMIN));

router.get("/summary", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await svc.getEnterpriseSummary() });
  } catch (err) {
    next(err);
  }
});

router.get("/archive/questions", async (req, res, next) => {
  try {
    const data = await svc.listArchivedQuestions(
      Number(req.query.limit) || 100,
      (req.query.search as string) || undefined
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/archive/deleted", async (req, res, next) => {
  try {
    const data = await svc.listSoftDeletedQuestions(
      Number(req.query.limit) || 100,
      (req.query.search as string) || undefined
    );
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/archive/content", async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await svc.listArchivedContent(Number(req.query.limit) || 100),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/restore",
  validate(
    z.object({
      questionIds: z.array(z.string().uuid()).min(1),
      mode: z.enum(["unarchive", "undelete"]).optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const rows = await svc.restoreQuestions(req.body.questionIds, req.body.mode || "unarchive");
      res.json({ success: true, data: { restored: rows.length } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/restore-content",
  validate(z.object({ ids: z.array(z.string().uuid()).min(1) })),
  async (req, res, next) => {
    try {
      const rows = await svc.restoreContentItems(req.body.ids);
      res.json({ success: true, data: { restored: rows.length } });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  "/bulk-assign-topic",
  validate(
    z.object({
      asset_type: z.enum(["question", "flashcard", "content"]),
      asset_ids: z.array(z.string().uuid()).min(1),
      topic_id: z.string().uuid().nullable(),
    })
  ),
  async (req, res, next) => {
    try {
      const rows = await svc.bulkAssignTopic(req.body);
      res.json({ success: true, data: { updated: rows.length } });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/versions", async (req, res, next) => {
  try {
    const data = await svc.listRecentVersions({
      status: (req.query.status as string) || undefined,
      limit: Number(req.query.limit) || 50,
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/export/questions.csv", async (req, res, next) => {
  try {
    const { csv, count } = await svc.exportQuestions({
      category: (req.query.category as string) || undefined,
      status: (req.query.status as string) || undefined,
      type: (req.query.type as string) || undefined,
      search: (req.query.search as string) || undefined,
      limit: Number(req.query.limit) || 2000,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="knowledge-export-${count}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

export default router;
