import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { query, queryOne, pool } from "../config/database.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();
router.use(authenticate);

// ── GET /my-enrollments — list all programs the student is enrolled in ────────
router.get("/my-enrollments", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await query(`
      SELECT
        spe.id            AS enrollment_id,
        spe.program_id,
        spe.enrolled_at,
        spe.completed_at,
        spe.status,
        sp.name           AS program_name,
        sp.description    AS program_description,
        sp.program_type,
        sp.duration_days,
        sp.banner_url,
        -- total modules in program
        COUNT(DISTINCT pm.module_id)::int                                       AS total_modules,
        -- modules student has completed
        COUNT(DISTINCT smp.module_id) FILTER (WHERE smp.status = 'completed')::int AS completed_modules,
        -- avg score across completed modules
        ROUND(AVG(smp.score) FILTER (WHERE smp.score IS NOT NULL))::int         AS avg_score
      FROM student_program_enrollments spe
      JOIN skill_programs sp ON sp.id = spe.program_id
      LEFT JOIN program_modules pm ON pm.program_id = sp.id
      LEFT JOIN student_module_progress smp ON smp.enrollment_id = spe.id AND smp.module_id = pm.module_id
      WHERE spe.student_id = $1
      GROUP BY spe.id, sp.id
      ORDER BY spe.enrolled_at DESC
    `, [userId]);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /my-enrollments/:programId/modules — modules with student progress ────
router.get("/my-enrollments/:programId/modules", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { programId } = req.params;

    // Verify enrolled
    const enrollment = await queryOne(
      `SELECT id FROM student_program_enrollments WHERE student_id = $1 AND program_id = $2`,
      [userId, programId]
    );
    if (!enrollment) return res.status(403).json({ success: false, error: "Not enrolled in this program" });

    const modules = await query(`
      SELECT
        lm.id,
        lm.title,
        lm.description,
        lm.module_type,
        lm.duration_minutes,
        lm.content_url,
        lm.difficulty_level,
        lm.passing_score,
        pm.order_index,
        pm.is_mandatory,
        smp.status        AS progress_status,
        smp.score         AS progress_score,
        smp.started_at,
        smp.completed_at,
        smp.attempts
      FROM program_modules pm
      JOIN learning_modules lm ON lm.id = pm.module_id
      LEFT JOIN student_module_progress smp
        ON smp.module_id = lm.id AND smp.student_id = $1 AND smp.program_id = $2
      WHERE pm.program_id = $2
      ORDER BY pm.order_index
    `, [userId, programId]);

    res.json({ success: true, data: modules });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /my-enrollments/:programId/modules/:moduleId/start ──────────────────
router.post("/my-enrollments/:programId/modules/:moduleId/start", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { programId, moduleId } = req.params;

    const enrollment = await queryOne(
      `SELECT id FROM student_program_enrollments WHERE student_id = $1 AND program_id = $2`,
      [userId, programId]
    );
    if (!enrollment) return res.status(403).json({ success: false, error: "Not enrolled" });

    // Upsert progress row
    await pool.query(`
      INSERT INTO student_module_progress (id, student_id, module_id, program_id, status, started_at, attempts)
      VALUES ($1, $2, $3, $4, 'in_progress', NOW(), 1)
      ON CONFLICT (student_id, module_id, program_id)
      DO UPDATE SET
        status     = CASE WHEN student_module_progress.status = 'completed' THEN 'completed' ELSE 'in_progress' END,
        started_at = COALESCE(student_module_progress.started_at, NOW()),
        attempts   = student_module_progress.attempts + 1
    `, [uuidv4(), userId, moduleId, programId]);

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── POST /my-enrollments/:programId/modules/:moduleId/complete ───────────────
const completeSchema = z.object({ score: z.number().min(0).max(100).optional() });

router.post(
  "/my-enrollments/:programId/modules/:moduleId/complete",
  validate(completeSchema),
  async (req, res) => {
    try {
      const userId = req.user!.userId;
      const { programId, moduleId } = req.params;
      const { score } = req.body;

      const enrollment = await queryOne(
        `SELECT id FROM student_program_enrollments WHERE student_id = $1 AND program_id = $2`,
        [userId, programId]
      );
      if (!enrollment) return res.status(403).json({ success: false, error: "Not enrolled" });

      await pool.query(`
        INSERT INTO student_module_progress (id, student_id, module_id, program_id, status, score, started_at, completed_at, attempts)
        VALUES ($1, $2, $3, $4, 'completed', $5, NOW(), NOW(), 1)
        ON CONFLICT (student_id, module_id, program_id)
        DO UPDATE SET
          status       = 'completed',
          score        = EXCLUDED.score,
          completed_at = NOW(),
          attempts     = student_module_progress.attempts + 1
      `, [uuidv4(), userId, moduleId, programId, score ?? null]);

      // Check if all mandatory modules are done → auto-complete program
      const { rows: [check] } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE pm.is_mandatory AND smp.status != 'completed')::int AS remaining
        FROM program_modules pm
        LEFT JOIN student_module_progress smp
          ON smp.module_id = pm.module_id AND smp.student_id = $1 AND smp.program_id = $2
        WHERE pm.program_id = $2
      `, [userId, programId]);

      if (check.remaining === 0) {
        await pool.query(
          `UPDATE student_program_enrollments SET status = 'completed', completed_at = NOW() WHERE student_id = $1 AND program_id = $2`,
          [userId, programId]
        );
      }

      res.json({ success: true, program_completed: check.remaining === 0 });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
);

// ── POST /enroll/:programId — self-enroll in a program ───────────────────────
router.post("/enroll/:programId", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { programId } = req.params;

    const program = await queryOne(`SELECT id, is_active FROM skill_programs WHERE id = $1`, [programId]);
    if (!program) return res.status(404).json({ success: false, error: "Program not found" });
    if (!program.is_active) return res.status(400).json({ success: false, error: "Program is not active" });

    const existing = await queryOne(
      `SELECT id FROM student_program_enrollments WHERE student_id = $1 AND program_id = $2`,
      [userId, programId]
    );
    if (existing) return res.status(400).json({ success: false, error: "Already enrolled" });

    await pool.query(
      `INSERT INTO student_program_enrollments (id, student_id, program_id, status, enrolled_at)
       VALUES ($1, $2, $3, 'enrolled', NOW())`,
      [uuidv4(), userId, programId]
    );

    res.json({ success: true, message: "Enrolled successfully" });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /available-programs — active programs student can enroll in ───────────
router.get("/available-programs", async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rows = await query(`
      SELECT
        sp.id,
        sp.name,
        sp.description,
        sp.program_type,
        sp.duration_days,
        sp.banner_url,
        COUNT(DISTINCT pm.module_id)::int AS module_count,
        CASE WHEN spe.id IS NOT NULL THEN true ELSE false END AS is_enrolled
      FROM skill_programs sp
      LEFT JOIN program_modules pm ON pm.program_id = sp.id
      LEFT JOIN student_program_enrollments spe ON spe.program_id = sp.id AND spe.student_id = $1
      WHERE sp.is_active = true
      GROUP BY sp.id, spe.id
      ORDER BY sp.created_at DESC
    `, [userId]);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
