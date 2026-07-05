import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ApiResponse } from "../types/index.js";
import { sendNotification } from "../services/notification.service.js";

// ────────────────────────────────────────────────────────────────────
// GET /api/superadmin/students — global roster across all colleges
// ────────────────────────────────────────────────────────────────────
export const listStudents = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const {
      search,
      college_id,
      batch,
      department,
      performance,
      status,
      page = 1,
      limit = 50,
    } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const params: any[] = [];
    const where: string[] = ["u.role = 'student'", "u.deleted_at IS NULL"];

    if (search) {
      params.push(`%${search}%`);
      where.push(
        `(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR sd.student_identifier ILIKE $${params.length})`
      );
    }
    if (college_id) {
      params.push(college_id);
      where.push(`u.college_id = $${params.length}`);
    }
    if (batch) {
      params.push(parseInt(batch as string, 10));
      where.push(`sd.passing_year = $${params.length}`);
    }
    if (department) {
      params.push(`%${department}%`);
      where.push(`sd.specialization ILIKE $${params.length}`);
    }
    if (status && status !== "all") {
      params.push(status);
      where.push(`u.status = $${params.length}`);
    }

    let havingClause = "";
    if (performance === "high") {
      havingClause = "HAVING COALESCE(AVG(ms.final_score), 0) >= 70";
    } else if (performance === "medium") {
      havingClause =
        "HAVING COALESCE(AVG(ms.final_score), 0) >= 40 AND COALESCE(AVG(ms.final_score), 0) < 70";
    } else if (performance === "low") {
      havingClause = "HAVING COALESCE(AVG(ms.final_score), 0) < 40";
    }

    const fromClause = `
      FROM users u
      LEFT JOIN student_details sd ON sd.user_id = u.id
      LEFT JOIN colleges c ON c.id = u.college_id
      LEFT JOIN marks_scored ms ON ms.student_id = u.id
      WHERE ${where.join(" AND ")}
      GROUP BY u.id, sd.id, c.id
      ${havingClause}
    `;

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM (SELECT u.id ${fromClause}) sub`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total || 0);

    const result = await pool.query(
      `SELECT
        u.id, u.name, u.email, u.status, u.is_active, u.created_at, u.last_login,
        c.id as college_id, c.name as college_name,
        sd.student_identifier, sd.specialization as department, sd.passing_year as batch,
        COALESCE(ROUND(AVG(ms.final_score)::numeric, 1), 0) as readiness_score
       ${fromClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      data: {
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

// ────────────────────────────────────────────────────────────────────
// GET /api/superadmin/students/:id — full profile + progress
// ────────────────────────────────────────────────────────────────────
export const getStudentProfile = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const student = await queryOne<{ student_detail_id: string | null }>(
      `SELECT
        u.id, u.name, u.email, u.status, u.is_active, u.created_at, u.last_login,
        c.id as college_id, c.name as college_name,
        sd.id as student_detail_id, sd.student_identifier, sd.degree, sd.specialization,
        sd.passing_year, sd.cgpa, sd.percentage, sd.linkedin_url, sd.github_url, sd.resume_url
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       LEFT JOIN colleges c ON c.id = u.college_id
       WHERE u.id = $1 AND u.role = 'student' AND u.deleted_at IS NULL`,
      [id]
    );

    if (!student) {
      throw new AppError("Student not found", 404);
    }

    const [examResults, certifications, moduleProgress] = await Promise.all([
      pool.query(
        `SELECT e.id, e.title, ms.final_score, ms.created_at
         FROM marks_scored ms
         JOIN exams e ON e.id = ms.exam_id
         WHERE ms.student_id = $1
         ORDER BY ms.created_at DESC`,
        [id]
      ),
      pool.query(
        `SELECT id, title, issued_at FROM certifications
         WHERE student_id = $1 AND deleted_at IS NULL
         ORDER BY issued_at DESC`,
        [id]
      ),
      student.student_detail_id
        ? pool.query(
            `SELECT smp.id, lm.title as module_title, smp.status, smp.score, smp.completed_at
             FROM student_module_progress smp
             JOIN learning_modules lm ON lm.id = smp.module_id
             WHERE smp.student_id = $1
             ORDER BY smp.completed_at DESC NULLS LAST`,
            [student.student_detail_id]
          )
        : Promise.resolve({ rows: [] as any[] }),
    ]);

    res.json({
      success: true,
      data: {
        profile: student,
        examResults: examResults.rows,
        certifications: certifications.rows,
        moduleProgress: moduleProgress.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/superadmin/students/bulk-action
// ────────────────────────────────────────────────────────────────────
export const bulkAction = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { action, studentIds, payload } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError("studentIds is required and must be a non-empty array", 400);
    }

    if (action === "notify") {
      const title = payload?.title || "Notification from GradLogic";
      const message = payload?.message;
      if (!message) {
        throw new AppError("payload.message is required for the notify action", 400);
      }

      await Promise.all(
        studentIds.map((sid: string) => sendNotification(sid, title, message, "info"))
      );

      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.userId || "system",
          "BULK_NOTIFY_STUDENTS",
          "student",
          studentIds.join(","),
          req.ip,
          JSON.stringify({ count: studentIds.length, title }),
        ]
      );

      res.json({ success: true, message: `Notification sent to ${studentIds.length} student(s)` });
    } else if (action === "reset_password") {
      const tempPassword = "ChangeMe123!";
      const hashed = await bcrypt.hash(tempPassword, 12);

      const result = await pool.query(
        `UPDATE users SET password = $1, must_change_password = TRUE, updated_at = NOW()
         WHERE id = ANY($2::uuid[]) AND role = 'student' AND deleted_at IS NULL
         RETURNING id`,
        [hashed, studentIds]
      );

      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, changes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          req.user?.userId || "system",
          "BULK_RESET_PASSWORD",
          "student",
          studentIds.join(","),
          req.ip,
          JSON.stringify({ count: result.rows.length }),
        ]
      );

      res.json({
        success: true,
        message: `Password reset for ${result.rows.length} student(s)`,
      });
    } else if (action === "deactivate") {
      const result = await pool.query(
        `UPDATE users SET status = 'inactive', is_active = FALSE, updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND role = 'student' AND deleted_at IS NULL
         RETURNING id`,
        [studentIds]
      );

      res.json({
        success: true,
        message: `${result.rows.length} student(s) deactivated`,
      });
    } else if (action === "activate") {
      const result = await pool.query(
        `UPDATE users SET status = 'active', is_active = TRUE, updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND role = 'student' AND deleted_at IS NULL
         RETURNING id`,
        [studentIds]
      );

      res.json({
        success: true,
        message: `${result.rows.length} student(s) activated`,
      });
    } else {
      throw new AppError(`Unknown bulk action: ${action}`, 400);
    }
  } catch (error) {
    next(error);
  }
};
