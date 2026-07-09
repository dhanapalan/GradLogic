import { Request, Response, NextFunction } from "express";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ApiResponse } from "../types/index.js";
import { env } from "../config/env.js";
import { assignDefaultModulesToCollege } from "../services/platformModules.service.js";

// ────────────────────────────────────────────────────────────────────
// METRICS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const getPlatformMetrics = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const [
      collegesResult,
      studentsResult,
      activeUsersResult,
      questionsResult,
      testsResult,
      certificationsResult,
      approvalsResult,
      placementReadinessResult,
      aiGeneratedResult,
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) as count FROM colleges WHERE deleted_at IS NULL"),
      pool.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'student' AND deleted_at IS NULL"
      ),
      // Logins are recorded in rbac_audit_logs (actor_id/LOGIN_SUCCESS), not the
      // Phase 2 admin audit_logs table — that table only holds RBAC/workflow actions.
      pool.query(
        "SELECT COUNT(DISTINCT actor_id) as count FROM rbac_audit_logs WHERE action = 'LOGIN_SUCCESS' AND created_at > NOW() - INTERVAL '24 hours'"
      ),
      pool.query(
        "SELECT COUNT(*) as count FROM question_bank WHERE deleted_at IS NULL"
      ),
      pool.query(
        "SELECT COUNT(DISTINCT exam_id) as count FROM exam_attempts WHERE status = 'completed' AND deleted_at IS NULL"
      ),
      pool.query(
        "SELECT COUNT(*) as count FROM certifications WHERE deleted_at IS NULL"
      ),
      pool.query(
        "SELECT COUNT(*) as count FROM colleges WHERE status = 'pending' AND deleted_at IS NULL"
      ),
      // exam_attempts has no score column — final scores live in marks_scored.
      pool.query(
        `SELECT COALESCE(AVG(final_score) / 100, 0) as avg_readiness FROM marks_scored`
      ),
      pool.query(
        "SELECT COUNT(*) as count FROM question_bank WHERE 'ai-generated' = ANY(tags) AND deleted_at IS NULL"
      ),
    ]);

    const metrics = {
      totalColleges: parseInt(collegesResult.rows[0]?.count || 0),
      totalStudents: parseInt(studentsResult.rows[0]?.count || 0),
      activeUsers: parseInt(activeUsersResult.rows[0]?.count || 0),
      totalQuestions: parseInt(questionsResult.rows[0]?.count || 0),
      totalTests: parseInt(testsResult.rows[0]?.count || 0),
      certifications: parseInt(certificationsResult.rows[0]?.count || 0),
      pendingApprovals: parseInt(approvalsResult.rows[0]?.count || 0),
      avgPlacementReadiness: parseFloat(placementReadinessResult.rows[0]?.avg_readiness || 0),
      aiGeneratedQuestions: parseInt(aiGeneratedResult.rows[0]?.count || 0),
    };

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

export const getGrowthData = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const [collegeGrowthResult, studentGrowthResult] = await Promise.all([
      pool.query(
        `SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM colleges
        WHERE created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        LIMIT 30`
      ),
      pool.query(
        `SELECT
          DATE(created_at) as date,
          COUNT(*) as count
        FROM users
        WHERE role = 'student' AND created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        LIMIT 30`
      ),
    ]);

    const collegeGrowth = collegeGrowthResult.rows.map((row) => ({
      label: new Date(row.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: parseInt(row.count),
    }));

    const studentGrowth = studentGrowthResult.rows.map((row) => ({
      label: new Date(row.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      value: parseInt(row.count),
    }));

    res.json({
      success: true,
      data: {
        collegeGrowth,
        studentGrowth,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getSystemAlerts = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const [pendingCollegesResult, failedLoginsResult, reviewQueueResult] =
      await Promise.all([
        pool.query(
          "SELECT COUNT(*) as count FROM colleges WHERE status = 'pending' AND deleted_at IS NULL"
        ),
        pool.query(
          `SELECT COUNT(*) as count FROM rbac_audit_logs
           WHERE action = 'LOGIN_FAILURE' AND created_at > NOW() - INTERVAL '1 hour'`
        ),
        pool.query(
          "SELECT COUNT(*) as count FROM question_bank WHERE 'ai-generated' = ANY(tags) AND status = 'pending' AND deleted_at IS NULL"
        ),
      ]);

    const alerts: Array<{
      id: string;
      type: "info" | "warning" | "error";
      title: string;
      message: string;
      timestamp: string;
    }> = [];
    const now = new Date().toISOString();

    const pendingColleges = parseInt(pendingCollegesResult.rows[0]?.count || 0);
    if (pendingColleges > 0) {
      alerts.push({
        id: "pending-colleges",
        type: "warning",
        title: "College Approvals Pending",
        message: `${pendingColleges} college registration${pendingColleges === 1 ? "" : "s"} awaiting review.`,
        timestamp: now,
      });
    }

    const failedLogins = parseInt(failedLoginsResult.rows[0]?.count || 0);
    if (failedLogins >= 5) {
      alerts.push({
        id: "failed-logins",
        type: "error",
        title: "Elevated Failed Login Attempts",
        message: `${failedLogins} failed login attempts in the last hour — check for brute-force activity.`,
        timestamp: now,
      });
    }

    const pendingReview = parseInt(reviewQueueResult.rows[0]?.count || 0);
    if (pendingReview > 0) {
      alerts.push({
        id: "review-queue",
        type: "info",
        title: "AI Questions Awaiting Review",
        message: `${pendingReview} AI-generated question${pendingReview === 1 ? "" : "s"} in the review queue.`,
        timestamp: now,
      });
    }

    if (alerts.length === 0) {
      alerts.push({
        id: "all-clear",
        type: "info",
        title: "System Running Normally",
        message: "All systems operational. No issues detected.",
        timestamp: now,
      });
    }

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
};

export const getLiveDashboard = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const [
      todayResult,
      yesterdayResult,
      pendingCollegesResult,
      pendingQuestionsResult,
      examTrendResult,
      billingResult,
      failedLoginsResult,
      suspendedResult,
      pendingCollegesCountResult,
      aiPendingResult,
      ai30dResult,
      recentPaymentsResult,
      activeNowResult,
      examsInProgressResult,
    ] = await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL
            AND created_at::date = CURRENT_DATE) AS new_students,
          (SELECT COUNT(*) FROM colleges WHERE deleted_at IS NULL
            AND created_at::date = CURRENT_DATE) AS new_colleges,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL
            AND started_at::date = CURRENT_DATE) AS exam_attempts,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL
            AND status = 'completed' AND completed_at::date = CURRENT_DATE) AS completed_exams,
          (SELECT COUNT(DISTINCT actor_id) FROM rbac_audit_logs
            WHERE action = 'LOGIN_SUCCESS' AND created_at::date = CURRENT_DATE) AS logins`
      ),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL
            AND created_at::date = CURRENT_DATE - 1) AS new_students,
          (SELECT COUNT(*) FROM colleges WHERE deleted_at IS NULL
            AND created_at::date = CURRENT_DATE - 1) AS new_colleges,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL
            AND started_at::date = CURRENT_DATE - 1) AS exam_attempts,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL
            AND status = 'completed' AND completed_at::date = CURRENT_DATE - 1) AS completed_exams,
          (SELECT COUNT(DISTINCT actor_id) FROM rbac_audit_logs
            WHERE action = 'LOGIN_SUCCESS' AND created_at::date = CURRENT_DATE - 1) AS logins`
      ),
      pool.query(
        `SELECT id, name, email, city, state, created_at
         FROM colleges
         WHERE status = 'pending' AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT id, question_text, category, difficulty_level, created_at
         FROM question_bank
         WHERE 'ai-generated' = ANY(tags) AND status = 'pending' AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT TO_CHAR(started_at::date, 'Dy') AS label, COUNT(*) AS value
         FROM exam_attempts
         WHERE deleted_at IS NULL AND started_at >= NOW() - INTERVAL '7 days'
         GROUP BY started_at::date
         ORDER BY started_at::date`
      ),
      pool.query(
        `SELECT COUNT(*) AS pending FROM student_payments WHERE status = 'pending'`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM rbac_audit_logs
         WHERE action = 'LOGIN_FAILURE' AND created_at > NOW() - INTERVAL '1 hour'`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM colleges WHERE status = 'suspended' AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM colleges WHERE status = 'pending' AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM question_bank
         WHERE 'ai-generated' = ANY(tags) AND status = 'pending' AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM question_bank
         WHERE 'ai-generated' = ANY(tags) AND deleted_at IS NULL
           AND created_at > NOW() - INTERVAL '30 days'`
      ),
      pool.query(
        `SELECT sp.id, sp.amount, sp.status, u.full_name AS student_name, c.name AS college_name, sp.updated_at
         FROM student_payments sp
         LEFT JOIN users u ON u.id = sp.student_id
         LEFT JOIN colleges c ON c.id = sp.college_id
         WHERE sp.status = 'pending'
         ORDER BY sp.updated_at DESC
         LIMIT 5`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT actor_id) AS count FROM rbac_audit_logs
         WHERE action = 'LOGIN_SUCCESS' AND created_at > NOW() - INTERVAL '15 minutes'`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM exam_attempts
         WHERE deleted_at IS NULL AND status = 'in_progress'`
      ),
    ]);

    const today = todayResult.rows[0];
    const yesterday = yesterdayResult.rows[0];

    const actionItems = [
      ...pendingCollegesResult.rows.map((row: any) => ({
        id: `college-${row.id}`,
        entityId: row.id,
        type: "college" as const,
        title: row.name,
        subtitle: row.email || [row.city, row.state].filter(Boolean).join(", ") || "New registration",
        createdAt: row.created_at,
        href: `/app/superadmin/colleges/${row.id}`,
      })),
      ...pendingQuestionsResult.rows.map((row: any) => ({
        id: `question-${row.id}`,
        entityId: row.id,
        type: "question" as const,
        title: row.question_text?.slice(0, 80) + (row.question_text?.length > 80 ? "…" : ""),
        subtitle: `${row.category} · ${row.difficulty_level}`,
        createdAt: row.created_at,
        href: "/app/superadmin/approvals",
      })),
      ...recentPaymentsResult.rows.map((row: any) => ({
        id: `payment-${row.id}`,
        entityId: row.id,
        type: "payment" as const,
        title: row.student_name || "Student payment",
        subtitle: `${row.college_name || "Unknown college"} · ₹${row.amount}`,
        createdAt: row.updated_at,
        href: "/app/superadmin/billing",
      })),
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({
      success: true,
      data: {
        updatedAt: new Date().toISOString(),
        today: {
          newStudents: parseInt(today.new_students || 0),
          newColleges: parseInt(today.new_colleges || 0),
          examAttempts: parseInt(today.exam_attempts || 0),
          completedExams: parseInt(today.completed_exams || 0),
          logins: parseInt(today.logins || 0),
        },
        yesterday: {
          newStudents: parseInt(yesterday.new_students || 0),
          newColleges: parseInt(yesterday.new_colleges || 0),
          examAttempts: parseInt(yesterday.exam_attempts || 0),
          completedExams: parseInt(yesterday.completed_exams || 0),
          logins: parseInt(yesterday.logins || 0),
        },
        activeNow: parseInt(activeNowResult.rows[0]?.count || 0),
        examsInProgress: parseInt(examsInProgressResult.rows[0]?.count || 0),
        examTrend: examTrendResult.rows.map((row: any) => ({
          label: row.label,
          value: parseInt(row.value),
        })),
        actionItems,
        counts: {
          pendingColleges: parseInt(pendingCollegesCountResult.rows[0]?.count || 0),
          pendingQuestions: parseInt(aiPendingResult.rows[0]?.count || 0),
          pendingPayments: parseInt(billingResult.rows[0]?.pending || 0),
          failedLoginsLastHour: parseInt(failedLoginsResult.rows[0]?.count || 0),
          suspendedColleges: parseInt(suspendedResult.rows[0]?.count || 0),
          aiGenerated30d: parseInt(ai30dResult.rows[0]?.count || 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

function buildAlertsFromCounts(counts: {
  pendingColleges: number;
  pendingQuestions: number;
  failedLoginsLastHour: number;
}) {
  const alerts: Array<{
    id: string;
    type: "info" | "warning" | "error";
    title: string;
    message: string;
    timestamp: string;
  }> = [];
  const now = new Date().toISOString();

  if (counts.pendingColleges > 0) {
    alerts.push({
      id: "pending-colleges",
      type: "warning",
      title: "College Approvals Pending",
      message: `${counts.pendingColleges} college registration${counts.pendingColleges === 1 ? "" : "s"} awaiting review.`,
      timestamp: now,
    });
  }
  if (counts.failedLoginsLastHour >= 5) {
    alerts.push({
      id: "failed-logins",
      type: "error",
      title: "Elevated Failed Login Attempts",
      message: `${counts.failedLoginsLastHour} failed login attempts in the last hour.`,
      timestamp: now,
    });
  }
  if (counts.pendingQuestions > 0) {
    alerts.push({
      id: "review-queue",
      type: "info",
      title: "AI Questions Awaiting Review",
      message: `${counts.pendingQuestions} AI-generated question${counts.pendingQuestions === 1 ? "" : "s"} in the review queue.`,
      timestamp: now,
    });
  }
  return alerts;
}

/** Single round-trip bundle for the superadmin dashboard (reduces client polling cost). */
export const getDashboard = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const [
      metricsResult,
      collegeGrowthResult,
      studentGrowthResult,
      liveToday,
      liveYesterday,
      pendingCollegesResult,
      pendingQuestionsResult,
      examTrendResult,
      billingPendingResult,
      failedLoginsResult,
      suspendedResult,
      pendingCollegesCountResult,
      aiPendingResult,
      ai30dResult,
      recentPaymentsResult,
      activeNowResult,
      examsInProgressResult,
      auditResult,
      topCollegesResult,
      billingTotalsResult,
      feeRow,
      yearRow,
    ] = await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM colleges WHERE deleted_at IS NULL) AS total_colleges,
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL) AS total_students,
          (SELECT COUNT(DISTINCT actor_id) FROM rbac_audit_logs
            WHERE action = 'LOGIN_SUCCESS' AND created_at > NOW() - INTERVAL '24 hours') AS active_users,
          (SELECT COUNT(*) FROM question_bank WHERE deleted_at IS NULL) AS total_questions,
          (SELECT COUNT(DISTINCT exam_id) FROM exam_attempts
            WHERE status = 'completed' AND deleted_at IS NULL) AS total_tests,
          (SELECT COUNT(*) FROM certifications WHERE deleted_at IS NULL) AS certifications,
          (SELECT COUNT(*) FROM colleges WHERE status = 'pending' AND deleted_at IS NULL) AS pending_approvals,
          (SELECT COALESCE(AVG(final_score) / 100, 0) FROM marks_scored) AS avg_readiness,
          (SELECT COUNT(*) FROM question_bank
            WHERE 'ai-generated' = ANY(tags) AND deleted_at IS NULL) AS ai_generated`
      ),
      pool.query(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM colleges
         WHERE created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL
         GROUP BY DATE(created_at) ORDER BY DATE(created_at) LIMIT 30`
      ),
      pool.query(
        `SELECT DATE(created_at) AS date, COUNT(*) AS count FROM users
         WHERE role = 'student' AND created_at > NOW() - INTERVAL '30 days' AND deleted_at IS NULL
         GROUP BY DATE(created_at) ORDER BY DATE(created_at) LIMIT 30`
      ),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL AND created_at::date = CURRENT_DATE) AS new_students,
          (SELECT COUNT(*) FROM colleges WHERE deleted_at IS NULL AND created_at::date = CURRENT_DATE) AS new_colleges,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL AND started_at::date = CURRENT_DATE) AS exam_attempts,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL AND status = 'completed' AND completed_at::date = CURRENT_DATE) AS completed_exams,
          (SELECT COUNT(DISTINCT actor_id) FROM rbac_audit_logs WHERE action = 'LOGIN_SUCCESS' AND created_at::date = CURRENT_DATE) AS logins`
      ),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL AND created_at::date = CURRENT_DATE - 1) AS new_students,
          (SELECT COUNT(*) FROM colleges WHERE deleted_at IS NULL AND created_at::date = CURRENT_DATE - 1) AS new_colleges,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL AND started_at::date = CURRENT_DATE - 1) AS exam_attempts,
          (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL AND status = 'completed' AND completed_at::date = CURRENT_DATE - 1) AS completed_exams,
          (SELECT COUNT(DISTINCT actor_id) FROM rbac_audit_logs WHERE action = 'LOGIN_SUCCESS' AND created_at::date = CURRENT_DATE - 1) AS logins`
      ),
      pool.query(
        `SELECT id, name, email, city, state, created_at FROM colleges
         WHERE status = 'pending' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5`
      ),
      pool.query(
        `SELECT id, question_text, category, difficulty_level, created_at FROM question_bank
         WHERE 'ai-generated' = ANY(tags) AND status = 'pending' AND deleted_at IS NULL
         ORDER BY created_at DESC LIMIT 5`
      ),
      pool.query(
        `SELECT TO_CHAR(started_at::date, 'Dy') AS label, COUNT(*) AS value FROM exam_attempts
         WHERE deleted_at IS NULL AND started_at >= NOW() - INTERVAL '7 days'
         GROUP BY started_at::date ORDER BY started_at::date`
      ),
      pool.query(`SELECT COUNT(*) AS pending FROM student_payments WHERE status = 'pending'`),
      pool.query(
        `SELECT COUNT(*) AS count FROM rbac_audit_logs
         WHERE action = 'LOGIN_FAILURE' AND created_at > NOW() - INTERVAL '1 hour'`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM colleges WHERE status = 'suspended' AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM colleges WHERE status = 'pending' AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM question_bank
         WHERE 'ai-generated' = ANY(tags) AND status = 'pending' AND deleted_at IS NULL`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM question_bank
         WHERE 'ai-generated' = ANY(tags) AND deleted_at IS NULL AND created_at > NOW() - INTERVAL '30 days'`
      ),
      pool.query(
        `SELECT sp.id, sp.amount, u.full_name AS student_name, c.name AS college_name, sp.updated_at
         FROM student_payments sp
         LEFT JOIN users u ON u.id = sp.student_id
         LEFT JOIN colleges c ON c.id = sp.college_id
         WHERE sp.status = 'pending' ORDER BY sp.updated_at DESC LIMIT 5`
      ),
      pool.query(
        `SELECT COUNT(DISTINCT actor_id) AS count FROM rbac_audit_logs
         WHERE action = 'LOGIN_SUCCESS' AND created_at > NOW() - INTERVAL '15 minutes'`
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM exam_attempts WHERE deleted_at IS NULL AND status = 'in_progress'`
      ),
      pool.query(
        `SELECT a.id, a.action, a.resource_type, a.created_at, u.full_name AS user_name, u.email AS user_email
         FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC LIMIT 10`
      ),
      pool.query(
        `SELECT c.id, c.name,
          COUNT(DISTINCT u.id) AS student_count,
          COUNT(DISTINCT ea.id) AS attempts
         FROM colleges c
         LEFT JOIN users u ON u.college_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL
         LEFT JOIN exam_attempts ea ON ea.student_id = u.id AND ea.deleted_at IS NULL
         WHERE c.deleted_at IS NULL
         GROUP BY c.id ORDER BY student_count DESC LIMIT 5`
      ),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL) AS total_students,
          COUNT(*) FILTER (WHERE sp.status = 'paid') AS paid,
          COUNT(*) FILTER (WHERE sp.status = 'pending') AS pending,
          COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'paid'), 0) AS collected
         FROM student_payments sp`
      ),
      queryOne("SELECT value FROM system_settings WHERE key = 'billing.fee_per_student'"),
      queryOne("SELECT value FROM system_settings WHERE key = 'billing.academic_year'"),
    ]);

    const m = metricsResult.rows[0];
    const today = liveToday.rows[0];
    const yesterday = liveYesterday.rows[0];
    const fee = Number(feeRow?.value ?? 500);
    const academicYear = String(yearRow?.value ?? "2026-27").replace(/"/g, "");
    const bt = billingTotalsResult.rows[0] || {};
    const totalStudents = Number(bt.total_students ?? m.total_students ?? 0);

    const counts = {
      pendingColleges: parseInt(pendingCollegesCountResult.rows[0]?.count || 0),
      pendingQuestions: parseInt(aiPendingResult.rows[0]?.count || 0),
      pendingPayments: parseInt(billingPendingResult.rows[0]?.pending || 0),
      failedLoginsLastHour: parseInt(failedLoginsResult.rows[0]?.count || 0),
      suspendedColleges: parseInt(suspendedResult.rows[0]?.count || 0),
      aiGenerated30d: parseInt(ai30dResult.rows[0]?.count || 0),
    };

    const actionItems = [
      ...pendingCollegesResult.rows.map((row: any) => ({
        id: `college-${row.id}`,
        entityId: row.id,
        type: "college" as const,
        title: row.name,
        subtitle: row.email || [row.city, row.state].filter(Boolean).join(", ") || "New registration",
        createdAt: row.created_at,
        href: `/app/superadmin/colleges/${row.id}`,
      })),
      ...pendingQuestionsResult.rows.map((row: any) => ({
        id: `question-${row.id}`,
        entityId: row.id,
        type: "question" as const,
        title: (row.question_text?.slice(0, 80) || "") + (row.question_text?.length > 80 ? "…" : ""),
        subtitle: `${row.category} · ${row.difficulty_level}`,
        createdAt: row.created_at,
        href: "/app/superadmin/approvals",
      })),
      ...recentPaymentsResult.rows.map((row: any) => ({
        id: `payment-${row.id}`,
        entityId: row.id,
        type: "payment" as const,
        title: row.student_name || "Student payment",
        subtitle: `${row.college_name || "Unknown college"} · ₹${row.amount}`,
        createdAt: row.updated_at,
        href: "/app/superadmin/billing",
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const fmtGrowth = (rows: any[]) =>
      rows.map((row) => ({
        label: new Date(row.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        value: parseInt(row.count),
      }));

    res.json({
      success: true,
      data: {
        metrics: {
          totalColleges: parseInt(m.total_colleges || 0),
          totalStudents: parseInt(m.total_students || 0),
          activeUsers: parseInt(m.active_users || 0),
          totalQuestions: parseInt(m.total_questions || 0),
          totalTests: parseInt(m.total_tests || 0),
          certifications: parseInt(m.certifications || 0),
          pendingApprovals: parseInt(m.pending_approvals || 0),
          avgPlacementReadiness: parseFloat(m.avg_readiness || 0),
          aiGeneratedQuestions: parseInt(m.ai_generated || 0),
        },
        growth: {
          collegeGrowth: fmtGrowth(collegeGrowthResult.rows),
          studentGrowth: fmtGrowth(studentGrowthResult.rows),
        },
        live: {
          updatedAt: new Date().toISOString(),
          today: {
            newStudents: parseInt(today.new_students || 0),
            newColleges: parseInt(today.new_colleges || 0),
            examAttempts: parseInt(today.exam_attempts || 0),
            completedExams: parseInt(today.completed_exams || 0),
            logins: parseInt(today.logins || 0),
          },
          yesterday: {
            newStudents: parseInt(yesterday.new_students || 0),
            newColleges: parseInt(yesterday.new_colleges || 0),
            examAttempts: parseInt(yesterday.exam_attempts || 0),
            completedExams: parseInt(yesterday.completed_exams || 0),
            logins: parseInt(yesterday.logins || 0),
          },
          activeNow: parseInt(activeNowResult.rows[0]?.count || 0),
          examsInProgress: parseInt(examsInProgressResult.rows[0]?.count || 0),
          examTrend: examTrendResult.rows.map((row: any) => ({
            label: row.label,
            value: parseInt(row.value),
          })),
          actionItems,
          counts,
        },
        alerts: buildAlertsFromCounts(counts),
        activities: auditResult.rows.map((log: any) => ({
          id: log.id,
          action: log.action,
          user: log.user_name || log.user_email || "System",
          entity: log.resource_type || "Unknown",
          timestamp: log.created_at,
        })),
        colleges: topCollegesResult.rows.map((row: any) => {
          const studentCount = parseInt(row.student_count || 0, 10);
          const attempts = parseInt(row.attempts || 0, 10);
          return {
            id: row.id,
            name: row.name,
            studentCount,
            activityScore: studentCount > 0 ? Math.min(attempts / studentCount, 1) : 0,
          };
        }),
        billing: {
          academic_year: academicYear,
          fee_per_student: fee,
          total_students: totalStudents,
          paid: Number(bt.paid || 0),
          pending: Number(bt.pending || 0),
          collected: Number(bt.collected || 0),
          expected: totalStudents * fee,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// COLLEGES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const listColleges = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { status, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = "SELECT * FROM colleges WHERE deleted_at IS NULL";
    const params: any[] = [];

    if (status && status !== "all") {
      query += " AND status = $" + (params.length + 1);
      params.push(status);
    }

    if (search) {
      query += " AND (name ILIKE $" + (params.length + 1) + " OR email ILIKE $" + (params.length + 1) + ")";
      params.push(`%${search}%`);
    }

    const countResult = await pool.query(query.replace("SELECT *", "SELECT COUNT(*) as total"), params);
    const total = parseInt(countResult.rows[0]?.total || 0);

    query += " ORDER BY created_at DESC LIMIT " + limit + " OFFSET " + offset;
    const result = await pool.query(query, params);

    const collegeIds = result.rows.map((c) => c.id);
    const studentCounts: Record<string, number> = {};
    if (collegeIds.length > 0) {
      const countsResult = await pool.query(
        `SELECT college_id, COUNT(*) as count FROM users
         WHERE college_id = ANY($1) AND role = 'student' AND deleted_at IS NULL
         GROUP BY college_id`,
        [collegeIds]
      );
      for (const row of countsResult.rows) {
        studentCounts[row.college_id] = parseInt(row.count);
      }
    }

    const colleges = result.rows.map((c) => ({
      ...c,
      student_count: studentCounts[c.id] || 0,
    }));

    res.json({
      success: true,
      data: {
        colleges,
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const createCollege = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { name, email, phone, address, city, state, tpoName, tpoEmail, studentLimit } = req.body;

    // Validation
    if (!name || !email || !city || !state) {
      throw new AppError("Missing required fields", 400);
    }

    // Check duplicate email
    const existing = await queryOne(
      "SELECT id FROM colleges WHERE email = $1",
      [email]
    );
    if (existing) {
      throw new AppError("College with this email already exists", 409);
    }

    // college_code is NOT NULL + unique — derive a slug from the name and
    // suffix it if the slug is already taken.
    const baseCode = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    let collegeCode = baseCode;
    const codeTaken = await queryOne(
      "SELECT id FROM colleges WHERE college_code = $1",
      [collegeCode]
    );
    if (codeTaken) {
      collegeCode = `${baseCode}-${Date.now().toString(36)}`;
    }

    const result = await pool.query(
      `INSERT INTO colleges (college_code, name, email, phone, address, city, state, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
       RETURNING *`,
      [collegeCode, name, email, phone, address, city, state]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const getCollege = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await queryOne(
      "SELECT * FROM colleges WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );

    if (!result) {
      throw new AppError("College not found", 404);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getCollegeStudents = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const college = await queryOne(
      "SELECT id, name FROM colleges WHERE id = $1 AND deleted_at IS NULL",
      [id]
    );
    if (!college) {
      throw new AppError("College not found", 404);
    }

    const params: any[] = [id];
    let searchClause = "";
    if (search) {
      params.push(`%${search}%`);
      searchClause = ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR sd.student_identifier ILIKE $${params.length})`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE u.college_id = $1 AND u.role = 'student' AND u.deleted_at IS NULL${searchClause}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.email, u.status, u.is_active, u.created_at,
        sd.student_identifier, sd.degree, sd.specialization, sd.passing_year, sd.cgpa
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE u.college_id = $1 AND u.role = 'student' AND u.deleted_at IS NULL${searchClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
        college,
        students: result.rows,
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateCollege = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, city, state, status } = req.body;

    const result = await pool.query(
      `UPDATE colleges
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           address = COALESCE($4, address),
           city = COALESCE($5, city),
           state = COALESCE($6, state),
           status = COALESCE($7, status),
           updated_at = NOW()
       WHERE id = $8 AND deleted_at IS NULL
       RETURNING *`,
      [name, email, phone, address, city, state, status, id]
    );

    if (result.rows.length === 0) {
      throw new AppError("College not found", 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCollege = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE colleges SET status = 'suspended', updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("College not found", 404);
    }

    res.json({
      success: true,
      message: "College deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const getPendingCollegeRequests = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const result = await pool.query(
      "SELECT * FROM colleges WHERE status = 'pending' AND deleted_at IS NULL ORDER BY created_at DESC"
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const approveCollege = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      `UPDATE colleges
       SET status = 'active', approval_status = 'approved',
           approved_by = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [id, req.user?.userId || null]
    );

    if (result.rows.length === 0) {
      throw new AppError("College not found", 404);
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "APPROVE_COLLEGE",
        "college",
        id,
        req.ip,
        JSON.stringify({ note: note || null }),
      ]
    );

    const hasAssignments = await queryOne(
      `SELECT id FROM college_module_assignments WHERE college_id = $1 LIMIT 1`,
      [id]
    );
    if (!hasAssignments) {
      await assignDefaultModulesToCollege(id as string, req.user?.userId);
    }

    res.json({
      success: true,
      message: "College approved successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const rejectCollege = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError("Rejection reason required", 400);
    }

    const result = await pool.query(
      `UPDATE colleges
       SET status = 'suspended', approval_status = 'rejected',
           rejection_reason = $2, rejection_at = NOW(), updated_at = NOW()
       WHERE id = $1 RETURNING id`,
      [id, reason]
    );

    if (result.rows.length === 0) {
      throw new AppError("College not found", 404);
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "REJECT_COLLEGE",
        "college",
        id,
        req.ip,
        JSON.stringify({ reason }),
      ]
    );

    res.json({
      success: true,
      message: "College rejected successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// QUESTION BANK BULK ACTIONS
// ────────────────────────────────────────────────────────────────────

export const bulkQuestionAction = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { action, questionIds } = req.body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      throw new AppError("questionIds is required and must be a non-empty array", 400);
    }

    if (action !== "publish" && action !== "archive") {
      throw new AppError(`Unknown bulk action: ${action}`, 400);
    }

    const status = action === "publish" ? "published" : "archived";
    const isActive = action === "publish";

    const result = await pool.query(
      `UPDATE question_bank SET status = $1, is_active = $2, updated_at = NOW()
       WHERE id = ANY($3::uuid[]) AND deleted_at IS NULL
       RETURNING id`,
      [status, isActive, questionIds]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        action === "publish" ? "BULK_PUBLISH_QUESTIONS" : "BULK_ARCHIVE_QUESTIONS",
        "question_bank",
        questionIds.join(","),
        req.ip,
        JSON.stringify({ count: result.rows.length }),
      ]
    );

    res.json({
      success: true,
      message: `${result.rows.length} question(s) ${action === "publish" ? "published" : "archived"}`,
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// CATEGORIES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const listCategories = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const result = await pool.query(
      `SELECT
        c.id, c.name, c.slug, c.description, COALESCE(c.is_active, TRUE) as is_active,
        COUNT(q.id) as question_count
       FROM categories c
       LEFT JOIN question_bank q ON q.category::text = c.slug AND q.deleted_at IS NULL
       WHERE c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new AppError("Category name is required", 400);
    }

    const slug = name.toLowerCase().replace(/\s+/g, "-");

    const result = await pool.query(
      `INSERT INTO categories (name, slug, description, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [name, slug, description]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, description, is_active } = req.body;

    const slug = name ? name.toLowerCase().replace(/\s+/g, "-") : undefined;

    const result = await pool.query(
      `UPDATE categories
       SET name = COALESCE($1, name),
           slug = COALESCE($2, slug),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [name, slug, description, is_active, id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Category not found", 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE categories SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Category not found", 404);
    }

    res.json({
      success: true,
      message: "Category deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// REVIEW QUEUE ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const getReviewQueue = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const countResult = await pool.query(
      "SELECT COUNT(*) as total FROM question_bank WHERE 'ai-generated' = ANY(tags) AND status = 'pending'"
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT * FROM question_bank
       WHERE 'ai-generated' = ANY(tags) AND status = 'pending'
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    res.json({
      success: true,
      data: {
        questions: result.rows,
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const approveAIQuestion = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const result = await pool.query(
      "UPDATE question_bank SET status = 'published', updated_at = NOW() WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Question not found", 404);
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "APPROVE_AI_QUESTION",
        "question_bank",
        id,
        req.ip,
        JSON.stringify({ note: note || null }),
      ]
    );

    res.json({
      success: true,
      message: "Question approved and published",
    });
  } catch (error) {
    next(error);
  }
};

export const rejectAIQuestion = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      throw new AppError("Rejection reason required", 400);
    }

    const result = await pool.query(
      "UPDATE question_bank SET status = 'rejected', updated_at = NOW() WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Question not found", 404);
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "REJECT_AI_QUESTION",
        "question_bank",
        id,
        req.ip,
        JSON.stringify({ reason }),
      ]
    );

    res.json({
      success: true,
      message: "Question rejected",
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// ANNOUNCEMENTS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const listAnnouncements = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const result = await pool.query(
      `SELECT id, title, message, type, active, created_at, expires_at
       FROM announcements
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const createAnnouncement = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { title, message, type } = req.body;

    if (!title || !message) {
      throw new AppError("Title and message required", 400);
    }

    const result = await pool.query(
      `INSERT INTO announcements (title, message, type, active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       RETURNING *`,
      [title, message, type]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE announcements SET active = FALSE WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Announcement not found", 404);
    }

    res.json({
      success: true,
      message: "Announcement deactivated",
    });
  } catch (error) {
    next(error);
  }
};

export const activateAnnouncement = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE announcements SET active = TRUE WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Announcement not found", 404);
    }

    res.json({
      success: true,
      message: "Announcement activated",
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const listEmailTemplates = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const result = await pool.query(
      `SELECT id, name, subject, body, variables, created_at
       FROM email_templates
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const createEmailTemplate = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { name, subject, body, variables } = req.body;

    if (!name || !subject || !body) {
      throw new AppError("Name, subject, and body required", 400);
    }

    const result = await pool.query(
      `INSERT INTO email_templates (name, subject, body, variables, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [name, subject, body, variables || []]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const updateEmailTemplate = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { name, subject, body, variables } = req.body;

    const result = await pool.query(
      `UPDATE email_templates
       SET name = COALESCE($1, name),
           subject = COALESCE($2, subject),
           body = COALESCE($3, body),
           variables = COALESCE($4, variables),
           updated_at = NOW()
       WHERE id = $5 AND deleted_at IS NULL
       RETURNING *`,
      [name, subject, body, variables, id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Template not found", 404);
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

export const deleteEmailTemplate = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "UPDATE email_templates SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      throw new AppError("Template not found", 404);
    }

    res.json({
      success: true,
      message: "Template deactivated",
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// ANALYTICS ENDPOINTS
// ────────────────────────────────────────────────────────────────────

export const getAnalyticsPlatform = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const days = Math.min(parseInt((req.query.days as string) || "30", 10) || 30, 365);
    const collegeId = (req.query.college_id as string) || null;

    // When a college filter is set, user/attempt metrics are scoped to that
    // college's students; questions are scoped to those explicitly assigned
    // to the college (question_college_assignments).
    const [summary, usersGrowth, attemptsTrend, questionsByCategory] =
      await Promise.all([
        collegeId
          ? pool.query(
              `SELECT
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND college_id = $1) AS total_users,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND status = 'active' AND college_id = $1) AS active_users,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'student' AND college_id = $1) AS student_count,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role IN ('super_admin','admin','college_admin') AND college_id = $1) AS admin_count,
                1 AS total_colleges,
                (SELECT COUNT(*) FROM question_college_assignments WHERE college_id = $1) AS total_questions,
                (SELECT COUNT(*) FROM exam_attempts ea JOIN users u ON u.id = ea.student_id
                  WHERE ea.deleted_at IS NULL AND u.college_id = $1) AS total_attempts,
                (SELECT COALESCE(ROUND(AVG(ms.final_score)::numeric, 1), 0) FROM marks_scored ms
                  JOIN users u ON u.id = ms.student_id WHERE u.college_id = $1) AS avg_score,
                (SELECT COUNT(*) FROM workflows WHERE deleted_at IS NULL) AS total_workflows,
                (SELECT COUNT(*) FROM roles WHERE deleted_at IS NULL) AS total_roles,
                (SELECT COUNT(*) FROM audit_logs) AS total_audit_logs`,
              [collegeId]
            )
          : pool.query(
              `SELECT
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS total_users,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND status = 'active') AS active_users,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role = 'student') AS student_count,
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL AND role IN ('super_admin','admin','college_admin')) AS admin_count,
                (SELECT COUNT(*) FROM colleges WHERE deleted_at IS NULL) AS total_colleges,
                (SELECT COUNT(*) FROM question_bank WHERE deleted_at IS NULL) AS total_questions,
                (SELECT COUNT(*) FROM exam_attempts WHERE deleted_at IS NULL) AS total_attempts,
                (SELECT COALESCE(ROUND(AVG(final_score)::numeric, 1), 0) FROM marks_scored) AS avg_score,
                (SELECT COUNT(*) FROM workflows WHERE deleted_at IS NULL) AS total_workflows,
                (SELECT COUNT(*) FROM roles WHERE deleted_at IS NULL) AS total_roles,
                (SELECT COUNT(*) FROM audit_logs) AS total_audit_logs`
            ),
        pool.query(
          `SELECT TO_CHAR(created_at::date, 'Mon DD') AS date, COUNT(*) AS new_users
           FROM users
           WHERE deleted_at IS NULL AND created_at >= NOW() - ($1 || ' days')::interval
             ${collegeId ? "AND college_id = $2" : ""}
           GROUP BY created_at::date ORDER BY created_at::date`,
          collegeId ? [days, collegeId] : [days]
        ),
        pool.query(
          `SELECT TO_CHAR(ea.started_at::date, 'Mon DD') AS date, COUNT(*) AS attempts
           FROM exam_attempts ea
           ${collegeId ? "JOIN users u ON u.id = ea.student_id" : ""}
           WHERE ea.deleted_at IS NULL AND ea.started_at >= NOW() - ($1 || ' days')::interval
             ${collegeId ? "AND u.college_id = $2" : ""}
           GROUP BY ea.started_at::date ORDER BY ea.started_at::date`,
          collegeId ? [days, collegeId] : [days]
        ),
        collegeId
          ? pool.query(
              `SELECT qb.category::text AS category, COUNT(*) AS count
               FROM question_bank qb
               JOIN question_college_assignments qca ON qca.question_id = qb.id
               WHERE qb.deleted_at IS NULL AND qca.college_id = $1
               GROUP BY qb.category ORDER BY count DESC`,
              [collegeId]
            )
          : pool.query(
              `SELECT category::text AS category, COUNT(*) AS count
               FROM question_bank WHERE deleted_at IS NULL
               GROUP BY category ORDER BY count DESC`
            ),
      ]);

    res.json({
      success: true,
      data: {
        summary: summary.rows[0],
        users_growth: usersGrowth.rows,
        attempts_trend: attemptsTrend.rows,
        questions_by_category: questionsByCategory.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// ANALYTICS: STUDENT PERFORMANCE
// ────────────────────────────────────────────────────────────────────

export const getAnalyticsStudents = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const collegeId = (req.query.college_id as string) || null;
    const params: any[] = [];
    let collegeClause = "";
    if (collegeId) {
      params.push(collegeId);
      collegeClause = `AND u.college_id = $${params.length}`;
    }

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.email,
        c.name AS college_name,
        COUNT(DISTINCT ms.id) AS exams_taken,
        COALESCE(ROUND(AVG(ms.final_score)::numeric, 1), 0) AS avg_score,
        MAX(ms.created_at) AS last_exam_at
       FROM users u
       LEFT JOIN colleges c ON c.id = u.college_id
       LEFT JOIN marks_scored ms ON ms.student_id = u.id
       WHERE u.role = 'student' AND u.deleted_at IS NULL ${collegeClause}
       GROUP BY u.id, c.name
       ORDER BY avg_score DESC, u.name ASC
       LIMIT 1000`,
      params
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// AI USAGE MONITORING (per college)
// ────────────────────────────────────────────────────────────────────

export const getAIUsage = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const [totals, perCollege, recentImports] = await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM question_bank WHERE 'ai-generated' = ANY(tags) AND deleted_at IS NULL) AS ai_questions_total,
          (SELECT COUNT(*) FROM question_bank WHERE 'ai-generated' = ANY(tags) AND deleted_at IS NULL
            AND created_at > NOW() - INTERVAL '30 days') AS ai_questions_30d,
          (SELECT COUNT(*) FROM audit_logs WHERE action = 'IMPORT_AI_QUESTIONS'
            AND created_at > NOW() - INTERVAL '30 days') AS import_batches_30d`
      ),
      pool.query(
        `SELECT
          c.id, c.name,
          COUNT(DISTINCT qca.question_id) FILTER (
            WHERE 'ai-generated' = ANY(qb.tags)
          ) AS ai_questions_assigned,
          COUNT(DISTINCT qca.question_id) AS questions_assigned,
          (SELECT COUNT(*) FROM users u WHERE u.college_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL) AS student_count
         FROM colleges c
         LEFT JOIN question_college_assignments qca ON qca.college_id = c.id
         LEFT JOIN question_bank qb ON qb.id = qca.question_id AND qb.deleted_at IS NULL
         WHERE c.deleted_at IS NULL
         GROUP BY c.id
         ORDER BY ai_questions_assigned DESC, c.name`
      ),
      pool.query(
        `SELECT al.created_at, al.changes, u.name AS actor
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE al.action = 'IMPORT_AI_QUESTIONS'
         ORDER BY al.created_at DESC
         LIMIT 10`
      ),
    ]);

    res.json({
      success: true,
      data: {
        totals: totals.rows[0],
        per_college: perCollege.rows,
        recent_imports: recentImports.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// AI SERVICES REGISTRY (status only — keys stay in environment config)
// ────────────────────────────────────────────────────────────────────

export const getAIServices = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    // Never return a key value — only whether it's set and its last 4 chars,
    // enough to confirm which key is loaded without exposing the secret.
    const mask = (v?: string) => (v && v.length >= 4 ? v.slice(-4) : null);
    const engineUrl = process.env.QUESTION_ENGINE_URL || "http://host.docker.internal:8001";

    // Live-check only the local/cheap services — never call a paid LLM API on
    // page load. Anthropic/OpenAI/Vapi report key presence without a network hit.
    const [engineCheck, judge0Check, modelRow] = await Promise.allSettled([
      fetch(`${engineUrl}/health`, { signal: AbortSignal.timeout(3000) }).then(async (r) =>
        r.ok ? ((await r.json()) as any) : null
      ),
      fetch(`${env.JUDGE0_API_URL}/about`, { signal: AbortSignal.timeout(3000) }).then((r) => r.ok),
      queryOne<{ value: any }>("SELECT value FROM system_settings WHERE key = 'ai.model'"),
    ]);

    const engineHealth =
      engineCheck.status === "fulfilled" ? engineCheck.value : null;
    const engineOnline = !!engineHealth;
    const judge0Online = judge0Check.status === "fulfilled" ? judge0Check.value : false;
    const qbModel =
      modelRow.status === "fulfilled" && modelRow.value?.value
        ? String(modelRow.value.value).replace(/^"|"$/g, "")
        : null;

    const services = [
      {
        key: "question_bank",
        name: "Question Bank",
        purpose: "AI question generation",
        provider: "groq",
        model: qbModel,
        key_location: "ai-engine/question_bank_engine/.env · GROQ_API_KEY",
        configured: engineOnline && engineHealth?.components?.llm === "healthy",
        last4: null,
        reachable: engineOnline,
        testable: true,
        components: engineHealth?.components || null,
        used_by: ["AI Question Generator", "Question bank RAG search", "Document ingestion"],
        note: "Key is held by the Python engine; status is read from its health check.",
      },
      {
        key: "voice_interview",
        name: "Voice Interview",
        purpose: "Student voice mock interviews",
        provider: "vapi",
        model: env.ANTHROPIC_MODEL,
        key_location: "server .env · VAPI_API_KEY (+ VAPI_PUBLIC_KEY)",
        configured: !!env.VAPI_API_KEY,
        last4: mask(env.VAPI_API_KEY),
        reachable: null,
        testable: !!env.VAPI_API_KEY,
        components: null,
        used_by: ["Student voice mock interviews", "Live interview transcripts"],
        note: env.VAPI_PUBLIC_KEY ? "Public key is also set." : "Public key is not set.",
      },
      {
        key: "resume_extraction",
        name: "Resume & Feedback",
        purpose: "Resume parsing, plan and interview feedback",
        provider: "anthropic",
        model: env.ANTHROPIC_MODEL,
        key_location: "server .env · ANTHROPIC_API_KEY",
        configured: !!env.ANTHROPIC_API_KEY,
        last4: mask(env.ANTHROPIC_API_KEY),
        reachable: null,
        testable: !!env.ANTHROPIC_API_KEY,
        components: null,
        used_by: ["Resume parsing", "Learning plan generation", "Interview feedback scoring"],
        note: null,
      },
      {
        key: "drive_generation",
        name: "Drive Question Fallback",
        purpose: "Legacy drive question generation",
        provider: "openai",
        model: env.OPENAI_MODEL,
        key_location: "server .env · OPENAI_API_KEY",
        configured: !!env.OPENAI_API_KEY,
        last4: mask(env.OPENAI_API_KEY),
        reachable: null,
        testable: !!env.OPENAI_API_KEY,
        components: null,
        used_by: ["Assessment drive question generation (fallback)"],
        note: "Optional — a built-in mock generator is used when unset.",
      },
      {
        key: "code_execution",
        name: "Code Execution",
        purpose: "Coding-challenge sandbox",
        provider: "judge0",
        model: null,
        key_location: "server .env · JUDGE0_API_KEY (optional for self-hosted)",
        configured: judge0Online || !!env.JUDGE0_API_KEY,
        last4: mask(env.JUDGE0_API_KEY),
        reachable: judge0Online,
        testable: true,
        components: null,
        used_by: ["Coding-challenge evaluation", "Code sandbox execution"],
        note: "Self-hosted Judge0 needs no key.",
      },
    ];

    res.json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

// POST /api/superadmin/ai-services/:key/test — live-validate one service on
// demand. Uses free endpoints (models list, health, about) — never a paid
// generation call. Keys are read from env and never returned.
export const testAIService = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  const started = Date.now();
  const finish = (ok: boolean, message: string) =>
    res.json({ success: true, data: { ok, message, latency_ms: Date.now() - started } });

  try {
    const { key } = req.params;

    switch (key) {
      case "question_bank": {
        const url = process.env.QUESTION_ENGINE_URL || "http://host.docker.internal:8001";
        const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
        if (!r.ok) return finish(false, `Engine returned ${r.status}`);
        const body = (await r.json()) as any;
        const llmOk = body?.components?.llm === "healthy";
        return finish(llmOk, llmOk ? "Engine healthy · LLM reachable" : "Engine up but LLM unhealthy");
      }
      case "code_execution": {
        const r = await fetch(`${env.JUDGE0_API_URL}/about`, { signal: AbortSignal.timeout(5000) });
        return finish(r.ok, r.ok ? "Judge0 reachable" : `Judge0 returned ${r.status}`);
      }
      case "resume_extraction": {
        if (!env.ANTHROPIC_API_KEY) return finish(false, "ANTHROPIC_API_KEY is not set");
        const r = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
          signal: AbortSignal.timeout(5000),
        });
        return finish(r.ok, r.ok ? "Anthropic key valid" : `Anthropic returned ${r.status} (check the key)`);
      }
      case "drive_generation": {
        if (!env.OPENAI_API_KEY) return finish(false, "OPENAI_API_KEY is not set");
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
          signal: AbortSignal.timeout(5000),
        });
        return finish(r.ok, r.ok ? "OpenAI key valid" : `OpenAI returned ${r.status} (check the key)`);
      }
      case "voice_interview": {
        if (!env.VAPI_API_KEY) return finish(false, "VAPI_API_KEY is not set");
        const r = await fetch("https://api.vapi.ai/assistant?limit=1", {
          headers: { Authorization: `Bearer ${env.VAPI_API_KEY}` },
          signal: AbortSignal.timeout(5000),
        });
        return finish(r.ok, r.ok ? "Vapi key valid" : `Vapi returned ${r.status} (check the key)`);
      }
      default:
        return finish(false, "Unknown service");
    }
  } catch (err: any) {
    if (err?.name === "TimeoutError") return finish(false, "Timed out after 5s");
    if (err?.cause?.code === "ECONNREFUSED") return finish(false, "Connection refused — service offline");
    return next(err);
  }
};

// ────────────────────────────────────────────────────────────────────
// BACKUP EXPORT
// ────────────────────────────────────────────────────────────────────

export const exportBackup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // JSON export of core platform data. Passwords and other secrets are
    // excluded. Row caps keep the response bounded on large databases.
    const CAP = 10000;
    const [settings, colleges, users, questions, workflows, steps] = await Promise.all([
      pool.query("SELECT key, value, updated_at FROM system_settings ORDER BY key"),
      pool.query(`SELECT * FROM colleges WHERE deleted_at IS NULL LIMIT ${CAP}`),
      pool.query(
        `SELECT id, role, name, email, is_active, status, college_id, created_at
         FROM users WHERE deleted_at IS NULL LIMIT ${CAP}`
      ),
      pool.query(
        `SELECT id, category, type, difficulty_level, question_text, options,
                correct_answer, explanation, marks, tags, status, bloom_level, created_at
         FROM question_bank WHERE deleted_at IS NULL LIMIT ${CAP}`
      ),
      pool.query(`SELECT * FROM workflows WHERE deleted_at IS NULL LIMIT ${CAP}`),
      pool.query(`SELECT * FROM workflow_steps LIMIT ${CAP}`),
    ]);

    const exportedAt = new Date().toISOString();

    await pool.query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('backup.last_run_at', to_jsonb($1::text), NOW())
       ON CONFLICT (key) DO UPDATE SET value = to_jsonb($1::text), updated_at = NOW()`,
      [exportedAt]
    );

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        req.user?.userId || "system",
        "BACKUP_EXPORT",
        "system",
        null,
        req.ip,
        JSON.stringify({
          colleges: colleges.rows.length,
          users: users.rows.length,
          questions: questions.rows.length,
          workflows: workflows.rows.length,
        }),
      ]
    );

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="gradlogic-backup-${exportedAt.slice(0, 10)}.json"`
    );
    res.json({
      exported_at: exportedAt,
      settings: settings.rows,
      colleges: colleges.rows,
      users: users.rows,
      question_bank: questions.rows,
      workflows: workflows.rows,
      workflow_steps: steps.rows,
    });
  } catch (error) {
    next(error);
  }
};

export const getAnalyticsColleges = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const result = await pool.query(
      `SELECT
        c.id, c.name, c.status,
        COUNT(DISTINCT u.id) AS student_count,
        COUNT(DISTINCT ea.id) AS attempts,
        COALESCE(ROUND(AVG(ms.final_score)::numeric, 1), 0) AS avg_score,
        COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'paid') AS paid_students,
        COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'paid'), 0) AS collected
       FROM colleges c
       LEFT JOIN users u ON u.college_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL
       LEFT JOIN exam_attempts ea ON ea.student_id = u.id AND ea.deleted_at IS NULL
       LEFT JOIN marks_scored ms ON ms.student_id = u.id
       LEFT JOIN student_payments sp ON sp.student_id = u.id
       WHERE c.deleted_at IS NULL
       GROUP BY c.id
       ORDER BY student_count DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// BILLING SUMMARY
// ────────────────────────────────────────────────────────────────────

export const getBillingSummary = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const feeRow = await queryOne(
      "SELECT value FROM system_settings WHERE key = 'billing.fee_per_student'"
    );
    const yearRow = await queryOne(
      "SELECT value FROM system_settings WHERE key = 'billing.academic_year'"
    );
    const fee = Number(feeRow?.value ?? 500);
    const academicYear =
      (req.query.year as string) || String(yearRow?.value ?? "2026-27").replace(/"/g, "");

    const [totals, byCollege, recent] = await Promise.all([
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM users WHERE role = 'student' AND deleted_at IS NULL) AS total_students,
          COUNT(*) FILTER (WHERE sp.status = 'paid') AS paid,
          COUNT(*) FILTER (WHERE sp.status = 'pending') AS pending,
          COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'paid'), 0) AS collected
         FROM student_payments sp
         WHERE sp.academic_year = $1`,
        [academicYear]
      ),
      pool.query(
        `SELECT
          c.id, c.name,
          COUNT(DISTINCT u.id) AS students,
          COUNT(DISTINCT sp.id) FILTER (WHERE sp.status = 'paid') AS paid,
          COALESCE(SUM(sp.amount) FILTER (WHERE sp.status = 'paid'), 0) AS collected
         FROM colleges c
         LEFT JOIN users u ON u.college_id = c.id AND u.role = 'student' AND u.deleted_at IS NULL
         LEFT JOIN student_payments sp ON sp.college_id = c.id AND sp.academic_year = $1
         WHERE c.deleted_at IS NULL
         GROUP BY c.id
         ORDER BY collected DESC`,
        [academicYear]
      ),
      pool.query(
        `SELECT sp.id, sp.amount, sp.status, sp.payment_method, sp.paid_at,
                u.full_name AS student_name, c.name AS college_name
         FROM student_payments sp
         LEFT JOIN users u ON u.id = sp.student_id
         LEFT JOIN colleges c ON c.id = sp.college_id
         WHERE sp.academic_year = $1
         ORDER BY sp.updated_at DESC
         LIMIT 10`,
        [academicYear]
      ),
    ]);

    const t = totals.rows[0];
    res.json({
      success: true,
      data: {
        academic_year: academicYear,
        fee_per_student: fee,
        total_students: Number(t.total_students),
        paid: Number(t.paid),
        pending: Number(t.pending),
        collected: Number(t.collected),
        expected: Number(t.total_students) * fee,
        by_college: byCollege.rows,
        recent_payments: recent.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// SYSTEM SETTINGS (key/value)
// ────────────────────────────────────────────────────────────────────

export const getSystemSettings = async (
  _req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const result = await pool.query(
      "SELECT key, value, updated_at FROM system_settings ORDER BY key"
    );
    const settings: Record<string, unknown> = {};
    for (const row of result.rows) settings[row.key] = row.value;
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

export const updateSystemSettings = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { settings } = req.body as { settings?: Record<string, unknown> };
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      throw new AppError("Body must include a 'settings' object", 400);
    }

    const userId = (req as Request & { user?: { userId?: string } }).user?.userId || "system";
    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO system_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2::jsonb, NOW(), $3)
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
        [key, JSON.stringify(value), userId]
      );
    }

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, resource_type, changes, ip_address)
       VALUES ($1, 'UPDATE_SETTINGS', 'system_settings', $2, $3)`,
      [userId, JSON.stringify(Object.keys(settings)), req.ip]
    );

    res.json({ success: true, message: "Settings updated" });
  } catch (error) {
    next(error);
  }
};
