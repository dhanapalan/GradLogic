// =============================================================================
// GradLogic — LMS Routes
// Courses · Modules · Lessons · Enrollments · Progress · Learning Paths
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import * as platformModulesController from "../controllers/platformModules.controller.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── Helper ────────────────────────────────────────────────────────────────────

const CONTENT_ROLES = ["super_admin", "hr", "instructor"] as const;
const READ_ROLES    = ["super_admin", "hr", "instructor", "mentor", "college_admin", "college", "college_staff", "student", "cxo"] as const;

// =============================================================================
// LMS MODULE GROUPS (multi-tenant feature modules)
// =============================================================================

/**
 * GET /api/lms/module-groups/:moduleKey/content
 * Courses, practice topics, and (for students) progress for an enabled module.
 */
router.get(
  "/module-groups/:moduleKey/content",
  authorize(...READ_ROLES),
  platformModulesController.getLmsModuleContent
);

// =============================================================================
// COURSES
// =============================================================================

/**
 * GET /api/lms/courses
 * List all published courses (students see published only; instructors see own)
 */
router.get("/courses", authorize(...READ_ROLES), async (req, res, next) => {
  try {
    const { category, difficulty, search, status } = req.query as Record<string, string>;
    const user = req.user!;

    let statusFilter = "c.status = 'published'";
    if (["super_admin", "hr", "instructor"].includes(user.role)) {
      statusFilter = status ? `c.status = $1` : "TRUE";
    }

    const rows = await query(`
      SELECT c.*,
        u.name AS instructor_name,
        col.name AS college_name,
        (SELECT COUNT(*)::int FROM enrollments e WHERE e.course_id = c.id) AS enrollment_count
      FROM courses c
      LEFT JOIN users u ON u.id = c.created_by
      LEFT JOIN colleges col ON col.id = c.college_id
      WHERE ${statusFilter}
        AND ($2::text IS NULL OR c.category = $2)
        AND ($3::text IS NULL OR c.difficulty = $3)
        AND ($4::text IS NULL OR c.title ILIKE '%' || $4 || '%')
        ${user.role === "instructor" ? "AND c.created_by = '" + user.userId + "'" : ""}
      ORDER BY c.created_at DESC
    `, [
      status || null,
      category || null,
      difficulty || null,
      search || null,
    ]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/lms/courses/:id
 * Get a single course with its modules and lessons
 */
router.get("/courses/:id", authorize(...READ_ROLES), async (req, res, next) => {
  try {
    const course = await queryOne(`
      SELECT c.*, u.name AS instructor_name
      FROM courses c
      LEFT JOIN users u ON u.id = c.created_by
      WHERE c.id = $1
    `, [req.params.id]);

    if (!course) return res.status(404).json({ success: false, error: "Course not found" });

    const modules = await query(`
      SELECT m.*,
        COALESCE(json_agg(l ORDER BY l.sort_order) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
      FROM course_modules m
      LEFT JOIN lessons l ON l.module_id = m.id
      WHERE m.course_id = $1
      GROUP BY m.id
      ORDER BY m.sort_order
    `, [req.params.id]);

    res.json({ success: true, data: { ...course, modules } });
  } catch (err) { next(err); }
});

/**
 * POST /api/lms/courses
 * Create a new course (instructor / HR / admin)
 */
router.post("/courses", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const {
      title, description, category, difficulty,
      duration_hours, thumbnail_url, intro_video_url,
      is_free, tags, college_id,
    } = req.body;

    const course = await queryOne(`
      INSERT INTO courses (title, description, category, difficulty, duration_hours,
        thumbnail_url, intro_video_url, is_free, tags, college_id, created_by, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft')
      RETURNING *
    `, [title, description, category, difficulty || "beginner", duration_hours || null,
        thumbnail_url || null, intro_video_url || null, is_free ?? true,
        tags || [], college_id || null, req.user!.userId]);

    res.status(201).json({ success: true, data: course });
  } catch (err) { next(err); }
});

/**
 * PUT /api/lms/courses/:id
 * Update course details
 */
router.put("/courses/:id", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const {
      title, description, category, difficulty, duration_hours,
      thumbnail_url, intro_video_url, is_free, tags, status,
    } = req.body;

    const course = await queryOne(`
      UPDATE courses SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        difficulty = COALESCE($4, difficulty),
        duration_hours = COALESCE($5, duration_hours),
        thumbnail_url = COALESCE($6, thumbnail_url),
        intro_video_url = COALESCE($7, intro_video_url),
        is_free = COALESCE($8, is_free),
        tags = COALESCE($9, tags),
        status = COALESCE($10, status),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [title, description, category, difficulty, duration_hours,
        thumbnail_url, intro_video_url, is_free, tags, status, req.params.id]);

    if (!course) return res.status(404).json({ success: false, error: "Course not found" });
    res.json({ success: true, data: course });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/lms/courses/:id
 */
router.delete("/courses/:id", authorize("super_admin", "hr"), async (req, res, next) => {
  try {
    await query("UPDATE courses SET status = 'archived' WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: "Course archived" });
  } catch (err) { next(err); }
});

// =============================================================================
// MODULES
// =============================================================================

/**
 * GET /api/lms/courses/:courseId/modules
 * Return modules with lessons for a course
 */
router.get("/courses/:courseId/modules", authorize(...READ_ROLES), async (req, res, next) => {
  try {
    const modules = await query(`
      SELECT m.*,
        COALESCE(json_agg(l ORDER BY l.sort_order) FILTER (WHERE l.id IS NOT NULL), '[]') AS lessons
      FROM course_modules m
      LEFT JOIN lessons l ON l.module_id = m.id
      WHERE m.course_id = $1
      GROUP BY m.id
      ORDER BY m.sort_order
    `, [req.params.courseId]);

    res.json({ success: true, data: modules });
  } catch (err) { next(err); }
});

/**
 * POST /api/lms/courses/:courseId/modules
 */
router.post("/courses/:courseId/modules", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const { title, description, sort_order, estimated_minutes, unlock_after_module } = req.body;

    const module_ = await queryOne(`
      INSERT INTO course_modules (course_id, title, description, sort_order, estimated_minutes, unlock_after_module)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [req.params.courseId, title, description || null,
        sort_order ?? 0, estimated_minutes || null, unlock_after_module || null]);

    // Update course total_modules count
    await query(`UPDATE courses SET total_modules = (
      SELECT COUNT(*) FROM course_modules WHERE course_id = $1
    ), updated_at = NOW() WHERE id = $1`, [req.params.courseId]);

    res.status(201).json({ success: true, data: module_ });
  } catch (err) { next(err); }
});

/**
 * PUT /api/lms/modules/:id
 */
router.put("/modules/:id", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const { title, description, sort_order, estimated_minutes, is_locked } = req.body;

    const module_ = await queryOne(`
      UPDATE course_modules SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        sort_order = COALESCE($3, sort_order),
        estimated_minutes = COALESCE($4, estimated_minutes),
        is_locked = COALESCE($5, is_locked),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [title, description, sort_order, estimated_minutes, is_locked, req.params.id]);

    res.json({ success: true, data: module_ });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/lms/modules/:id
 */
router.delete("/modules/:id", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    await query("DELETE FROM course_modules WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// =============================================================================
// LESSONS
// =============================================================================

/**
 * POST /api/lms/modules/:moduleId/lessons
 */
router.post("/modules/:moduleId/lessons", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const {
      title, content_type, content_url, content_text,
      video_duration_seconds, sort_order, is_free_preview, estimated_minutes,
    } = req.body;

    const lesson = await queryOne(`
      INSERT INTO lessons (module_id, title, content_type, content_url, content_text,
        video_duration_seconds, sort_order, is_free_preview, estimated_minutes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `, [req.params.moduleId, title, content_type, content_url || null,
        content_text || null, video_duration_seconds || null,
        sort_order ?? 0, is_free_preview ?? false, estimated_minutes || null]);

    res.status(201).json({ success: true, data: lesson });
  } catch (err) { next(err); }
});

/**
 * PUT /api/lms/lessons/:id
 */
router.put("/lessons/:id", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    const { title, content_url, content_text, sort_order, is_free_preview } = req.body;

    const lesson = await queryOne(`
      UPDATE lessons SET
        title = COALESCE($1, title),
        content_url = COALESCE($2, content_url),
        content_text = COALESCE($3, content_text),
        sort_order = COALESCE($4, sort_order),
        is_free_preview = COALESCE($5, is_free_preview),
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [title, content_url, content_text, sort_order, is_free_preview, req.params.id]);

    res.json({ success: true, data: lesson });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/lms/lessons/:id
 */
router.delete("/lessons/:id", authorize(...CONTENT_ROLES), async (req, res, next) => {
  try {
    await query("DELETE FROM lessons WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// =============================================================================
// ENROLLMENTS
// =============================================================================

/**
 * GET /api/lms/my-courses
 * Student: list enrolled courses with progress
 */
router.get("/my-courses", authorize("student"), async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT e.*, c.title, c.description, c.category, c.difficulty,
             c.thumbnail_url, c.total_modules, u.name AS instructor_name
      FROM enrollments e
      JOIN courses c ON c.id = e.course_id
      LEFT JOIN users u ON u.id = c.created_by
      WHERE e.student_id = $1
      ORDER BY e.enrolled_at DESC
    `, [req.user!.userId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/lms/courses/:courseId/enroll
 * Self-enroll in a course
 */
router.post("/courses/:courseId/enroll", authorize("student"), async (req, res, next) => {
  try {
    const existing = await queryOne(
      "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
      [req.user!.userId, req.params.courseId]
    );

    if (existing) return res.status(409).json({ success: false, error: "Already enrolled" });

    const enrollment = await queryOne(`
      INSERT INTO enrollments (student_id, course_id)
      VALUES ($1, $2) RETURNING *
    `, [req.user!.userId, req.params.courseId]);

    // Increment course enrollment count
    await query(`UPDATE courses SET total_enrollments = total_enrollments + 1 WHERE id = $1`, [req.params.courseId]);

    res.status(201).json({ success: true, data: enrollment });
  } catch (err) { next(err); }
});

/**
 * POST /api/lms/courses/:courseId/bulk-enroll
 * Admin/Instructor bulk enroll students
 */
router.post("/courses/:courseId/bulk-enroll", authorize("super_admin", "hr", "instructor", "college_admin"), async (req, res, next) => {
  try {
    const { student_ids } = req.body as { student_ids: string[] };
    if (!student_ids?.length) return res.status(400).json({ error: "student_ids required" });

    let enrolled = 0;
    for (const sid of student_ids) {
      const exists = await queryOne(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [sid, req.params.courseId]
      );
      if (!exists) {
        await queryOne(
          "INSERT INTO enrollments (student_id, course_id, enrolled_by) VALUES ($1,$2,$3)",
          [sid, req.params.courseId, req.user!.userId]
        );
        enrolled++;
      }
    }

    await query(
      `UPDATE courses SET total_enrollments = (SELECT COUNT(*) FROM enrollments WHERE course_id = $1) WHERE id = $1`,
      [req.params.courseId]
    );

    res.json({ success: true, enrolled });
  } catch (err) { next(err); }
});

// =============================================================================
// LESSON PROGRESS
// =============================================================================

/**
 * PUT /api/lms/lessons/:lessonId/progress
 * Update lesson progress for the logged-in student
 */
router.put("/lessons/:lessonId/progress", authorize("student"), async (req, res, next) => {
  try {
    const { watch_seconds, is_completed } = req.body;
    const studentId = req.user!.userId;
    const lessonId = req.params.lessonId;

    const progress = await queryOne(`
      INSERT INTO lesson_progress (student_id, lesson_id, watch_seconds, is_completed, completed_at, last_accessed)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (student_id, lesson_id) DO UPDATE SET
        watch_seconds = GREATEST(lesson_progress.watch_seconds, $3),
        is_completed  = CASE WHEN $4 THEN TRUE ELSE lesson_progress.is_completed END,
        completed_at  = CASE WHEN $4 AND lesson_progress.completed_at IS NULL THEN NOW() ELSE lesson_progress.completed_at END,
        last_accessed = NOW()
      RETURNING *
    `, [studentId, lessonId, watch_seconds || 0, is_completed ?? false,
        is_completed ? new Date() : null]);

    // Recalculate enrollment progress
    await query(`
      UPDATE enrollments SET
        progress_percent = (
          SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE lp.is_completed) / NULLIF(COUNT(*), 0), 2)
          FROM lessons l
          JOIN course_modules m ON m.id = l.module_id
          JOIN courses c ON c.id = m.course_id
          JOIN enrollments en ON en.course_id = c.id AND en.student_id = $1
          LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
          WHERE en.student_id = $1 AND en.course_id = (
            SELECT c2.id FROM lessons l2
            JOIN course_modules m2 ON m2.id = l2.module_id
            JOIN courses c2 ON c2.id = m2.course_id
            WHERE l2.id = $2
          )
        ),
        status = CASE WHEN progress_percent >= 100 THEN 'completed' ELSE status END,
        completed_at = CASE WHEN progress_percent >= 100 AND completed_at IS NULL THEN NOW() ELSE completed_at END
      WHERE student_id = $1
        AND course_id = (
          SELECT c3.id FROM lessons l3
          JOIN course_modules m3 ON m3.id = l3.module_id
          JOIN courses c3 ON c3.id = m3.course_id
          WHERE l3.id = $2
        )
    `, [studentId, lessonId]);

    res.json({ success: true, data: progress });
  } catch (err) { next(err); }
});

/**
 * GET /api/lms/courses/:courseId/my-progress
 * Get detailed lesson-by-lesson progress for a course
 */
router.get("/courses/:courseId/my-progress", authorize("student"), async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT l.id AS lesson_id, l.title, l.content_type, l.sort_order,
             l.content_url, l.content_text, l.video_duration_seconds, l.is_free_preview,
             m.id AS module_id, m.title AS module_title, m.sort_order AS module_order,
             lp.is_completed, lp.watch_seconds, lp.last_accessed
      FROM course_modules m
      JOIN lessons l ON l.module_id = m.id
      LEFT JOIN lesson_progress lp ON lp.lesson_id = l.id AND lp.student_id = $1
      WHERE m.course_id = $2
      ORDER BY m.sort_order, l.sort_order
    `, [req.user!.userId, req.params.courseId]);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// =============================================================================
// LEARNING PATHS
// =============================================================================

/**
 * GET /api/lms/paths
 */
router.get("/paths", authorize(...READ_ROLES), async (req, res, next) => {
  try {
    const paths = await query(`
      SELECT lp.*,
        COALESCE(json_agg(json_build_object(
          'course_id', c.id, 'title', c.title, 'category', c.category,
          'difficulty', c.difficulty, 'sort_order', lpc.sort_order, 'is_required', lpc.is_required
        ) ORDER BY lpc.sort_order) FILTER (WHERE c.id IS NOT NULL), '[]') AS courses
      FROM learning_paths lp
      LEFT JOIN learning_path_courses lpc ON lpc.path_id = lp.id
      LEFT JOIN courses c ON c.id = lpc.course_id
      WHERE lp.status = 'published'
      GROUP BY lp.id
      ORDER BY lp.created_at DESC
    `);
    res.json({ success: true, data: paths });
  } catch (err) { next(err); }
});

/**
 * POST /api/lms/paths
 */
router.post("/paths", authorize("super_admin", "hr", "instructor"), async (req, res, next) => {
  try {
    const { title, description, target_role, duration_days, thumbnail_url, course_ids } = req.body;

    const path = await queryOne(`
      INSERT INTO learning_paths (title, description, target_role, duration_days, thumbnail_url, created_by)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *
    `, [title, description || null, target_role || null, duration_days || null, thumbnail_url || null, req.user!.userId]);

    if (course_ids?.length && path) {
      for (let i = 0; i < course_ids.length; i++) {
        await query(
          "INSERT INTO learning_path_courses (path_id, course_id, sort_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
          [(path as any).id, course_ids[i], i]
        );
      }
    }

    res.status(201).json({ success: true, data: path });
  } catch (err) { next(err); }
});

/**
 * GET /api/lms/paths/:id
 * Path detail with courses + student enrollment status per course
 */
router.get("/paths/:id", authorize(...READ_ROLES), async (req, res, next) => {
  try {
    const studentId = req.user!.role === "student" ? req.user!.userId : null;

    const path = await queryOne(`
      SELECT lp.*,
        COALESCE(json_agg(json_build_object(
          'course_id',   c.id,
          'title',       c.title,
          'category',    c.category,
          'difficulty',  c.difficulty,
          'total_modules', c.total_modules,
          'sort_order',  lpc.sort_order,
          'is_required', lpc.is_required,
          'enrolled',    (e.id IS NOT NULL)
        ) ORDER BY lpc.sort_order) FILTER (WHERE c.id IS NOT NULL), '[]') AS courses
      FROM learning_paths lp
      LEFT JOIN learning_path_courses lpc ON lpc.path_id = lp.id
      LEFT JOIN courses c ON c.id = lpc.course_id
      LEFT JOIN enrollments e ON e.course_id = c.id AND e.student_id = $2
      WHERE lp.id = $1
      GROUP BY lp.id
    `, [req.params.id, studentId]);

    if (!path) return res.status(404).json({ error: "Learning path not found" });
    res.json({ success: true, data: path });
  } catch (err) { next(err); }
});

/**
 * POST /api/lms/paths/:id/enroll
 * Enroll student in all required courses in the path (skip already enrolled)
 */
router.post("/paths/:id/enroll", authorize("student"), async (req, res, next) => {
  try {
    const studentId = req.user!.userId;
    const pathId = req.params.id;

    const pathCourses = await query(`
      SELECT lpc.course_id
      FROM learning_path_courses lpc
      JOIN learning_paths lp ON lp.id = lpc.path_id
      WHERE lpc.path_id = $1 AND lp.status = 'published'
    `, [pathId]);

    if (!pathCourses.length) return res.status(404).json({ error: "Path not found or has no courses" });

    let enrolled = 0;
    let skipped = 0;
    for (const row of pathCourses) {
      const courseId = (row as any).course_id;
      const existing = await queryOne(
        "SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2",
        [studentId, courseId]
      );
      if (existing) { skipped++; continue; }
      await queryOne(
        "INSERT INTO enrollments (student_id, course_id) VALUES ($1,$2) RETURNING id",
        [studentId, courseId]
      );
      await query("UPDATE courses SET total_enrollments = total_enrollments + 1 WHERE id = $1", [courseId]);
      enrolled++;
    }

    res.status(201).json({ success: true, data: { enrolled, skipped, total: pathCourses.length } });
  } catch (err) { next(err); }
});

// =============================================================================
// CERTIFICATES
// =============================================================================

/**
 * POST /api/lms/courses/:courseId/certificate
 * Issue a certificate when enrollment is 100% complete
 */
router.post("/courses/:courseId/certificate", authorize("student"), async (req, res, next) => {
  try {
    const studentId = req.user!.userId;
    const { courseId } = req.params;

    // Verify 100% completion
    const enrollment = await queryOne(
      "SELECT e.*, c.title FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.student_id = $1 AND e.course_id = $2",
      [studentId, courseId]
    );
    if (!enrollment) return res.status(404).json({ error: "Not enrolled in this course" });
    if ((enrollment as any).progress_percent < 100) {
      return res.status(400).json({ error: "Course not yet completed (progress < 100%)" });
    }

    const cert = await queryOne(
      `INSERT INTO certificates (student_id, course_id, title)
       VALUES ($1,$2,$3)
       ON CONFLICT (student_id, course_id) DO UPDATE SET issued_at = EXCLUDED.issued_at
       RETURNING *`,
      [studentId, courseId, (enrollment as any).title]
    );

    // Fetch student name for the certificate render
    const student = await queryOne("SELECT name FROM users WHERE id = $1", [studentId]);

    res.status(201).json({
      success: true,
      data: {
        ...(cert as any),
        student_name: (student as any)?.name,
        course_title: (enrollment as any).title,
      }
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/lms/certificates/my
 * Student: list all their certificates
 */
router.get("/certificates/my", authorize("student"), async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT cert.*, u.name AS student_name
      FROM certificates cert
      JOIN users u ON u.id = cert.student_id
      WHERE cert.student_id = $1
      ORDER BY cert.issued_at DESC
    `, [req.user!.userId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/lms/certificates/:id
 * Get single certificate (for the certificate page render)
 */
router.get("/certificates/:id", authorize("student", "super_admin", "hr"), async (req, res, next) => {
  try {
    const cert = await queryOne(`
      SELECT cert.*, u.name AS student_name,
             c.title AS course_title, c.category, c.difficulty
      FROM certificates cert
      JOIN users u ON u.id = cert.student_id
      LEFT JOIN courses c ON c.id = cert.course_id
      WHERE cert.id = $1
    `, [req.params.id]);
    if (!cert) return res.status(404).json({ error: "Certificate not found" });
    res.json({ success: true, data: cert });
  } catch (err) { next(err); }
});

export default router;
