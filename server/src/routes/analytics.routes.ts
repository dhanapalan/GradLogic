// =============================================================================
// GradLogic — Analytics Routes (Phase 3)
// Drive trends · Cohort comparison · Skill heatmap · Student readiness
// =============================================================================

import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth.js";
import { query, queryOne } from "../config/database.js";
import {
  effectiveCollegeId,
  isCollegeScopedRole,
  resolveCallerCollegeId,
} from "../middleware/collegeIsolation.js";
import { AppError } from "../middleware/errorHandler.js";
import * as studentDashboard from "../services/studentDashboard.service.js";
import * as resultsAnalytics from "../controllers/studentResultsAnalytics.controller.js";

const router = Router();
router.use(authenticate);

const ADMIN_ROLES = ["super_admin", "hr", "cxo", "college_admin", "placement_cell"] as const;

/**
 * Module 07 — Learning Intelligence analytics (student).
 * Static paths registered before admin parameterized routes.
 */
router.get("/performance", authorize("student"), resultsAnalytics.getPerformance);
router.get("/skills", authorize("student"), resultsAnalytics.getSkills);
router.get("/topics", authorize("student"), resultsAnalytics.getTopics);
router.get("/subtopics", authorize("student"), resultsAnalytics.getSubtopics);
router.get("/difficulty", authorize("student"), resultsAnalytics.getDifficulty);
router.get("/bloom", authorize("student"), resultsAnalytics.getBloom);
router.get("/learning-outcomes", authorize("student"), resultsAnalytics.getLearningOutcomes);
router.get("/trends", authorize("student"), resultsAnalytics.getTrends);
router.get("/recommendations", authorize("student"), resultsAnalytics.getRecommendations);
router.get("/strengths", authorize("student"), resultsAnalytics.getStrengths);

// =============================================================================
// EXISTING: Dashboard overview (kept for backward compat)
// =============================================================================

router.get(
  "/dashboard",
  authorize(...ADMIN_ROLES, "admin", "engineer", "college", "college_staff"),
  async (req, res, next) => {
    try {
      const collegeId = await resolveCallerCollegeId(req);

      const metrics = collegeId
        ? await queryOne(`
            SELECT
              (SELECT COUNT(*)::int FROM student_details sd
                 JOIN users u ON u.id = sd.user_id
                 WHERE COALESCE(u.college_id, sd.college_id) = $1 AND u.deleted_at IS NULL) AS total_students,
              (SELECT COUNT(*)::int FROM exam_attempts ea
                 JOIN users u ON u.id = ea.student_id
                 WHERE ea.status = 'completed' AND u.college_id = $1 AND u.deleted_at IS NULL) AS completed_attempts,
              (SELECT COUNT(*)::int FROM exam_attempts ea
                 JOIN users u ON u.id = ea.student_id
                 WHERE u.college_id = $1 AND u.deleted_at IS NULL) AS total_attempts,
              (SELECT AVG(cl.risk_score)::float FROM cheating_logs cl
                 JOIN users u ON u.id = cl.student_id
                 WHERE u.college_id = $1 AND u.deleted_at IS NULL) AS avg_risk_score
          `, [collegeId])
        : await queryOne(`
            SELECT
              (SELECT COUNT(*)::int FROM student_details) AS total_students,
              (SELECT COUNT(*)::int FROM exam_attempts WHERE status = 'completed') AS completed_attempts,
              (SELECT COUNT(*)::int FROM exam_attempts) AS total_attempts,
              (SELECT AVG(risk_score)::float FROM cheating_logs) AS avg_risk_score
          `);

      const segmentRows = collegeId
        ? await queryOne(`
            SELECT COALESCE(jsonb_object_agg(bucket, count), '{}'::jsonb) AS segment_distribution
            FROM (
              SELECT COALESCE(NULLIF(TRIM(sd.degree), ''), 'Unspecified') AS bucket, COUNT(*)::int AS count
              FROM student_details sd
              JOIN users u ON u.id = sd.user_id
              WHERE COALESCE(u.college_id, sd.college_id) = $1 AND u.deleted_at IS NULL
              GROUP BY 1
            ) d
          `, [collegeId])
        : await queryOne(`
            SELECT COALESCE(jsonb_object_agg(bucket, count), '{}'::jsonb) AS segment_distribution
            FROM (
              SELECT COALESCE(NULLIF(TRIM(degree), ''), 'Unspecified') AS bucket, COUNT(*)::int AS count
              FROM student_details GROUP BY 1
            ) d
          `);

      const total = (metrics as any)?.total_students ?? 0;
      const completed = (metrics as any)?.completed_attempts ?? 0;
      const totalAttempts = (metrics as any)?.total_attempts ?? 0;

      res.json({
        success: true,
        data: {
          totalStudents: total,
          assessmentCompletionRate: totalAttempts > 0 ? Math.round((completed / totalAttempts) * 100) : 0,
          avgProctoringIntegrity: Math.max(0, Math.min(100, Math.round(100 - Number((metrics as any)?.avg_risk_score ?? 0)))),
          segmentDistribution: (segmentRows as any)?.segment_distribution ?? {},
        },
      });
    } catch (err) { next(err); }
  }
);

// =============================================================================
// DRIVE ANALYTICS
// =============================================================================

/**
 * GET /api/analytics/drives
 * List all drives with aggregated stats for the analytics table view
 */
router.get("/drives", authorize(...ADMIN_ROLES, "college", "college_staff", "placement_cell"), async (req, res, next) => {
  try {
    const { college_id, drive_type } = req.query as Record<string, string>;
    const collegeId = await effectiveCollegeId(req, college_id);

    const params: any[] = [];
    const collegeFilter = collegeId
      ? (params.push(collegeId), `AND COALESCE(u.college_id, sd.college_id) = $${params.length}`)
      : "";
    const driveTypeFilter = drive_type
      ? (params.push(drive_type), `AND ad.drive_type = $${params.length}`)
      : "";

    // College-scoped roles must always filter — never return cross-tenant drive analytics
    if (isCollegeScopedRole(req.user?.role) && !collegeId) {
      throw new AppError("Unauthorized: College context missing", 403);
    }

    const rows = await query(`
      SELECT
        ad.id,
        ad.name,
        ad.status,
        ad.drive_type,
        ad.scheduled_start AS scheduled_at,
        art.overall_cutoff AS cutoff_score,
        comp.name AS company_name,
        COUNT(ds.student_id)::int                                              AS total_students,
        COUNT(ds.student_id) FILTER (WHERE ds.status = 'submitted')::int       AS submitted_count,
        ROUND(AVG(ds.score) FILTER (WHERE ds.status = 'submitted'), 1)         AS avg_score,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ds.score >= COALESCE(art.overall_cutoff, 0) AND ds.status = 'submitted')
          / NULLIF(COUNT(*) FILTER (WHERE ds.status = 'submitted'), 0), 1
        )                                                                       AS pass_rate,
        COUNT(ds.student_id) FILTER (WHERE ds.pipeline_stage = 'pending')::int     AS pipeline_pending,
        COUNT(ds.student_id) FILTER (WHERE ds.pipeline_stage = 'shortlisted')::int AS pipeline_shortlisted,
        COUNT(ds.student_id) FILTER (WHERE ds.pipeline_stage = 'offered')::int     AS pipeline_offered
      FROM assessment_drives ad
      LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
      LEFT JOIN companies comp ON comp.user_id = ad.created_by
      LEFT JOIN drive_students ds ON ds.drive_id = ad.id
      LEFT JOIN users u ON u.id = ds.student_id
      LEFT JOIN student_details sd ON sd.user_id = u.id
      WHERE 1=1 ${collegeFilter} ${driveTypeFilter}
      GROUP BY ad.id, ad.name, ad.status, ad.drive_type, ad.scheduled_start, art.overall_cutoff, comp.name
      ORDER BY ad.scheduled_start DESC
      LIMIT 50
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/drives/:driveId
 * Deep-dive stats for a single drive
 */
router.get("/drives/:driveId", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const { driveId } = req.params;

    // Basic stats + score distribution
    const [overview, distribution, categoryAvg, topStudents] = await Promise.all([
      queryOne(`
        SELECT
          ad.name, art.overall_cutoff AS cutoff_score, ad.scheduled_start AS scheduled_at,
          COUNT(ds.student_id)::int                                              AS total_students,
          COUNT(ds.student_id) FILTER (WHERE ds.status = 'submitted')::int       AS submitted_count,
          ROUND(AVG(ds.score) FILTER (WHERE ds.status = 'submitted'), 1)         AS avg_score,
          ROUND(MIN(ds.score) FILTER (WHERE ds.status = 'submitted'), 1)         AS min_score,
          ROUND(MAX(ds.score) FILTER (WHERE ds.status = 'submitted'), 1)         AS max_score,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ds.score) FILTER (WHERE ds.status = 'submitted'), 1) AS median_score,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE ds.score >= COALESCE(art.overall_cutoff, 0) AND ds.status = 'submitted')
            / NULLIF(COUNT(*) FILTER (WHERE ds.status = 'submitted'), 0), 1
          ) AS pass_rate
        FROM assessment_drives ad
        LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
        LEFT JOIN drive_students ds ON ds.drive_id = ad.id
        WHERE ad.id = $1
        GROUP BY ad.id, ad.name, art.overall_cutoff, ad.scheduled_start
      `, [driveId]),

      query(`
        SELECT
          width_bucket(ds.score, 0, 100, 10) AS bucket_num,
          ((width_bucket(ds.score, 0, 100, 10) - 1) * 10)::text || '-'
            || (width_bucket(ds.score, 0, 100, 10) * 10)::text AS range,
          COUNT(*)::int AS count
        FROM drive_students ds
        WHERE ds.drive_id = $1 AND ds.status = 'submitted' AND ds.score IS NOT NULL
        GROUP BY bucket_num
        ORDER BY bucket_num
      `, [driveId]),

      query(`
        SELECT
          qb.category,
          ROUND(
            100.0 * COUNT(*) FILTER (WHERE pa.is_correct) / NULLIF(COUNT(*), 0), 1
          ) AS avg_correct_pct,
          COUNT(DISTINCT pa.session_id)::int AS response_count
        FROM drive_students ds
        JOIN exam_sessions es ON es.student_id = ds.student_id
        JOIN practice_attempts pa ON pa.session_id = es.id
        JOIN question_bank qb ON qb.id = pa.question_id
        WHERE ds.drive_id = $1
        GROUP BY qb.category
        ORDER BY avg_correct_pct ASC
      `, [driveId]),

      query(`
        SELECT u.name, ds.score, ds.rank,
               COALESCE(sx.level, 1) AS level,
               COALESCE(sx.total_xp, 0) AS total_xp
        FROM drive_students ds
        JOIN users u ON u.id = ds.student_id
        LEFT JOIN student_xp sx ON sx.student_id = ds.student_id
        WHERE ds.drive_id = $1 AND ds.status = 'submitted'
        ORDER BY ds.score DESC NULLS LAST
        LIMIT 10
      `, [driveId]),
    ]);

    res.json({
      success: true,
      data: { overview, score_distribution: distribution, category_performance: categoryAvg, top_students: topStudents },
    });
  } catch (err) { next(err); }
});

// =============================================================================
// COHORT ANALYTICS
// =============================================================================

/**
 * GET /api/analytics/cohort
 * Compare performance across colleges / degrees / passing years
 */
router.get("/cohort", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const { group_by = "college" } = req.query as Record<string, string>;

    const VALID_GROUP_BY = ["college", "degree", "year"] as const;
    if (!VALID_GROUP_BY.includes(group_by as typeof VALID_GROUP_BY[number])) {
      return res.status(400).json({ error: `Invalid group_by. Must be one of: ${VALID_GROUP_BY.join(", ")}` });
    }

    let groupExpr = "";
    let labelExpr = "";

    if (group_by === "degree") {
      groupExpr = "COALESCE(sd.degree, 'Unspecified')";
      labelExpr = "COALESCE(sd.degree, 'Unspecified') AS label";
    } else if (group_by === "year") {
      groupExpr = "COALESCE(sd.passing_year::text, 'Unknown')";
      labelExpr = "COALESCE(sd.passing_year::text, 'Unknown') AS label";
    } else {
      groupExpr = "c.id, c.name";
      labelExpr = "COALESCE(c.name, 'Unknown') AS label";
    }

    const rows = await query(`
      SELECT
        ${labelExpr},
        COUNT(DISTINCT ds.student_id)::int            AS student_count,
        ROUND(AVG(ds.score) FILTER (WHERE ds.status = 'submitted'), 1)  AS avg_drive_score,
        ROUND(AVG(ps.score_percent) FILTER (WHERE ps.status = 'completed'), 1) AS avg_practice_score,
        COALESCE(ROUND(AVG(sx.total_xp)), 0)::int     AS avg_xp,
        ROUND(
          100.0 * COUNT(*) FILTER (WHERE ds.score >= COALESCE(art.overall_cutoff, 0) AND ds.status = 'submitted')
          / NULLIF(COUNT(*) FILTER (WHERE ds.status = 'submitted'), 0), 1
        ) AS pass_rate
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
      LEFT JOIN drive_students ds ON ds.student_id = u.id
      LEFT JOIN assessment_drives ad ON ad.id = ds.drive_id
      LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
      LEFT JOIN practice_sessions ps ON ps.student_id = u.id
      LEFT JOIN student_xp sx ON sx.student_id = u.id
      WHERE u.role = 'student'
      GROUP BY ${groupExpr}
      ORDER BY avg_drive_score DESC NULLS LAST
      LIMIT 30
    `);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// =============================================================================
// SKILL HEATMAP
// =============================================================================

/**
 * GET /api/analytics/skill-heatmap
 * Category-level accuracy across all students, filterable by college
 */
router.get("/skill-heatmap", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const { college_id } = req.query as Record<string, string>;

    const heatParams: any[] = [];
    const collegeJoin = college_id
      ? (heatParams.push(college_id), `JOIN student_details sd ON sd.user_id = ps.student_id AND sd.college_id = $${heatParams.length}`)
      : "";

    const rows = await query(`
      SELECT
        qb.category,
        qb.difficulty_level,
        COUNT(pa.id)::int                                                    AS total_attempts,
        COUNT(pa.id) FILTER (WHERE pa.is_correct)::int                       AS correct_count,
        ROUND(100.0 * COUNT(pa.id) FILTER (WHERE pa.is_correct) / NULLIF(COUNT(pa.id), 0), 1) AS accuracy_pct,
        COUNT(DISTINCT ps.student_id)::int                                   AS student_count
      FROM practice_attempts pa
      JOIN practice_sessions ps ON ps.id = pa.session_id
      ${collegeJoin}
      JOIN question_bank qb ON qb.id = pa.question_id
      WHERE ps.status = 'completed'
      GROUP BY qb.category, qb.difficulty_level
      ORDER BY qb.category, qb.difficulty_level
    `, heatParams);

    // Pivot into heatmap format: {category → {easy, medium, hard} → accuracy}
    const heatmap: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      const r = row as any;
      if (!heatmap[r.category]) heatmap[r.category] = {};
      heatmap[r.category][r.difficulty_level] = Number(r.accuracy_pct);
    }

    res.json({ success: true, data: { heatmap, raw: rows } });
  } catch (err) { next(err); }
});

// =============================================================================
// STUDENT READINESS
// =============================================================================

/**
 * GET /api/analytics/readiness
 * - Student: own placement readiness composite (Module 02 dashboard)
 * - Admin roles: college-wide readiness table (unchanged)
 */
router.get("/readiness", async (req, res, next) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role === "student") {
      // Module 07 enriched readiness (still includes Module 02 score/level/stages).
      return resultsAnalytics.getReadiness(req, res, next);
    }
    if (!(ADMIN_ROLES as readonly string[]).includes(role) && role !== "admin") {
      throw new AppError("Forbidden", 403);
    }

    const { college_id: requestedCollegeId, limit = "50", offset = "0" } = req.query as Record<string, string>;

    // College-scoped roles (college_admin, placement_cell, ...) can never see
    // another college's students — their own college_id always wins over
    // whatever the client requested. Platform roles (super_admin/hr/cxo) can
    // still filter by any college_id, or see all colleges by omitting it.
    const callerCollegeId = await resolveCallerCollegeId(req);
    const college_id = callerCollegeId ?? requestedCollegeId;

    const readinessParams: any[] = [];
    const collegeFilter = college_id
      ? (readinessParams.push(college_id), `AND COALESCE(u.college_id, sd.college_id) = $${readinessParams.length}`)
      : "";

    readinessParams.push(parseInt(limit));
    const limitIdx = readinessParams.length;
    readinessParams.push(parseInt(offset));
    const offsetIdx = readinessParams.length;

    const rows = await query(`
      SELECT
        u.id,
        u.name,
        sd.degree,
        sd.passing_year,
        COALESCE(c.name, 'N/A') AS college_name,
        -- XP component (0–100): cap at 5000 XP = 100
        LEAST(100, ROUND(COALESCE(sx.total_xp, 0)::numeric / 50, 1))              AS xp_score,
        -- Practice component: avg score across completed sessions
        COALESCE(ROUND(AVG(ps.score_percent) FILTER (WHERE ps.status = 'completed'), 1), 0) AS practice_score,
        -- Drive component: avg score across submitted drives
        COALESCE(ROUND(AVG(ds.score) FILTER (WHERE ds.status = 'submitted'), 1), 0) AS drive_score,
        -- Composite (weighted): 20% XP + 35% practice + 45% drive
        ROUND(
          0.20 * LEAST(100, COALESCE(sx.total_xp, 0)::numeric / 50)
          + 0.35 * COALESCE(AVG(ps.score_percent) FILTER (WHERE ps.status = 'completed'), 0)
          + 0.45 * COALESCE(AVG(ds.score) FILTER (WHERE ds.status = 'submitted'), 0)
        , 1) AS readiness_score,
        COALESCE(sx.level, 1)        AS level,
        COALESCE(sx.total_xp, 0)     AS total_xp,
        COUNT(DISTINCT ps.id) FILTER (WHERE ps.status = 'completed')::int  AS practice_sessions,
        COUNT(DISTINCT ds.drive_id)::int                                    AS drives_taken
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
      LEFT JOIN student_xp sx ON sx.student_id = u.id
      LEFT JOIN practice_sessions ps ON ps.student_id = u.id
      LEFT JOIN drive_students ds ON ds.student_id = u.id
      WHERE u.role = 'student' ${collegeFilter}
      GROUP BY u.id, u.name, sd.degree, sd.passing_year, c.name, sx.total_xp, sx.level
      ORDER BY readiness_score DESC NULLS LAST
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, readinessParams);

    // Count total for pagination (reuse college param only, no limit/offset)
    const countParams = college_id ? [college_id] : [];
    const countFilter = college_id ? `AND COALESCE(u.college_id, sd.college_id) = $1` : "";
    const countRow = await queryOne(`
      SELECT COUNT(DISTINCT u.id)::int AS total
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      WHERE u.role = 'student' ${countFilter}
    `, countParams);

    res.json({
      success: true,
      data: rows,
      meta: { total: (countRow as any)?.total || 0 },
    });
  } catch (err) { next(err); }
});

/**
 * GET /api/analytics/readiness/:studentId
 * Individual student readiness breakdown
 */
router.get("/readiness/:studentId", authorize(...ADMIN_ROLES, "mentor"), async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const callerCollegeId = await resolveCallerCollegeId(req);
    if (callerCollegeId) {
      const belongsToCollege = await queryOne<{ id: string }>(
        `SELECT u.id FROM users u LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE u.id = $1 AND COALESCE(u.college_id, sd.college_id) = $2`,
        [studentId, callerCollegeId],
      );
      if (!belongsToCollege) throw new AppError("Student not found", 404);
    }

    const [profile, driveHistory, practiceHistory, skillBreakdown] = await Promise.all([
      queryOne(`
        SELECT u.name, sd.degree, sd.passing_year, COALESCE(c.name, 'N/A') AS college_name,
               COALESCE(sx.total_xp, 0) AS total_xp, COALESCE(sx.level, 1) AS level,
               COALESCE(ps2.current_streak, 0) AS current_streak
        FROM users u
        LEFT JOIN student_details sd ON sd.user_id = u.id
        LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
        LEFT JOIN student_xp sx ON sx.student_id = u.id
        LEFT JOIN practice_streaks ps2 ON ps2.student_id = u.id
        WHERE u.id = $1
      `, [studentId]),

      query(`
        SELECT drive_name, score, status, scheduled_at, rnk AS rank FROM (
          SELECT ad.id AS drive_id, ad.name AS drive_name, ds.student_id, ds.score, ds.status,
                 ad.scheduled_start AS scheduled_at,
                 RANK() OVER (PARTITION BY ds.drive_id ORDER BY ds.score DESC) AS rnk
          FROM drive_students ds
          JOIN assessment_drives ad ON ad.id = ds.drive_id
          WHERE ds.status = 'submitted'
        ) ranked
        WHERE student_id = $1
        ORDER BY scheduled_at DESC
        LIMIT 10
      `, [studentId]),

      queryOne(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
          ROUND(AVG(score_percent) FILTER (WHERE status = 'completed'), 1) AS avg_score,
          MAX(score_percent) FILTER (WHERE status = 'completed') AS best_score
        FROM practice_sessions
        WHERE student_id = $1
      `, [studentId]),

      query(`
        SELECT qb.category,
               ROUND(100.0 * COUNT(*) FILTER (WHERE pa.is_correct) / NULLIF(COUNT(*), 0), 1) AS accuracy,
               COUNT(*)::int AS attempts
        FROM practice_attempts pa
        JOIN practice_sessions ps ON ps.id = pa.session_id
        JOIN question_bank qb ON qb.id = pa.question_id
        WHERE ps.student_id = $1 AND ps.status = 'completed'
        GROUP BY qb.category
        ORDER BY accuracy ASC
      `, [studentId]),
    ]);

    res.json({
      success: true,
      data: { profile, drive_history: driveHistory, practice: practiceHistory, skill_breakdown: skillBreakdown },
    });
  } catch (err) { next(err); }
});

// =============================================================================
// OVERALL PLATFORM TREND (for HR overview chart)
// =============================================================================

/**
 * GET /api/analytics/trend
 * Monthly registration + assessment activity for the last 6 months
 */
router.get("/trend", authorize(...ADMIN_ROLES), async (req, res, next) => {
  try {
    const registrations = await query(`
      SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon') AS month,
             DATE_TRUNC('month', created_at) AS month_start,
             COUNT(*)::int AS students
      FROM student_details
      WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY DATE_TRUNC('month', created_at)
    `);

    const sessions = await query(`
      SELECT TO_CHAR(DATE_TRUNC('month', started_at), 'Mon') AS month,
             DATE_TRUNC('month', started_at) AS month_start,
             COUNT(DISTINCT student_id)::int AS screened
      FROM exam_sessions
      WHERE started_at >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
      GROUP BY DATE_TRUNC('month', started_at)
      ORDER BY DATE_TRUNC('month', started_at)
    `);

    const sessionMap = new Map(sessions.map((s: any) => [s.month, s.screened]));
    const trend = registrations.map((r: any) => ({
      month: r.month,
      students: r.students,
      screened: sessionMap.get(r.month) ?? 0,
    }));

    res.json({ success: true, data: trend });
  } catch (err) { next(err); }
});

export default router;
