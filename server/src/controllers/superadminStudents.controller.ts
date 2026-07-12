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
        `UPDATE users
         SET status = 'inactive', is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND role = 'student' AND deleted_at IS NULL
         RETURNING id`,
        [studentIds]
      );

      res.json({
        success: true,
        message: `${result.rows.length} student(s) soft-deleted`,
      });
    } else if (action === "activate") {
      const result = await pool.query(
        `UPDATE users
         SET status = 'active', is_active = TRUE, deleted_at = NULL, updated_at = NOW()
         WHERE id = ANY($1::uuid[]) AND role = 'student'
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

// ────────────────────────────────────────────────────────────────────
// POST /api/superadmin/students — create student under a college
// ────────────────────────────────────────────────────────────────────
export const createStudent = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const {
      name,
      email,
      password,
      college_id,
      student_identifier,
      phone_number,
      degree,
      specialization,
      passing_year,
      cgpa,
    } = req.body;

    if (!name || !email || !college_id) {
      throw new AppError("name, email, and college_id are required", 400);
    }

    const college = await queryOne<{ id: string }>(
      "SELECT id FROM colleges WHERE id = $1 AND deleted_at IS NULL",
      [college_id]
    );
    if (!college) throw new AppError("College not found", 404);

    const existing = await queryOne(
      "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
      [email]
    );
    if (existing) throw new AppError("Email already in use", 409);

    const tempPassword = password || "ChangeMe123!";
    const hashed = await bcrypt.hash(tempPassword, 12);
    const nameParts = String(name).trim().split(/\s+/);
    const firstName = nameParts[0] || name;
    const lastName = nameParts.slice(1).join(" ") || "";

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userRes = await client.query(
        `INSERT INTO users
           (role, name, email, password, college_id, is_active, is_profile_complete, must_change_password, status)
         VALUES
           ('student', $1, $2, $3, $4, TRUE, FALSE, TRUE, 'active')
         RETURNING id, name, email, college_id, status, created_at`,
        [name, email, hashed, college_id]
      );
      const user = userRes.rows[0];

      await client.query(
        `INSERT INTO student_details
           (user_id, college_id, first_name, last_name, student_identifier, phone_number,
            degree, specialization, passing_year, cgpa)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user.id,
          college_id,
          firstName,
          lastName,
          student_identifier || null,
          phone_number || null,
          degree || null,
          specialization || null,
          passing_year || null,
          cgpa || null,
        ]
      );

      await client.query("COMMIT");

      await query(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.user?.userId || "system", "CREATE_STUDENT", "student", user.id, req.ip]
      );

      res.status(201).json({
        success: true,
        data: { ...user, temporary_password: password ? undefined : tempPassword },
        message: "Student created successfully",
      });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// POST /api/superadmin/students/bulk-import
// Body: { college_id, students: [{ name, email, student_identifier?, ... }] }
// ────────────────────────────────────────────────────────────────────
export const bulkImport = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { college_id, students } = req.body as {
      college_id?: string;
      students?: Array<Record<string, unknown>>;
    };

    if (!college_id) {
      throw new AppError("college_id is required", 400);
    }
    if (!Array.isArray(students) || students.length === 0) {
      throw new AppError("students array is required", 400);
    }
    if (students.length > 500) {
      throw new AppError("Maximum 500 students per import", 400);
    }

    const college = await queryOne<{ id: string; name: string }>(
      "SELECT id, name FROM colleges WHERE id = $1 AND deleted_at IS NULL",
      [college_id]
    );
    if (!college) throw new AppError("College not found", 404);

    const created: Array<{ user_id: string; email: string; temporary_password: string }> = [];
    const skipped: Array<{ email: string; reason: string }> = [];
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of students) {
        const name = String(row.name || "").trim();
        const email = String(row.email || "").trim().toLowerCase();
        if (!name || !email) {
          skipped.push({ email: email || "(missing)", reason: "name and email required" });
          continue;
        }

        const existing = await client.query(
          `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
          [email]
        );
        if (existing.rows.length) {
          skipped.push({ email, reason: "email already exists" });
          continue;
        }

        const tempPassword = `Campus${Math.random().toString(36).slice(2, 8)}!`;
        const hashed = await bcrypt.hash(tempPassword, 12);
        const parts = name.split(/\s+/);
        const userRes = await client.query(
          `INSERT INTO users
             (role, name, email, password, college_id, is_active, is_profile_complete, must_change_password, status)
           VALUES ('student', $1, $2, $3, $4, TRUE, FALSE, TRUE, 'active')
           RETURNING id`,
          [name, email, hashed, college_id]
        );
        const userId = userRes.rows[0].id;
        await client.query(
          `INSERT INTO student_details
             (user_id, college_id, first_name, last_name, student_identifier, phone_number,
              degree, specialization, passing_year, cgpa)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            userId,
            college_id,
            parts[0] || name,
            parts.slice(1).join(" ") || "",
            row.student_identifier || row.student_id || row.roll_number || null,
            row.phone_number || null,
            row.degree || row.department || null,
            row.specialization || null,
            row.passing_year || row.batch || null,
            row.cgpa || null,
          ]
        );
        created.push({ user_id: userId, email, temporary_password: tempPassword });
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        req.user?.userId || "system",
        "BULK_IMPORT_STUDENTS",
        "college",
        college_id,
        req.ip,
      ]
    ).catch(() => undefined);

    res.status(201).json({
      success: true,
      data: {
        college_id,
        college_name: college.name,
        created_count: created.length,
        skipped_count: skipped.length,
        created,
        skipped,
      },
      message: `Imported ${created.length} student(s) into ${college.name}`,
    });
  } catch (error) {
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// PUT /api/superadmin/students/:id — update student profile
// ────────────────────────────────────────────────────────────────────
export const updateStudent = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      name,
      email,
      college_id,
      status,
      is_active,
      student_identifier,
      phone_number,
      degree,
      specialization,
      passing_year,
      cgpa,
    } = req.body;

    const student = await queryOne(
      `SELECT id FROM users WHERE id = $1 AND role = 'student' AND deleted_at IS NULL`,
      [id]
    );
    if (!student) throw new AppError("Student not found", 404);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userFields: string[] = [];
      const userParams: unknown[] = [];
      let idx = 1;
      const setUser = (col: string, val: unknown) => {
        userFields.push(`${col} = $${idx++}`);
        userParams.push(val);
      };
      if (name !== undefined) setUser("name", name);
      if (email !== undefined) setUser("email", email);
      if (college_id !== undefined) setUser("college_id", college_id);
      if (status !== undefined) setUser("status", status);
      if (is_active !== undefined) setUser("is_active", is_active);
      if (userFields.length > 0) {
        userFields.push("updated_at = NOW()");
        userParams.push(id);
        await client.query(
          `UPDATE users SET ${userFields.join(", ")} WHERE id = $${idx}`,
          userParams
        );
      }

      const detailFields: string[] = [];
      const detailParams: unknown[] = [];
      let dIdx = 1;
      const setDetail = (col: string, val: unknown) => {
        detailFields.push(`${col} = $${dIdx++}`);
        detailParams.push(val);
      };
      if (student_identifier !== undefined) setDetail("student_identifier", student_identifier);
      if (phone_number !== undefined) setDetail("phone_number", phone_number);
      if (degree !== undefined) setDetail("degree", degree);
      if (specialization !== undefined) setDetail("specialization", specialization);
      if (passing_year !== undefined) setDetail("passing_year", passing_year);
      if (cgpa !== undefined) setDetail("cgpa", cgpa);
      if (college_id !== undefined) setDetail("college_id", college_id);
      if (detailFields.length > 0) {
        detailParams.push(id);
        await client.query(
          `UPDATE student_details SET ${detailFields.join(", ")} WHERE user_id = $${dIdx}`,
          detailParams
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, message: "Student updated successfully" });
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      const pg = e as { code?: string; constraint?: string; detail?: string };
      if (pg.code === "23514") {
        // CHECK constraint (passing_year / cgpa) — should be rare after Zod
        const fieldErrors: Record<string, string> = {};
        if (pg.constraint?.includes("passing_year")) {
          fieldErrors.passing_year = "Enter a valid passing year";
        } else if (pg.constraint?.includes("cgpa")) {
          fieldErrors.cgpa = "CGPA must be between 0 and 10";
        }
        throw new AppError(
          Object.values(fieldErrors)[0] || "Invalid student field value",
          400,
          true
        );
      }
      if (pg.code === "23505") {
        throw new AppError("Email already in use", 409);
      }
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    // Attach fieldErrors when AppError was built from CHECK — wrap via response
    if (error instanceof AppError && error.statusCode === 400) {
      const msg = error.message;
      const fieldErrors: Record<string, string> = {};
      if (msg.toLowerCase().includes("passing year")) fieldErrors.passing_year = msg;
      if (msg.toLowerCase().includes("cgpa")) fieldErrors.cgpa = msg;
      if (Object.keys(fieldErrors).length) {
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          message: msg,
          fieldErrors,
        });
      }
    }
    next(error);
  }
};

// ────────────────────────────────────────────────────────────────────
// DELETE /api/superadmin/students/:id — soft delete
// ────────────────────────────────────────────────────────────────────
export const softDeleteStudent = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE users
       SET status = 'inactive', is_active = FALSE, deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND role = 'student' AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    if (result.rows.length === 0) throw new AppError("Student not found", 404);

    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.userId || "system", "SOFT_DELETE_STUDENT", "student", id, req.ip]
    );

    res.json({ success: true, message: "Student soft-deleted successfully" });
  } catch (error) {
    next(error);
  }
};
