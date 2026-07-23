import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { pool } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ApiResponse } from "../types/index.js";
import * as collegeService from "../services/college.service.js";
import { passwordSchema } from "../validators/password.js";

const studentInputSchema = z.object({
  student_id: z.string().trim().min(1, "student_id is required"),
  phone_number: z.string().trim().min(7, "phone_number is required"),
  name: z.string().trim().min(1).optional(),
  email: z.string().email().optional(),
});

const studentsArraySchema = z.array(studentInputSchema).min(1).max(2000);

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  out.push(current.trim());
  return out;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseCsvStudents(csvText: string): collegeService.BulkStudentInput[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    throw new AppError(
      "CSV must include a header row and at least one student row",
      400,
    );
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const studentIdIndex = headers.findIndex((h) =>
    ["studentid", "student_id", "id"].includes(h),
  );
  const phoneIndex = headers.findIndex((h) =>
    ["phonenumber", "phone", "phone_number", "mobilenumber"].includes(h),
  );
  const nameIndex = headers.findIndex((h) => ["name", "studentname"].includes(h));
  const emailIndex = headers.findIndex((h) => ["email", "emailid"].includes(h));

  if (studentIdIndex === -1 || phoneIndex === -1) {
    throw new AppError(
      "CSV header must contain student_id and phone_number columns",
      400,
    );
  }

  const rows: collegeService.BulkStudentInput[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const studentId = cols[studentIdIndex]?.trim() || "";
    const phoneNumber = cols[phoneIndex]?.trim() || "";
    const name = nameIndex >= 0 ? cols[nameIndex]?.trim() : undefined;
    const email = emailIndex >= 0 ? cols[emailIndex]?.trim() : undefined;

    if (!studentId && !phoneNumber) {
      continue;
    }

    if (!studentId || !phoneNumber) {
      throw new AppError(
        `Invalid CSV row at line ${i + 1}: student_id and phone_number are required`,
        400,
      );
    }

    rows.push({
      student_id: studentId,
      phone_number: phoneNumber,
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    });
  }

  return rows;
}

function extractStudentsFromRequest(req: Request): collegeService.BulkStudentInput[] {
  if (req.file?.buffer) {
    return parseCsvStudents(req.file.buffer.toString("utf-8"));
  }

  if (typeof req.body.csv === "string" && req.body.csv.trim().length > 0) {
    return parseCsvStudents(req.body.csv);
  }

  if (Array.isArray(req.body.students)) {
    return studentsArraySchema.parse(req.body.students);
  }

  if (typeof req.body.students === "string") {
    try {
      const parsed = JSON.parse(req.body.students);
      return studentsArraySchema.parse(parsed);
    } catch {
      throw new AppError("students must be a valid JSON array", 400);
    }
  }

  throw new AppError(
    "Provide either a CSV file (students_file) or a JSON students array",
    400,
  );
}

export const addStudents = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const students = extractStudentsFromRequest(req);
    const result = await collegeService.bulkCreateStudents({
      staff_user_id: req.user!.userId,
      students,
    });

    res.status(201).json({
      success: true,
      data: result,
      message: `${result.created_count} student accounts created`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return next(new AppError(err.errors[0]?.message || "Validation failed", 400));
    }
    next(err);
  }
};

export const getStudents = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      throw new AppError("User not associated with a college", 400);
    }

    const { rows } = await pool.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        sd.student_identifier,
        sd.phone_number,
        sd.degree,
        sd.specialization AS major,
        sd.passing_year AS graduation_year,
        sd.cgpa,
        u.is_active
       FROM users u
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE u.college_id = $1 AND LOWER(u.role::text) = 'student'
       ORDER BY u.created_at DESC`,
      [collegeId],
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getAssignedExams = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      throw new AppError("User not associated with a college", 400);
    }

    const { rows } = await pool.query(
      `SELECT 
        e.*,
        NULL::text AS role_title,
        NULL::text AS role_company
       FROM exams e
       JOIN exam_colleges ec ON ec.exam_id = e.id
       WHERE ec.college_id = $1
       ORDER BY e.scheduled_time DESC`,
      [collegeId],
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const getCollegeStats = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      throw new AppError("User not associated with a college", 400);
    }

    // Total Students
    const studentsResult = await pool.query(
      "SELECT COUNT(*)::int as count FROM users WHERE college_id = $1 AND LOWER(role::text) = 'student'",
      [collegeId],
    );

    // Active Assessments
    const assessmentsResult = await pool.query(
      `SELECT COUNT(*)::int as count
       FROM exam_colleges ec
       JOIN exams e ON e.id = ec.exam_id
       WHERE ec.college_id = $1 AND e.is_active = TRUE`,
      [collegeId],
    );

    // Average CGPA
    const cgpaResult = await pool.query(
      "SELECT AVG(cgpa)::float as avg FROM student_details WHERE college_id = $1",
      [collegeId],
    );

    res.json({
      success: true,
      data: {
        total_students: studentsResult.rows[0].count,
        active_assessments: assessmentsResult.rows[0].count,
        avg_cgpa: cgpaResult.rows[0].avg || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getStaff = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      throw new AppError("User not associated with a college", 400);
    }

    const { rows } = await pool.query(
      `SELECT id, name, email, role, department, is_active, created_at
       FROM users
       WHERE college_id = $1 AND role IN ('college_staff', 'college_admin', 'instructor')
       ORDER BY created_at DESC`,
      [collegeId],
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

export const addStaff = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    if (!collegeId) {
      throw new AppError("User not associated with a college", 400);
    }

    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: passwordSchema,
      role: z.enum(["college_staff", "instructor"]).default("college_staff"),
      department: z.string().trim().min(1).optional(),
    });

    const { name, email, password, role, department } = schema.parse(req.body);

    if (role === "instructor") {
      if (!department) {
        throw new AppError("Department is required for faculty accounts.", 400);
      }
      const dept = await pool.query(
        `SELECT id FROM college_departments WHERE college_id = $1 AND LOWER(name) = LOWER($2) AND is_active = TRUE`,
        [collegeId, department],
      );
      if (dept.rows.length === 0) {
        throw new AppError("Unknown department. Add it under Settings → Departments first.", 400);
      }
    }

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      throw new AppError("Email already in use", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role, college_id, department, is_active, is_profile_complete)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
       RETURNING id, name, email, role, department`,
      [name, email, hashedPassword, role, collegeId, role === "instructor" ? department : null],
    );

    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const removeStaff = async (
  req: Request,
  res: Response<ApiResponse>,
  next: NextFunction,
) => {
  try {
    const collegeId = req.user?.college_id;
    const { id } = req.params;

    if (!collegeId) {
      throw new AppError("User not associated with a college", 400);
    }

    // Ensure they are removing staff from THEIR college
    const staff = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND college_id = $2 AND role IN ('college_staff', 'instructor')",
      [id, collegeId],
    );

    if (staff.rows.length === 0) {
      throw new AppError("Staff member not found or cannot be removed", 404);
    }

    await pool.query(
      `UPDATE users
       SET is_active = FALSE, status = 'inactive', deleted_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND college_id = $2 AND role IN ('college_staff', 'instructor')`,
      [id, collegeId],
    );

    res.json({ success: true, message: "Staff member removed successfully" });
  } catch (err) {
    next(err);
  }
};
