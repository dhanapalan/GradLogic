// =============================================================================
// Question Collections — named, reusable groups of question_bank rows.
// Sits between Question Bank and Assessment Builder in the Assessment
// Engine workflow: build a collection once, reuse it across multiple drives.
// =============================================================================

import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { query, queryOne } from "../config/database.js";
import { PHASE1_COLLECTION_SEEDS } from "../shared/phase1PlacementDomains.js";

const router = Router();
const MANAGE_ROLES = ["super_admin", "hr", "instructor"] as const;

router.use(authenticate);

/**
 * GET /api/question-collections
 */
router.get("/", authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const { search, category } = req.query as Record<string, string>;
    const rows = await query(
      `SELECT c.*,
         (SELECT COUNT(*)::int FROM question_collection_items i WHERE i.collection_id = c.id) AS question_count
       FROM question_collections c
       WHERE ($1::text IS NULL OR c.name ILIKE '%' || $1 || '%' OR COALESCE(c.description, '') ILIKE '%' || $1 || '%')
         AND ($2::text IS NULL OR c.category = $2)
       ORDER BY
         CASE c.category
           WHEN 'aptitude' THEN 1
           WHEN 'reasoning' THEN 2
           WHEN 'python_coding' THEN 3
           WHEN 'java_coding' THEN 4
           WHEN 'data_science' THEN 5
           ELSE 99
         END,
         c.updated_at DESC`,
      [search || null, category || null]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/question-collections/seed-phase1
 * Idempotent shells for Placement Preparation Phase 1:
 * Aptitude / Logical Reasoning / Python / Java / AI Fundamentals.
 */
router.post("/seed-phase1", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    const userId = (req as any).user?.userId;
    const created: string[] = [];
    for (const seed of PHASE1_COLLECTION_SEEDS) {
      const existing = await queryOne<{ id: string }>(
        `SELECT id FROM question_collections WHERE category = $1 AND name = $2 LIMIT 1`,
        [seed.category, seed.name]
      );
      if (existing) continue;
      const row = await queryOne<{ id: string }>(
        `INSERT INTO question_collections (name, description, category, created_by)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [seed.name, seed.description, seed.category, userId || null]
      );
      if (row?.id) created.push(row.id);
    }
    res.json({ success: true, data: { created_count: created.length, created_ids: created } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/question-collections/:id
 */
router.get("/:id", authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const collection = await queryOne(
      "SELECT * FROM question_collections WHERE id = $1",
      [req.params.id]
    );
    if (!collection) return res.status(404).json({ success: false, error: "Collection not found" });

    const questions = await query(
      `SELECT q.*, i.sort_order
       FROM question_collection_items i
       JOIN question_bank q ON q.id = i.question_id
       WHERE i.collection_id = $1
       ORDER BY i.sort_order, i.added_at`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...collection, questions } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/question-collections
 */
router.post(
  "/",
  authorize(...MANAGE_ROLES),
  validate(
    z.object({
      name: z.string().min(3),
      description: z.string().optional(),
      category: z.string().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const userId = (req as any).user?.userId;
      const collection = await queryOne(
        `INSERT INTO question_collections (name, description, category, created_by)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.body.name, req.body.description || null, req.body.category || null, userId || null]
      );
      res.status(201).json({ success: true, data: collection });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /api/question-collections/:id
 */
router.put(
  "/:id",
  authorize(...MANAGE_ROLES),
  validate(
    z.object({
      name: z.string().min(3).optional(),
      description: z.string().optional(),
      category: z.string().optional(),
    })
  ),
  async (req, res, next) => {
    try {
      const collection = await queryOne(
        `UPDATE question_collections SET
           name = COALESCE($1, name),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           updated_at = NOW()
         WHERE id = $4 RETURNING *`,
        [req.body.name, req.body.description, req.body.category, req.params.id]
      );
      if (!collection) return res.status(404).json({ success: false, error: "Collection not found" });
      res.json({ success: true, data: collection });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/question-collections/:id
 */
router.delete("/:id", authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    const deleted = await queryOne<{ id: string }>(
      "DELETE FROM question_collections WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!deleted) return res.status(404).json({ success: false, error: "Collection not found" });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/question-collections/:id/fill-from-bank
 * Pull up to `limit` bank questions matching the collection category.
 */
router.post(
  "/:id/fill-from-bank",
  authorize(...MANAGE_ROLES),
  validate(z.object({ limit: z.number().int().min(1).max(200).optional() })),
  async (req, res, next) => {
    try {
      const collection = await queryOne<{ id: string; category: string | null }>(
        "SELECT id, category FROM question_collections WHERE id = $1",
        [req.params.id]
      );
      if (!collection) return res.status(404).json({ success: false, error: "Collection not found" });
      if (!collection.category) {
        return res.status(400).json({
          success: false,
          error: "Collection has no category — set a Phase-1 domain before filling from bank",
        });
      }

      const limit = req.body.limit ?? 40;
      const countRow = await queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM question_collection_items WHERE collection_id = $1",
        [req.params.id]
      );
      let sortOrder = Number(countRow?.count || 0);

      const candidates = await query<{ id: string }>(
        `SELECT q.id
         FROM question_bank q
         WHERE q.deleted_at IS NULL
           AND COALESCE(q.is_active, true) = true
           AND q.category = $1
           AND NOT EXISTS (
             SELECT 1 FROM question_collection_items i
             WHERE i.collection_id = $2 AND i.question_id = q.id
           )
         ORDER BY q.updated_at DESC
         LIMIT $3`,
        [collection.category, req.params.id, limit]
      );

      let added = 0;
      for (const row of candidates) {
        const inserted = await queryOne<{ question_id: string }>(
          `INSERT INTO question_collection_items (collection_id, question_id, sort_order)
           VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
           RETURNING question_id`,
          [req.params.id, row.id, sortOrder]
        );
        if (inserted) {
          sortOrder++;
          added++;
        }
      }
      await query("UPDATE question_collections SET updated_at = NOW() WHERE id = $1", [req.params.id]);
      res.status(201).json({
        success: true,
        data: { added, requested: limit, category: collection.category },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/question-collections/:id/questions
 * body: { question_ids: string[] }
 * References existing question_bank rows only — never duplicates question text.
 * Composite PK + ON CONFLICT skip already-linked ids.
 */
router.post(
  "/:id/questions",
  authorize(...MANAGE_ROLES),
  validate(z.object({ question_ids: z.array(z.string().uuid()).min(1).max(200) })),
  async (req, res, next) => {
    try {
      const collection = await queryOne<{ id: string }>(
        "SELECT id FROM question_collections WHERE id = $1",
        [req.params.id]
      );
      if (!collection) {
        return res.status(404).json({ success: false, error: "Collection not found" });
      }

      const countRow = await queryOne<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM question_collection_items WHERE collection_id = $1",
        [req.params.id]
      );
      let sortOrder = Number(countRow?.count || 0);
      let added = 0;
      let skipped = 0;
      let missing = 0;

      for (const questionId of req.body.question_ids as string[]) {
        const bankRow = await queryOne<{ id: string }>(
          `SELECT id FROM question_bank
           WHERE id = $1 AND deleted_at IS NULL AND COALESCE(is_active, true) = true`,
          [questionId]
        );
        if (!bankRow) {
          missing++;
          continue;
        }

        const inserted = await queryOne<{ question_id: string }>(
          `INSERT INTO question_collection_items (collection_id, question_id, sort_order)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING question_id`,
          [req.params.id, questionId, sortOrder]
        );
        if (inserted) {
          sortOrder++;
          added++;
        } else {
          skipped++;
        }
      }

      await query("UPDATE question_collections SET updated_at = NOW() WHERE id = $1", [
        req.params.id,
      ]);
      res.status(201).json({ success: true, data: { added, skipped, missing } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/question-collections/:id/questions/:questionId
 */
router.delete("/:id/questions/:questionId", authorize(...MANAGE_ROLES), async (req, res, next) => {
  try {
    await query(
      "DELETE FROM question_collection_items WHERE collection_id = $1 AND question_id = $2",
      [req.params.id, req.params.questionId]
    );
    await query("UPDATE question_collections SET updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
