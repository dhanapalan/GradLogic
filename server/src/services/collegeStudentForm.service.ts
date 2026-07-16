/**
 * Sprint 2.2 — Add / Edit Student validation + persistence helpers.
 */
import bcrypt from "bcryptjs";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";

export const PLACEMENT_STATUSES = [
  "Not Shortlisted",
  "Shortlisted",
  "Interviewed",
  "Offered",
  "Joined",
] as const;

export interface StudentFormInput {
  roll_number?: string | null;
  register_number?: string | null;
  name?: string | null;
  gender?: string | null;
  dob?: string | null;
  email?: string | null;
  phone_number?: string | null;
  department?: string | null;
  program?: string | null;
  batch?: string | null;
  semester?: string | null;
  section?: string | null;
  academic_year?: number | string | null;
  cgpa?: number | string | null;
  placement_eligible?: boolean | null;
  placement_status?: string | null;
  password?: string | null;
}

function emptyToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function isValidEmail(v: string | null): boolean {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v: string | null): boolean {
  if (!v) return true;
  return /^\d{7,15}$/.test(v.replace(/[\s\-()+]/g, ""));
}

export async function ensureStudentFormColumns(): Promise<void> {
  await query(`
    ALTER TABLE student_details
      ADD COLUMN IF NOT EXISTS register_number VARCHAR(100),
      ADD COLUMN IF NOT EXISTS semester VARCHAR(50)
  `);
}

export function validateStudentForm(
  body: StudentFormInput,
  mode: "create" | "update"
): {
  roll_number: string;
  register_number: string | null;
  name: string;
  gender: string | null;
  dob: string | null;
  email: string | null;
  phone_number: string | null;
  department: string;
  program: string | null;
  batch: string;
  semester: string | null;
  section: string | null;
  academic_year: number | null;
  cgpa: number | null;
  placement_eligible: boolean | null;
  placement_status: string | null;
} {
  const roll_number = emptyToNull(body.roll_number);
  const name = emptyToNull(body.name);
  const department = emptyToNull(body.department);
  const batch = emptyToNull(body.batch);
  const email = emptyToNull(body.email)?.toLowerCase() ?? null;
  const phone_number = emptyToNull(body.phone_number);
  const register_number = emptyToNull(body.register_number);
  const gender = emptyToNull(body.gender);
  const dob = emptyToNull(body.dob);
  const program = emptyToNull(body.program);
  const semester = emptyToNull(body.semester);
  const section = emptyToNull(body.section);

  if (!roll_number) throw new AppError("Roll Number is required.", 400);
  if (!name) throw new AppError("Student Name is required.", 400);
  if (!department) throw new AppError("Department is required.", 400);
  if (!batch) throw new AppError("Batch is required.", 400);
  if (mode === "create" && !email) throw new AppError("Email is required.", 400);

  if (!isValidEmail(email)) throw new AppError("Enter a valid email address.", 400);
  if (!isValidPhone(phone_number)) {
    throw new AppError("Enter a valid mobile number (7–15 digits).", 400);
  }

  if (gender && !["male", "female", "non_binary", "prefer_not_to_say"].includes(gender)) {
    throw new AppError(
      "Gender must be male, female, non_binary, or prefer_not_to_say.",
      400
    );
  }

  if (dob && Number.isNaN(Date.parse(dob))) {
    throw new AppError("Enter a valid Date of Birth.", 400);
  }

  let academic_year: number | null = null;
  if (body.academic_year !== undefined && body.academic_year !== null && body.academic_year !== "") {
    academic_year = Number(body.academic_year);
    if (!Number.isInteger(academic_year) || academic_year < 1900 || academic_year > 2200) {
      throw new AppError("Academic Year must be a valid year.", 400);
    }
  }

  let cgpa: number | null = null;
  if (body.cgpa !== undefined && body.cgpa !== null && body.cgpa !== "") {
    cgpa = Number(body.cgpa);
    if (Number.isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      throw new AppError("CGPA must be between 0 and 10.", 400);
    }
  }

  let placement_status = emptyToNull(body.placement_status);
  if (
    placement_status &&
    !PLACEMENT_STATUSES.includes(placement_status as (typeof PLACEMENT_STATUSES)[number])
  ) {
    throw new AppError(
      `Placement Status must be one of: ${PLACEMENT_STATUSES.join(", ")}.`,
      400
    );
  }

  let placement_eligible: boolean | null = null;
  if (body.placement_eligible !== undefined && body.placement_eligible !== null) {
    placement_eligible = Boolean(body.placement_eligible);
  }

  return {
    roll_number,
    register_number,
    name,
    gender,
    dob,
    email,
    phone_number,
    department,
    program,
    batch,
    semester,
    section,
    academic_year,
    cgpa,
    placement_eligible,
    placement_status,
  };
}

async function assertUniqueRoll(
  collegeId: string,
  roll: string,
  excludeUserId?: string
) {
  const row = await queryOne<{ user_id: string }>(
    `SELECT user_id FROM student_details
     WHERE college_id = $1
       AND LOWER(TRIM(student_identifier)) = LOWER(TRIM($2))
       AND ($3::uuid IS NULL OR user_id <> $3)
     LIMIT 1`,
    [collegeId, roll, excludeUserId ?? null]
  );
  if (row) {
    throw new AppError("Roll Number must be unique within the college.", 409);
  }
}

export async function createCampusStudent(
  collegeId: string,
  body: StudentFormInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureStudentFormColumns();
  const data = validateStudentForm(body, "create");
  await assertUniqueRoll(collegeId, data.roll_number);

  const college = await queryOne<{ id: string; status: string }>(
    "SELECT id, status FROM colleges WHERE id = $1 AND deleted_at IS NULL",
    [collegeId]
  );
  if (!college) throw new AppError("College not found", 404);
  if (college.status === "suspended") {
    throw new AppError("Cannot add students to a suspended college", 400);
  }
  if (college.status !== "active") {
    throw new AppError("Can only add students to an active college", 400);
  }

  const existing = await queryOne(
    "SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL",
    [data.email!]
  );
  if (existing) throw new AppError("Email already in use", 409);

  const tempPassword =
    emptyToNull(body.password) || `Campus${Math.random().toString(36).slice(2, 8)}!`;
  const hashed = await bcrypt.hash(tempPassword, 12);
  const parts = data.name.split(/\s+/);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userRes = await client.query(
      `INSERT INTO users
         (role, name, email, password, college_id, phone_number, dob, is_active, is_profile_complete, must_change_password, status)
       VALUES
         ('student', $1, $2, $3, $4, $5, $6::date, TRUE, FALSE, TRUE, 'active')
       RETURNING id, name, email, college_id, status, created_at`,
      [data.name, data.email, hashed, collegeId, data.phone_number, data.dob]
    );
    const user = userRes.rows[0];
    await client.query(
      `INSERT INTO student_details
         (user_id, college_id, first_name, last_name, student_identifier, register_number,
          phone_number, gender, dob, degree, specialization, class_name, semester, section,
          passing_year, cgpa, eligible_for_hiring, placement_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        user.id,
        collegeId,
        parts[0] || data.name,
        parts.slice(1).join(" ") || "",
        data.roll_number,
        data.register_number,
        data.phone_number,
        data.gender,
        data.dob,
        data.program,
        data.department,
        data.batch,
        data.semester,
        data.section,
        data.academic_year,
        data.cgpa,
        data.placement_eligible ?? false,
        data.placement_status || "Not Shortlisted",
      ]
    );
    await client.query("COMMIT");

    await writeAuditLog({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "STUDENT_CREATED",
      target_type: "student",
      target_id: user.id,
      student_id: user.id,
      reason: "Campus student created",
      metadata: { roll_number: data.roll_number, email: data.email },
      ip_address: actor.ip,
    }).catch(() => {});

    return {
      ...user,
      temporary_password: emptyToNull(body.password) ? undefined : tempPassword,
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function updateCampusStudent(
  collegeId: string,
  userId: string,
  body: StudentFormInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureStudentFormColumns();
  const data = validateStudentForm(body, "update");
  await assertUniqueRoll(collegeId, data.roll_number, userId);

  const existing = await queryOne<{ id: string }>(
    `SELECT sd.id FROM student_details sd
     JOIN users u ON u.id = sd.user_id
     WHERE sd.user_id = $1 AND COALESCE(u.college_id, sd.college_id) = $2`,
    [userId, collegeId]
  );
  if (!existing) throw new AppError("Student not found", 404);

  if (data.email) {
    const clash = await queryOne(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL AND id <> $2`,
      [data.email, userId]
    );
    if (clash) throw new AppError("Email already in use", 409);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE users SET
         name = $1,
         email = COALESCE($2, email),
         phone_number = $3,
         dob = $4::date,
         updated_at = NOW()
       WHERE id = $5`,
      [data.name, data.email, data.phone_number, data.dob, userId]
    );
    await client.query(
      `UPDATE student_details SET
         student_identifier = $1,
         register_number = $2,
         phone_number = $3,
         gender = $4,
         dob = $5::date,
         degree = $6,
         specialization = $7,
         class_name = $8,
         semester = $9,
         section = $10,
         passing_year = $11,
         cgpa = $12,
         eligible_for_hiring = COALESCE($13, eligible_for_hiring),
         placement_status = COALESCE($14, placement_status),
         first_name = $15,
         last_name = $16,
         updated_at = NOW()
       WHERE user_id = $17`,
      [
        data.roll_number,
        data.register_number,
        data.phone_number,
        data.gender,
        data.dob,
        data.program,
        data.department,
        data.batch,
        data.semester,
        data.section,
        data.academic_year,
        data.cgpa,
        data.placement_eligible,
        data.placement_status,
        data.name.split(/\s+/)[0] || data.name,
        data.name.split(/\s+/).slice(1).join(" ") || "",
        userId,
      ]
    );
    await client.query("COMMIT");

    await writeAuditLog({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "STUDENT_UPDATED",
      target_type: "student",
      target_id: userId,
      student_id: userId,
      reason: "Campus student updated",
      metadata: { roll_number: data.roll_number },
      ip_address: actor.ip,
    }).catch(() => {});

    return { id: userId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
