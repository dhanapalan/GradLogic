/**
 * Thin student-portal profile adapters — wrap Identity / student services.
 * No duplicated auth logic.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { recordAuditEvent } from "./adminAudit.service.js";
import { getMe } from "./auth.service.js";
import { updateStudent, type UpdateStudentInput } from "./student.service.js";

let schemaReady = false;

async function ensurePortalProfileSchema() {
  if (schemaReady) return;
  await query(
    `ALTER TABLE student_details ADD COLUMN IF NOT EXISTS career_goals TEXT`
  ).catch(() => {});
  await query(
    `ALTER TABLE student_details ADD COLUMN IF NOT EXISTS policy_accepted_at TIMESTAMPTZ`
  ).catch(() => {});
  schemaReady = true;
}

const COMPLETION_FIELDS = [
  "first_name",
  "last_name",
  "dob",
  "phone_number",
  "degree",
  "specialization",
  "passing_year",
  "academic_score",
  "student_identifier",
  "skills",
  "career_goals",
  "resume_url",
  "policy_accepted",
] as const;

export async function getStudentMe(userId: string) {
  await ensurePortalProfileSchema();
  const me = await getMe(userId);
  if (String(me.role).toLowerCase() !== "student") {
    throw new AppError("Student profile only", 403);
  }
  const extra = await queryOne<{
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    gender: string | null;
    career_goals: string | null;
    policy_accepted_at: string | null;
    alternate_email: string | null;
    alternate_phone: string | null;
  }>(
    `SELECT first_name, middle_name, last_name, gender, career_goals,
            policy_accepted_at::text, alternate_email, alternate_phone
     FROM student_details WHERE user_id = $1`,
    [userId]
  ).catch(() => null);

  return {
    ...me,
    first_name: extra?.first_name ?? null,
    middle_name: extra?.middle_name ?? null,
    last_name: extra?.last_name ?? null,
    gender: extra?.gender ?? null,
    career_goals: extra?.career_goals ?? null,
    policy_accepted_at: extra?.policy_accepted_at ?? null,
    alternate_email: extra?.alternate_email ?? null,
    alternate_phone: extra?.alternate_phone ?? null,
  };
}

export async function updateStudentProfile(
  userId: string,
  body: UpdateStudentInput & { career_goals?: string },
  files?: { profilePhoto?: Express.Multer.File; resumeFile?: Express.Multer.File }
) {
  await ensurePortalProfileSchema();
  const result = await updateStudent(userId, {
    ...body,
    profilePhoto: files?.profilePhoto,
    resumeFile: files?.resumeFile,
  });

  if (body.career_goals !== undefined) {
    await query(
      `UPDATE student_details SET career_goals = $1, updated_at = NOW() WHERE user_id = $2`,
      [body.career_goals?.trim() || null, userId]
    ).catch(() => {});
  }

  recordAuditEvent({
    userId,
    action: "STUDENT_PROFILE_UPDATED",
    resourceType: "student",
    resourceId: userId,
  }).catch(() => {});

  return result;
}

export async function uploadStudentPhoto(userId: string, file: Express.Multer.File) {
  if (!file) throw new AppError("Photo file is required", 400);
  return updateStudentProfile(userId, {}, { profilePhoto: file });
}

export async function uploadStudentResume(userId: string, file: Express.Multer.File) {
  if (!file) throw new AppError("Resume file is required", 400);
  // Future AI parsing hook: enqueue resume parse job here.
  const result = await updateStudentProfile(userId, {}, { resumeFile: file });
  recordAuditEvent({
    userId,
    action: "STUDENT_RESUME_UPLOADED",
    resourceType: "student",
    resourceId: userId,
    changes: { ai_parse: "pending_hook" },
  }).catch(() => {});
  return result;
}

export async function getProfileCompletion(userId: string) {
  await ensurePortalProfileSchema();
  const row = await queryOne<{
    first_name: string | null;
    last_name: string | null;
    dob: string | null;
    phone_number: string | null;
    degree: string | null;
    specialization: string | null;
    passing_year: number | null;
    cgpa: number | null;
    percentage: number | null;
    student_identifier: string | null;
    skills: unknown;
    career_goals: string | null;
    resume_url: string | null;
    policy_accepted_at: string | null;
    is_profile_complete: boolean;
  }>(
    `SELECT
        COALESCE(NULLIF(sd.first_name, ''), NULLIF(SPLIT_PART(COALESCE(u.name, ''), ' ', 1), '')) AS first_name,
        COALESCE(NULLIF(sd.last_name, ''), NULLIF(TRIM(REGEXP_REPLACE(COALESCE(u.name, ''), '^\\S+\\s*', '')), '')) AS last_name,
        sd.dob::text, COALESCE(NULLIF(sd.phone_number, ''), u.phone_number) AS phone_number,
        sd.degree, sd.specialization, sd.passing_year, sd.cgpa, sd.percentage,
        sd.student_identifier, sd.skills, sd.career_goals, sd.resume_url,
        sd.policy_accepted_at::text, u.is_profile_complete
     FROM users u
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE u.id = $1 AND LOWER(u.role::text) = 'student'`,
    [userId]
  );
  if (!row) throw new AppError("Student not found", 404);

  const checks: Record<(typeof COMPLETION_FIELDS)[number], boolean> = {
    first_name: Boolean(row.first_name),
    last_name: Boolean(row.last_name),
    dob: Boolean(row.dob),
    phone_number: Boolean(row.phone_number),
    degree: Boolean(row.degree),
    specialization: Boolean(row.specialization),
    passing_year: row.passing_year != null,
    academic_score: row.cgpa != null || row.percentage != null,
    student_identifier: Boolean(row.student_identifier),
    skills: Array.isArray(row.skills)
      ? row.skills.length > 0
      : Boolean(row.skills && String(row.skills).trim()),
    career_goals: Boolean(row.career_goals?.trim()),
    resume_url: Boolean(row.resume_url),
    policy_accepted: Boolean(row.policy_accepted_at),
  };

  const completed = COMPLETION_FIELDS.filter((k) => checks[k]).length;
  const total = COMPLETION_FIELDS.length;
  const percentage = Math.round((completed / total) * 100);

  return {
    percentage,
    completed,
    total,
    is_profile_complete: Boolean(row.is_profile_complete),
    missing: COMPLETION_FIELDS.filter((k) => !checks[k]),
    fields: checks,
  };
}

export async function acceptPolicy(userId: string, ip?: string) {
  await ensurePortalProfileSchema();
  const row = await queryOne<{ user_id: string }>(
    `UPDATE student_details
     SET policy_accepted_at = COALESCE(policy_accepted_at, NOW()), updated_at = NOW()
     WHERE user_id = $1
     RETURNING user_id`,
    [userId]
  );
  if (!row) {
    // Create a stub details row if missing
    await query(
      `INSERT INTO student_details (user_id, policy_accepted_at, updated_at)
       VALUES ($1, NOW(), NOW())
       ON CONFLICT (user_id) DO UPDATE
         SET policy_accepted_at = COALESCE(student_details.policy_accepted_at, NOW()),
             updated_at = NOW()`,
      [userId]
    ).catch(async () => {
      throw new AppError("Unable to record policy acceptance. Complete academic details first.", 400);
    });
  }

  recordAuditEvent({
    userId,
    action: "STUDENT_POLICY_ACCEPTED",
    resourceType: "student",
    resourceId: userId,
    ipAddress: ip,
  }).catch(() => {});

  return { accepted: true, accepted_at: new Date().toISOString() };
}
