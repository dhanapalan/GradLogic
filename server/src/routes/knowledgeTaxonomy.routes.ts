import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import * as tax from "../services/knowledgeTaxonomy.service.js";

const router = Router();
const ADMIN = ["super_admin", "hr", "engineer"] as const;

router.use(authenticate);

router.get("/tree", authorize(...ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await tax.listTaxonomyTree() });
  } catch (err) {
    next(err);
  }
});

router.get("/categories", authorize(...ADMIN), async (_req, res, next) => {
  try {
    res.json({ success: true, data: await tax.listCategories() });
  } catch (err) {
    next(err);
  }
});

router.get("/subjects", authorize(...ADMIN), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await tax.listSubjects((req.query.category_id as string) || undefined),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/subjects",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      category_id: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      sort_order: z.number().int().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await tax.createSubject(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/subjects/:id",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      sort_order: z.number().int().optional(),
      is_active: z.boolean().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await tax.updateSubject(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/subjects/:id", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    await tax.softDeleteSubject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/topics", authorize(...ADMIN), async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: await tax.listTopics({
        subject_id: (req.query.subject_id as string) || undefined,
        category_id: (req.query.category_id as string) || undefined,
        search: (req.query.search as string) || undefined,
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/topics/promote-tags",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      subject_id: z.string().uuid(),
      tags: z.array(z.string().min(1)).min(1),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await tax.promoteTagsToTopics(req.body.subject_id, req.body.tags);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.get("/topics/:id", authorize(...ADMIN), async (req, res, next) => {
  try {
    const data = await tax.getTopicDetail(req.params.id);
    if (!data) {
      res.status(404).json({ success: false, message: "Topic not found" });
      return;
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/topics",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      subject_id: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional(),
      sort_order: z.number().int().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await tax.createTopic(req.body);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  "/topics/:id",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      sort_order: z.number().int().optional(),
      is_active: z.boolean().optional(),
      subject_id: z.string().uuid().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await tax.updateTopic(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

router.delete("/topics/:id", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    await tax.softDeleteTopic(req.params.id);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/assign",
  authorize("super_admin", "hr"),
  validate(
    z.object({
      asset_type: z.enum(["question", "flashcard", "content"]),
      asset_id: z.string().uuid(),
      topic_id: z.string().uuid().nullable(),
    })
  ),
  async (req, res, next) => {
    try {
      const data = await tax.assignAssetTopic(req.body);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
