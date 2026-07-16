import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne } from "../config/database.js";
import { uploadFile } from "../config/storage.js";
import { AppError } from "../middleware/errorHandler.js";
import { UserRow, ExamRow } from "../types/index.js";

interface RegisterStudentInput {
  name: string;
  email: string;
  password: string;
  college_id: string;
  webcamPhoto?: Express.Multer.File;
}

interface BulkStudentInput {
  name: string;
  email: string;
  password?: string; // Optional, will default to a hashed version of email if missing or just a fixed default
}

type StudentGender = "male" | "female" | "non_binary" | "prefer_not_to_say";

export interface UpdateStudentInput {
  // Existing compatibility fields
  name?: string;
  email?: string;
  college_id?: string;
  phone_number?: string;
  dob?: string | Date | null;
  degree?: string;
  class_name?: string;
  class?: string;
  section?: string;
  major?: string;
  graduation_year?: number;

  // Placement & Eligibility Tracking
  eligible_for_hiring?: boolean;
  placement_status?: string;
  placed_company?: string;
  placement_package?: number;
  is_blacklisted?: boolean;
  is_suspended?: boolean;
  interview_status?: string;
  is_shortlisted?: boolean;
  offer_released?: boolean;
  offer_accepted?: boolean;
  has_joined?: boolean;

  // Talent Intelligence & Segmentation
  segmentation_tags?: string[];
  avg_integrity_score?: number;
  total_violations?: number;
  risk_category?: string;

  // Extended onboarding fields
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: StudentGender;
  alternate_email?: string;
  alternate_phone?: string;
  specialization?: string;
  passing_year?: number;
  cgpa?: number;
  percentage?: number;
  roll_number?: string;
  student_identifier?: string;
  skills?: string[] | string;
  linkedin_url?: string;
  github_url?: string;

  profilePhoto?: Express.Multer.File;
  resumeFile?: Express.Multer.File;
}

interface UpdatableUserRow {
  id: string;
  role: string;
  college_id: string | null;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSkillsInput(value: string[] | string | undefined): string[] | null {
  if (Array.isArray(value)) {
    const skills = value
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return skills.length > 0 ? Array.from(new Set(skills)) : null;
  }

  if (typeof value === "string") {
    const skills = value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    return skills.length > 0 ? Array.from(new Set(skills)) : null;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Student Registration
// ─────────────────────────────────────────────────────────────────────────────

export async function registerStudent(input: RegisterStudentInput) {
  const existing = await queryOne<UserRow>(
    "SELECT id FROM users WHERE email = $1",
    [input.email.toLowerCase()],
  );
  if (existing) {
    throw new AppError("Email already registered", 409);
  }

  const college = await queryOne<{ id: string }>(
    "SELECT id FROM colleges WHERE id = $1",
    [input.college_id],
  );
  if (!college) {
    throw new AppError("Invalid college selection", 400);
  }

  const hashedPassword = await bcrypt.hash(input.password, 12);

  let facePhotoUrl: string | null = null;
  if (input.webcamPhoto) {
    const ext = input.webcamPhoto.originalname.split(".").pop() || "jpg";
    const key = `faces/${uuidv4()}.${ext}`;
    facePhotoUrl = await uploadFile(
      key,
      input.webcamPhoto.buffer,
      input.webcamPhoto.mimetype,
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userResult = await client.query<{
      id: string;
      role: string;
      name: string;
      email: string;
      college_id: string | null;
      is_profile_complete: boolean;
      created_at: Date;
    }>(
      `INSERT INTO users
         (role, name, email, password, college_id, is_active, is_profile_complete)
       VALUES
         ('student', $1, $2, $3, $4, TRUE, FALSE)
       RETURNING id, role, name, email, college_id, is_profile_complete, created_at`,
      [input.name.trim(), input.email.toLowerCase().trim(), hashedPassword, college.id],
    );
    const user = userResult.rows[0];

    const profileResult = await client.query<{ id: string }>(
      `INSERT INTO student_details (user_id, college_id, face_photo_url)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [user.id, college.id, facePhotoUrl],
    );

    await client.query("COMMIT");

    return { user, profile_id: profileResult.rows[0].id };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Shared student analytics used by HR and Campus Admins.
 * Returns core KPIs: total, active, avg score, avg integrity, placements, and high risk students.
 */
export async function getStudentAnalytics(collegeId?: string) {
  let sql = `
      SELECT 
          COUNT(u.id)::int as total_students,
          SUM(CASE WHEN u.is_active THEN 1 ELSE 0 END)::int as active_students,
          ROUND(AVG(COALESCE(sd.cgpa, 0))::numeric, 2)::float as avg_score,
          ROUND(AVG(COALESCE(sd.avg_integrity_score, 0))::numeric, 2)::float as avg_integrity,
          SUM(CASE WHEN sd.placement_status IN ('Shortlisted', 'Interviewed', 'Offered', 'Joined') THEN 1 ELSE 0 END)::int as placed_pipeline_count,
          SUM(CASE WHEN sd.risk_category = 'High' THEN 1 ELSE 0 END)::int as high_risk_count
      FROM users u
      JOIN student_details sd ON u.id = sd.user_id
      WHERE u.role = 'student'
  `;
  const params: any[] = [];

  if (collegeId) {
    sql += ` AND COALESCE(u.college_id, sd.college_id) = $1`;
    params.push(collegeId);
  }

  const stats = await queryOne(sql, params);

  const appearedLatestDrive = Math.floor((stats?.total_students || 0) * 0.7);

  return {
    totalStudents: stats?.total_students || 0,
    activeStudents: stats?.active_students || 0,
    avgScore: stats?.avg_score || 0,
    avgIntegrity: stats?.avg_integrity || 0,
    appearedInLatestDrive: appearedLatestDrive,
    placedPipelineCount: stats?.placed_pipeline_count || 0,
    highRiskCount: stats?.high_risk_count || 0
  };
}

/**
 * Bulk Student Registration
 */
export async function bulkRegisterStudents(collegeId: string | undefined, students: any[]) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const results = [];

    for (const student of students) {
      const email = student.email?.toLowerCase().trim();
      const firstName = student.first_name?.trim();
      const lastName = student.last_name?.trim();
      const name = `${firstName} ${lastName}`;
      const rollNumber = student.roll_number?.trim();
      const collegeName = student.college_name?.trim();

      if (!email || !firstName || !lastName || !rollNumber) {
        continue;
      }

      let currentCollegeId = collegeId;

      // If HR/Admin didn't provide college_id explicitly but provided a college_name in the CSV
      if (!currentCollegeId && collegeName) {
        const collegeRes = await client.query<{ id: string }>(
          "SELECT id FROM colleges WHERE name ILIKE $1",
          [`%${collegeName}%`]
        );
        if (collegeRes.rows.length > 0) {
          currentCollegeId = collegeRes.rows[0].id;
        }
      }

      if (!currentCollegeId) {
        continue;
      }

      // Default password if not provided (e.g. from CSV)
      const rawPassword = student.password || "Welcome@123";
      const hashedPassword = await bcrypt.hash(rawPassword, 12);

      // Check if user exists
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [email]);
      if (existing.rows.length > 0) {
        // Skip or update? For bulk import, let's skip for now or mark as error in result
        continue;
      }

      // Insert User
      const userResult = await client.query<{ id: string }>(
        `INSERT INTO users
           (role, name, email, password, college_id, is_active, is_profile_complete)
         VALUES
           ('student', $1, $2, $3, $4, TRUE, FALSE)
         RETURNING id`,
        [name, email, hashedPassword, currentCollegeId],
      );
      const userId = userResult.rows[0].id;

      const degree = normalizeOptionalString(student.degree);
      const major = normalizeOptionalString(student.major);
      const currentSemester = typeof student.current_semester === 'string' ? student.current_semester.trim() : null;
      const cgpa = student.cgpa ? parseFloat(student.cgpa) : null;
      const tenthPercentage = student.tenth_percentage ? parseFloat(student.tenth_percentage) : null;
      const twelfthPercentage = student.twelfth_percentage ? parseFloat(student.twelfth_percentage) : null;
      const passingYear = student.graduation_year ? parseInt(student.graduation_year, 10) : null;
      const phone = normalizeOptionalString(student.phone);
      const dob = student.date_of_birth ? new Date(student.date_of_birth) : null;
      const gender = normalizeOptionalString(student.gender);
      const technicalSkills = student.technical_skills?.split('|').join(',') || null;
      const programmingLanguages = student.programming_languages?.split('|').join(',') || null;
      const combinedSkills = [technicalSkills, programmingLanguages].filter(Boolean).join(',') || null;
      const linkedinUrl = normalizeOptionalString(student.linkedin_url);
      const githubUrl = normalizeOptionalString(student.github_url);

      // Insert Student Detail
      await client.query(
        `INSERT INTO student_details (
            user_id, college_id, first_name, last_name, student_identifier, 
            phone_number, dob, gender, degree, specialization, class_name,
            passing_year, cgpa, percentage, skills, linkedin_url, github_url
         ) VALUES (
            $1, $2, $3, $4, $5, 
            $6, $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16, $17
         )`,
        [
          userId,
          currentCollegeId,
          firstName,
          lastName,
          rollNumber,
          phone,
          dob,
          gender,
          degree,
          major,
          currentSemester, // Using current_semester for class_name mapping based on old context
          passingYear,
          cgpa,
          Math.max(tenthPercentage || 0, twelfthPercentage || 0) || null, // Best out of percentages if any
          combinedSkills,
          linkedinUrl,
          githubUrl
        ],
      );

      results.push(userId);
    }

    await client.query("COMMIT");
    return { count: results.length };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Exam Schedule for a Student
// ─────────────────────────────────────────────────────────────────────────────

export async function getExamScheduleForStudent(studentUserId: string) {
  const student = await queryOne<{ college_id: string }>(
    "SELECT college_id FROM users WHERE id = $1 AND LOWER(role::text) = 'student'",
    [studentUserId],
  );
  if (!student || !student.college_id) {
    throw new AppError("Student not found", 404);
  }

  const exams = await query<
    ExamRow & {
      scheduled_at: Date;
      role_title: string | null;
      role_company: string | null;
      score: number | null;
    }
  >(
    `SELECT
        e.*,
        e.scheduled_time AS scheduled_at,
        NULL::text AS role_title,
        NULL::text AS role_company,
        ms.final_score AS score
     FROM exams e
     JOIN exam_colleges ec ON ec.exam_id = e.id
     LEFT JOIN marks_scored ms ON ms.exam_id = e.id AND ms.student_id = $1
     WHERE ec.college_id = $2
       AND e.is_active = TRUE
     ORDER BY e.scheduled_time ASC`,
    [studentUserId, student.college_id],
  );

  return exams;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Student profile list + update
// ─────────────────────────────────────────────────────────────────────────────

export async function listStudents(
  limit = 50,
  offset = 0,
  collegeId?: string,
  filters?: { search?: string; placementStatus?: string; riskLevel?: string; status?: string },
) {
  let sql = `
    SELECT
        u.id as user_id,
        u.id,
        u.email,
        u.name,
        u.is_active,
        COALESCE(NULLIF(sd.first_name, ''), SPLIT_PART(COALESCE(u.name, ''), ' ', 1), '') AS first_name,
        NULLIF(sd.middle_name, '') AS middle_name,
        COALESCE(
          NULLIF(sd.last_name, ''),
          NULLIF(TRIM(REGEXP_REPLACE(COALESCE(u.name, ''), '^\\S+\\s*', '')), ''),
          ''
        ) AS last_name,
        COALESCE(u.college_id, sd.college_id) AS college_id,
        u.created_at,
        u.is_profile_complete,
        u.phone_number AS user_phone_number,
        sd.id as student_id,
        sd.phone_number,
        sd.alternate_email,
        sd.alternate_phone,
        sd.dob,
        sd.gender,
        sd.degree,
        sd.specialization,
        sd.specialization AS department,
        sd.specialization AS major,
        sd.class_name,
        sd.section,
        sd.passing_year AS passing_year,
        sd.passing_year AS graduation_year,
        sd.cgpa::float,
        sd.percentage,
        sd.student_identifier AS roll_number,
        sd.student_identifier,
        sd.resume_url,
        sd.skills,
        sd.linkedin_url,
        sd.github_url,
        sd.face_photo_url as avatar,
        sd.face_photo_url AS photo_url,
        sd.eligible_for_hiring,
        COALESCE(sd.placement_status::text, 'Not Shortlisted') as placement_status,
        sd.placed_company,
        sd.placement_package,
        sd.is_blacklisted,
        sd.is_suspended,
        sd.interview_status,
        sd.is_shortlisted,
        sd.offer_released,
        sd.offer_accepted,
        sd.has_joined,
        sd.segmentation_tags,
        COALESCE(sd.avg_integrity_score, 0)::float as avg_integrity,
        0::float as avg_score,
        sd.total_violations,
        COALESCE(sd.risk_category, 'Low') as risk_level,
        sd.risk_category,
        c.name AS college_name
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
     WHERE LOWER(u.role::text) = 'student'
  `;

  const countParams: any[] = [];
  let countSql = `SELECT COUNT(*) FROM users u LEFT JOIN student_details sd ON sd.user_id = u.id WHERE LOWER(u.role::text) = 'student'`;

  // $1 = limit, $2 = offset — dynamic params start at $3
  const params: any[] = [limit, offset];
  let paramIdx = 3;
  let countParamIdx = 1;

  if (collegeId) {
    sql += ` AND COALESCE(u.college_id, sd.college_id) = $${paramIdx} `;
    params.push(collegeId);
    paramIdx++;
    countSql += ` AND COALESCE(u.college_id, sd.college_id) = $${countParamIdx} `;
    countParams.push(collegeId);
    countParamIdx++;
  }

  if (filters?.search) {
    sql += ` AND (u.name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx} OR sd.student_identifier ILIKE $${paramIdx})`;
    params.push(`%${filters.search}%`);
    paramIdx++;
    countSql += ` AND (u.name ILIKE $${countParamIdx} OR u.email ILIKE $${countParamIdx} OR sd.student_identifier ILIKE $${countParamIdx})`;
    countParams.push(`%${filters.search}%`);
    countParamIdx++;
  }

  if (filters?.placementStatus) {
    sql += ` AND sd.placement_status = $${paramIdx}`;
    params.push(filters.placementStatus);
    paramIdx++;
    countSql += ` AND sd.placement_status = $${countParamIdx}`;
    countParams.push(filters.placementStatus);
    countParamIdx++;
  }

  if (filters?.riskLevel) {
    sql += ` AND sd.risk_category = $${paramIdx}`;
    params.push(filters.riskLevel);
    paramIdx++;
    countSql += ` AND sd.risk_category = $${countParamIdx}`;
    countParams.push(filters.riskLevel);
    countParamIdx++;
  }

  if (filters?.status) {
    sql += ` AND u.is_active = $${paramIdx}`;
    params.push(filters.status === "active");
    paramIdx++;
    countSql += ` AND u.is_active = $${countParamIdx}`;
    countParams.push(filters.status === "active");
    countParamIdx++;
  }

  const countResult = await queryOne(countSql, countParams);
  const total = parseInt(countResult?.count || "0", 10);

  sql += ` ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`;

  const data = await query(sql, params);

  return {
    data,
    total
  };
}

export async function getStudentById(studentId: string) {
  const sql = `
    SELECT
        u.id,
        u.email,
        u.name,
        COALESCE(NULLIF(sd.first_name, ''), SPLIT_PART(COALESCE(u.name, ''), ' ', 1), '') AS first_name,
        NULLIF(sd.middle_name, '') AS middle_name,
        COALESCE(
          NULLIF(sd.last_name, ''),
          NULLIF(TRIM(REGEXP_REPLACE(COALESCE(u.name, ''), '^\\S+\\s*', '')), ''),
          ''
        ) AS last_name,
        COALESCE(u.college_id, sd.college_id) AS college_id,
        u.created_at,
        u.is_profile_complete,
        u.phone_number AS user_phone_number,
        sd.phone_number,
        sd.alternate_email,
        sd.alternate_phone,
        sd.dob,
        sd.gender,
        sd.degree,
        sd.specialization,
        sd.specialization AS major,
        sd.class_name,
        sd.section,
        sd.passing_year AS passing_year,
        sd.passing_year AS graduation_year,
        sd.cgpa,
        sd.percentage,
        sd.student_identifier AS roll_number,
        sd.student_identifier,
        sd.resume_url,
        sd.skills,
        sd.linkedin_url,
        sd.github_url,
        sd.face_photo_url AS photo_url,
        sd.eligible_for_hiring,
        sd.placement_status,
        sd.placed_company,
        sd.placement_package,
        sd.is_blacklisted,
        sd.is_suspended,
        sd.interview_status,
        sd.is_shortlisted,
        sd.offer_released,
        sd.offer_accepted,
        sd.has_joined,
        sd.segmentation_tags,
        sd.avg_integrity_score,
        sd.total_violations,
        sd.risk_category,
        c.name AS college_name
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN colleges c ON c.id = COALESCE(u.college_id, sd.college_id)
     WHERE u.id = $1 AND LOWER(u.role::text) = 'student'
  `;

  return queryOne(sql, [studentId]);
}

export async function updateStudent(studentId: string, input: UpdateStudentInput) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingUser = await client.query<UpdatableUserRow>(
      "SELECT id, role, college_id FROM users WHERE id = $1",
      [studentId],
    );
    if (existingUser.rows.length === 0) {
      throw new AppError("Student not found", 404);
    }
    const currentUser = existingUser.rows[0];

    const firstName = normalizeOptionalString(input.first_name);
    const middleName = normalizeOptionalString(input.middle_name);
    const lastName = normalizeOptionalString(input.last_name);
    const fullNameFromParts = [firstName, middleName, lastName].filter(Boolean).join(" ");
    const normalizedName =
      normalizeOptionalString(input.name) ??
      (fullNameFromParts.trim().length > 0 ? fullNameFromParts.trim() : null);

    const normalizedEmail = normalizeOptionalString(input.email)?.toLowerCase() ?? null;
    const primaryPhone = normalizeOptionalString(input.phone_number);
    const alternateEmail = normalizeOptionalString(input.alternate_email)?.toLowerCase() ?? null;
    const alternatePhone = normalizeOptionalString(input.alternate_phone);
    const degree = normalizeOptionalString(input.degree);
    const specialization = normalizeOptionalString(input.specialization ?? input.major);
    const className = normalizeOptionalString(input.class_name ?? input.class);
    const section = normalizeOptionalString(input.section);
    const rollNumber = normalizeOptionalString(input.roll_number ?? input.student_identifier);
    const gender = normalizeOptionalString(input.gender);
    const linkedinUrl = normalizeOptionalString(input.linkedin_url);
    const githubUrl = normalizeOptionalString(input.github_url);
    const skills = normalizeSkillsInput(input.skills);
    const passingYear = input.passing_year ?? input.graduation_year ?? null;
    const cgpa = typeof input.cgpa === "number" ? input.cgpa : null;
    const percentage = typeof input.percentage === "number" ? input.percentage : null;
    const dob = input.dob ?? null;
    const eligibleForHiring = input.eligible_for_hiring;
    const placementStatus = normalizeOptionalString(input.placement_status);
    const placedCompany = normalizeOptionalString(input.placed_company);
    const placementPackage = typeof input.placement_package === "number" ? input.placement_package : null;
    const isBlacklisted = input.is_blacklisted;
    const isSuspended = input.is_suspended;
    const interviewStatus = normalizeOptionalString(input.interview_status);
    const isShortlisted = input.is_shortlisted;
    const offerReleased = input.offer_released;
    const offerAccepted = input.offer_accepted;
    const hasJoined = input.has_joined;
    const segmentationTags = Array.isArray(input.segmentation_tags) ? input.segmentation_tags : undefined;
    const avgIntegrityScore = typeof input.avg_integrity_score === "number" ? input.avg_integrity_score : null;
    const totalViolations = typeof input.total_violations === "number" ? input.total_violations : null;
    const riskCategory = normalizeOptionalString(input.risk_category);

    const resolvedCollegeId =
      normalizeOptionalString(input.college_id) ?? currentUser.college_id;

    if (!resolvedCollegeId) {
      throw new AppError(
        "Student does not have a college mapping. Please assign a college first.",
        400,
      );
    }

    let profilePhotoUrl: string | null = null;
    if (input.profilePhoto) {
      const ext = input.profilePhoto.originalname.split(".").pop() || "jpg";
      const key = `profiles/${studentId}/${uuidv4()}.${ext}`;
      profilePhotoUrl = await uploadFile(
        key,
        input.profilePhoto.buffer,
        input.profilePhoto.mimetype,
      );
    }

    let resumeUrl: string | null = null;
    if (input.resumeFile) {
      const allowedResumeMimeTypes = new Set([
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ]);

      if (!allowedResumeMimeTypes.has(input.resumeFile.mimetype)) {
        throw new AppError("Resume must be a PDF or DOC/DOCX file", 400);
      }
      if (input.resumeFile.size > 2 * 1024 * 1024) {
        throw new AppError("Resume file size must be 2MB or less", 400);
      }

      const ext = input.resumeFile.originalname.split(".").pop() || "pdf";
      const key = `resumes/${studentId}/${uuidv4()}.${ext}`;
      resumeUrl = await uploadFile(
        key,
        input.resumeFile.buffer,
        input.resumeFile.mimetype,
      );
    }

    if (
      input.name !== undefined ||
      input.first_name !== undefined ||
      input.middle_name !== undefined ||
      input.last_name !== undefined ||
      input.email !== undefined ||
      input.college_id !== undefined ||
      input.phone_number !== undefined ||
      input.dob !== undefined
    ) {
      await client.query(
        `UPDATE users
         SET name = COALESCE($1, name),
             email = COALESCE($2, email),
             college_id = COALESCE($3, college_id),
             phone_number = COALESCE($4, phone_number),
             dob = COALESCE($5, dob),
             updated_at = NOW()
         WHERE id = $6`,
        [
          normalizedName,
          normalizedEmail,
          resolvedCollegeId,
          primaryPhone,
          dob,
          studentId,
        ],
      );
    }

    if (
      input.first_name !== undefined ||
      input.middle_name !== undefined ||
      input.last_name !== undefined ||
      input.college_id !== undefined ||
      input.phone_number !== undefined ||
      input.alternate_email !== undefined ||
      input.alternate_phone !== undefined ||
      input.dob !== undefined ||
      input.gender !== undefined ||
      input.degree !== undefined ||
      input.specialization !== undefined ||
      input.major !== undefined ||
      input.class_name !== undefined ||
      input.class !== undefined ||
      input.section !== undefined ||
      input.passing_year !== undefined ||
      input.graduation_year !== undefined ||
      input.cgpa !== undefined ||
      input.percentage !== undefined ||
      input.roll_number !== undefined ||
      input.student_identifier !== undefined ||
      input.skills !== undefined ||
      input.linkedin_url !== undefined ||
      input.github_url !== undefined ||
      input.eligible_for_hiring !== undefined ||
      input.placement_status !== undefined ||
      input.placed_company !== undefined ||
      input.placement_package !== undefined ||
      input.is_blacklisted !== undefined ||
      input.is_suspended !== undefined ||
      input.interview_status !== undefined ||
      input.is_shortlisted !== undefined ||
      input.offer_released !== undefined ||
      input.offer_accepted !== undefined ||
      input.has_joined !== undefined ||
      input.segmentation_tags !== undefined ||
      input.avg_integrity_score !== undefined ||
      input.total_violations !== undefined ||
      input.risk_category !== undefined ||
      profilePhotoUrl !== null ||
      resumeUrl !== null
    ) {
      await client.query(
        `INSERT INTO student_details
            (user_id, college_id, first_name, middle_name, last_name,
             student_identifier, phone_number, alternate_email, alternate_phone,
             dob, gender, degree, specialization, class_name, section,
             passing_year, cgpa, percentage, resume_url, skills,
             linkedin_url, github_url, face_photo_url, updated_at,
             eligible_for_hiring, placement_status, placed_company, placement_package,
             is_blacklisted, is_suspended, interview_status, is_shortlisted, offer_released,
             offer_accepted, has_joined, segmentation_tags, avg_integrity_score,
             total_violations, risk_category)
         VALUES
            ($1, $2, $3, $4, $5,
             $6, $7, $8, $9,
             $10, $11, $12, $13, $14, $15,
             $16, $17, $18, $19, $20,
             $21, $22, $23, NOW(),
             $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38)
         ON CONFLICT (user_id) DO UPDATE
           SET college_id = COALESCE(EXCLUDED.college_id, student_details.college_id),
               first_name = COALESCE(EXCLUDED.first_name, student_details.first_name),
               middle_name = COALESCE(EXCLUDED.middle_name, student_details.middle_name),
               last_name = COALESCE(EXCLUDED.last_name, student_details.last_name),
               student_identifier = COALESCE(EXCLUDED.student_identifier, student_details.student_identifier),
               phone_number = COALESCE(EXCLUDED.phone_number, student_details.phone_number),
               alternate_email = COALESCE(EXCLUDED.alternate_email, student_details.alternate_email),
               alternate_phone = COALESCE(EXCLUDED.alternate_phone, student_details.alternate_phone),
               dob = COALESCE(EXCLUDED.dob, student_details.dob),
               gender = COALESCE(EXCLUDED.gender, student_details.gender),
               degree = COALESCE(EXCLUDED.degree, student_details.degree),
               specialization = COALESCE(EXCLUDED.specialization, student_details.specialization),
               class_name = COALESCE(EXCLUDED.class_name, student_details.class_name),
               section = COALESCE(EXCLUDED.section, student_details.section),
               passing_year = COALESCE(EXCLUDED.passing_year, student_details.passing_year),
               cgpa = COALESCE(EXCLUDED.cgpa, student_details.cgpa),
               percentage = COALESCE(EXCLUDED.percentage, student_details.percentage),
               resume_url = COALESCE(EXCLUDED.resume_url, student_details.resume_url),
               skills = COALESCE(EXCLUDED.skills, student_details.skills),
               linkedin_url = COALESCE(EXCLUDED.linkedin_url, student_details.linkedin_url),
               github_url = COALESCE(EXCLUDED.github_url, student_details.github_url),
               face_photo_url = COALESCE(EXCLUDED.face_photo_url, student_details.face_photo_url),
               eligible_for_hiring = COALESCE(EXCLUDED.eligible_for_hiring, student_details.eligible_for_hiring),
               placement_status = COALESCE(EXCLUDED.placement_status, student_details.placement_status),
               placed_company = COALESCE(EXCLUDED.placed_company, student_details.placed_company),
               placement_package = COALESCE(EXCLUDED.placement_package, student_details.placement_package),
               is_blacklisted = COALESCE(EXCLUDED.is_blacklisted, student_details.is_blacklisted),
               is_suspended = COALESCE(EXCLUDED.is_suspended, student_details.is_suspended),
               interview_status = COALESCE(EXCLUDED.interview_status, student_details.interview_status),
               is_shortlisted = COALESCE(EXCLUDED.is_shortlisted, student_details.is_shortlisted),
               offer_released = COALESCE(EXCLUDED.offer_released, student_details.offer_released),
               offer_accepted = COALESCE(EXCLUDED.offer_accepted, student_details.offer_accepted),
               has_joined = COALESCE(EXCLUDED.has_joined, student_details.has_joined),
               segmentation_tags = COALESCE(EXCLUDED.segmentation_tags, student_details.segmentation_tags),
               avg_integrity_score = COALESCE(EXCLUDED.avg_integrity_score, student_details.avg_integrity_score),
               total_violations = COALESCE(EXCLUDED.total_violations, student_details.total_violations),
               risk_category = COALESCE(EXCLUDED.risk_category, student_details.risk_category),
               updated_at = NOW()`,
        [
          studentId,
          resolvedCollegeId,
          firstName,
          middleName,
          lastName,
          rollNumber,
          primaryPhone,
          alternateEmail,
          alternatePhone,
          dob,
          gender,
          degree,
          specialization,
          className,
          section,
          passingYear,
          cgpa,
          percentage,
          resumeUrl,
          skills,
          linkedinUrl,
          githubUrl,
          profilePhotoUrl,
          eligibleForHiring,
          placementStatus,
          placedCompany,
          placementPackage,
          isBlacklisted,
          isSuspended,
          interviewStatus,
          isShortlisted,
          offerReleased,
          offerAccepted,
          hasJoined,
          segmentationTags,
          avgIntegrityScore,
          totalViolations,
          riskCategory,
        ],
      );
    }

    const profileStatusResult = await client.query<{ is_complete: boolean }>(
      `SELECT EXISTS (
          SELECT 1
          FROM users u
          JOIN student_details sd ON sd.user_id = u.id
          WHERE u.id = $1
            AND LOWER(u.role::text) = 'student'
            AND COALESCE(NULLIF(sd.first_name, ''), NULLIF(SPLIT_PART(COALESCE(u.name, ''), ' ', 1), '')) IS NOT NULL
            AND COALESCE(NULLIF(sd.last_name, ''), NULLIF(TRIM(REGEXP_REPLACE(COALESCE(u.name, ''), '^\\S+\\s*', '')), '')) IS NOT NULL
            AND sd.dob IS NOT NULL
            AND COALESCE(NULLIF(sd.phone_number, ''), NULLIF(u.phone_number, '')) IS NOT NULL
            AND sd.degree IS NOT NULL
            AND sd.specialization IS NOT NULL
            AND sd.passing_year IS NOT NULL
            AND (sd.cgpa IS NOT NULL OR sd.percentage IS NOT NULL)
            AND sd.student_identifier IS NOT NULL
            AND sd.resume_url IS NOT NULL
       ) AS is_complete`,
      [studentId],
    );
    const isComplete = profileStatusResult.rows[0]?.is_complete ?? false;

    await client.query(
      `UPDATE users
       SET is_profile_complete = CASE
         WHEN LOWER(role::text) = 'student' THEN $2
         ELSE TRUE
       END,
       updated_at = NOW()
       WHERE id = $1`,
      [studentId, isComplete],
    );

    const updatedUserResult = await client.query<{
      id: string;
      role: string;
      name: string;
      email: string;
      college_id: string | null;
      department: string | null;
      phone_number: string | null;
      dob: Date | null;
      is_profile_complete: boolean;
    }>(
      `SELECT id, role, name, email, college_id, department, phone_number, dob, is_profile_complete
       FROM users
       WHERE id = $1`,
      [studentId],
    );

    await client.query("COMMIT");
    return { success: true, user: updatedUserResult.rows[0] };
  } catch (err) {
    await client.query("ROLLBACK");

    const dbErr = err as { code?: string; constraint?: string };
    if (dbErr.code === "23505" && dbErr.constraint === "users_email_key") {
      throw new AppError("Email already registered", 409);
    }

    throw err;
  } finally {
    client.release();
  }
}

export async function deleteStudent(studentId: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM student_details WHERE user_id = $1", [studentId]);
    await client.query("DELETE FROM users WHERE id = $1", [studentId]);

    await client.query("COMMIT");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
