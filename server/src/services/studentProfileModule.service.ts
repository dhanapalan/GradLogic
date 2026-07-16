/**
 * Student Portal Module 03 — My Profile facade.
 * Thin persistence adapters + field metadata. No approval workflows.
 */
import { v4 as uuidv4 } from "uuid";
import { query, queryOne } from "../config/database.js";
import { uploadFile } from "../config/storage.js";
import { AppError } from "../middleware/errorHandler.js";
import { recordAuditEvent } from "./adminAudit.service.js";
import {
  getStudentMe,
  getProfileCompletion,
  updateStudentProfile,
  uploadStudentPhoto,
  uploadStudentResume,
} from "./studentPortalProfile.service.js";
import { getReadiness } from "./studentDashboard.service.js";

const SKILL_CATEGORIES = [
  "programming_languages",
  "frameworks",
  "databases",
  "cloud_platforms",
  "devops_tools",
  "testing_tools",
  "ai_ml",
  "soft_skills",
  "spoken_languages",
  "other",
] as const;

const EXPERIENCE_TYPES = ["internship", "freelance", "part_time", "full_time"] as const;

const DOC_TYPES = [
  "aadhaar",
  "pan",
  "passport",
  "driving_license",
  "community_certificate",
  "transfer_certificate",
  "marksheet",
  "degree_certificate",
  "other",
] as const;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;

  // Extended personal / academic columns on student_details
  await query(`
    ALTER TABLE student_details
      ADD COLUMN IF NOT EXISTS preferred_name VARCHAR(120),
      ADD COLUMN IF NOT EXISTS blood_group VARCHAR(16),
      ADD COLUMN IF NOT EXISTS nationality VARCHAR(80),
      ADD COLUMN IF NOT EXISTS category VARCHAR(80),
      ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS city VARCHAR(120),
      ADD COLUMN IF NOT EXISTS district VARCHAR(120),
      ADD COLUMN IF NOT EXISTS state VARCHAR(120),
      ADD COLUMN IF NOT EXISTS country VARCHAR(120),
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS emergency_name VARCHAR(120),
      ADD COLUMN IF NOT EXISTS emergency_relationship VARCHAR(80),
      ADD COLUMN IF NOT EXISTS emergency_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS roll_number VARCHAR(80),
      ADD COLUMN IF NOT EXISTS academic_advisor VARCHAR(160),
      ADD COLUMN IF NOT EXISTS admission_year INT,
      ADD COLUMN IF NOT EXISTS current_backlogs INT,
      ADD COLUMN IF NOT EXISTS academic_status VARCHAR(80),
      ADD COLUMN IF NOT EXISTS portfolio_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS kaggle_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS hackerrank_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS leetcode_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS codechef_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS other_links TEXT
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS student_profile_skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category VARCHAR(40) NOT NULL DEFAULT 'other',
      name VARCHAR(160) NOT NULL,
      proficiency VARCHAR(40) NOT NULL DEFAULT 'intermediate',
      years_experience NUMERIC(4,1),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, category, name)
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS student_profile_certifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      provider VARCHAR(255),
      issue_date DATE,
      expiry_date DATE,
      credential_id VARCHAR(160),
      verification_url VARCHAR(500),
      certificate_url VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS student_profile_projects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      technologies TEXT[],
      role VARCHAR(160),
      start_date DATE,
      end_date DATE,
      github_url VARCHAR(500),
      live_url VARCHAR(500),
      document_url VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS student_profile_experience (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      experience_type VARCHAR(40) NOT NULL DEFAULT 'internship',
      organization VARCHAR(255) NOT NULL,
      role VARCHAR(160),
      start_date DATE,
      end_date DATE,
      responsibilities TEXT,
      technologies TEXT[],
      certificate_url VARCHAR(500),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS student_profile_preferences (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      preferred_roles TEXT[],
      preferred_industries TEXT[],
      preferred_locations TEXT[],
      expected_salary VARCHAR(80),
      willing_to_relocate BOOLEAN DEFAULT FALSE,
      higher_studies_interest BOOLEAN DEFAULT FALSE,
      government_jobs_interest BOOLEAN DEFAULT FALSE,
      entrepreneurship_interest BOOLEAN DEFAULT FALSE,
      email_notifications BOOLEAN DEFAULT TRUE,
      sms_notifications BOOLEAN DEFAULT FALSE,
      push_notifications BOOLEAN DEFAULT TRUE,
      placement_visibility BOOLEAN DEFAULT TRUE,
      resume_visibility BOOLEAN DEFAULT TRUE,
      profile_visibility BOOLEAN DEFAULT TRUE,
      marketing_preferences BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS student_self_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doc_type VARCHAR(60) NOT NULL,
      original_name VARCHAR(255) NOT NULL,
      mime_type VARCHAR(120) NOT NULL,
      file_size INT NOT NULL,
      storage_key TEXT NOT NULL,
      storage_url TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    )
  `).catch(() => {});

  schemaReady = true;
}

function asStringArray(v: unknown): string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x).trim()).filter(Boolean);
    return arr.length ? Array.from(new Set(arr)) : null;
  }
  if (typeof v === "string") {
    const arr = v.split(",").map((x) => x.trim()).filter(Boolean);
    return arr.length ? Array.from(new Set(arr)) : null;
  }
  return null;
}

/** Field-level edit policy returned to the client (no FE business rules). */
export function getFieldMetadata() {
  const readOnly = [
    "email",
    "institutional_email",
    "student_identifier",
    "register_number",
    "category",
    "college_name",
    "college_id",
  ];
  const editable = [
    "first_name", "middle_name", "last_name", "preferred_name", "gender", "dob", "blood_group",
    "phone_number", "alternate_phone", "alternate_email", "nationality",
    "address_line1", "address_line2", "city", "district", "state", "country", "postal_code",
    "emergency_name", "emergency_relationship", "emergency_phone",
    "degree", "specialization", "class_name", "section", "passing_year", "cgpa", "percentage",
    "roll_number", "admission_year", "current_backlogs", "academic_advisor", "academic_status",
    "linkedin_url", "github_url", "portfolio_url", "kaggle_url", "hackerrank_url",
    "leetcode_url", "codechef_url", "other_links", "career_goals",
  ];
  return {
    fields: [
      ...editable.map((key) => ({ key, editable: true, approval_required: false })),
      ...readOnly.map((key) => ({ key, editable: false, approval_required: false })),
    ],
  };
}

async function getExtendedDetails(userId: string) {
  return queryOne<Record<string, unknown>>(
    `SELECT
       preferred_name, blood_group, nationality, category,
       address_line1, address_line2, city, district, state, country, postal_code,
       emergency_name, emergency_relationship, emergency_phone,
       roll_number, academic_advisor, admission_year, current_backlogs, academic_status,
       portfolio_url, kaggle_url, hackerrank_url, leetcode_url, codechef_url, other_links,
       class_name, section, student_identifier, face_photo_url, resume_url,
       updated_at::text AS details_updated_at
     FROM student_details WHERE user_id = $1`,
    [userId]
  ).catch(() => null);
}

/** GET /students/profile — full profile payload for Module 03. */
export async function getFullProfile(userId: string) {
  await ensureSchema();
  const [me, extended, completion, readiness, metadata] = await Promise.all([
    getStudentMe(userId),
    getExtendedDetails(userId),
    getSectionCompletion(userId),
    getReadiness(userId).catch(() => null),
    Promise.resolve(getFieldMetadata()),
  ]);

  return {
    ...me,
    ...(extended || {}),
    institutional_email: me.email,
    register_number: (extended as { student_identifier?: string } | null)?.student_identifier
      ?? me.student_identifier
      ?? null,
    profile_photo_url:
      me.profile_photo_url
      ?? (extended as { face_photo_url?: string } | null)?.face_photo_url
      ?? null,
    readiness_score: readiness?.score ?? null,
    readiness_level: readiness?.level ?? null,
    profile_completion: completion,
    field_metadata: metadata,
    last_updated: (extended as { details_updated_at?: string } | null)?.details_updated_at ?? null,
  };
}

/** PUT /students/profile — personal/academic/social fields + optional files. */
export async function saveProfile(
  userId: string,
  body: Record<string, unknown>,
  files?: { profilePhoto?: Express.Multer.File; resumeFile?: Express.Multer.File }
) {
  await ensureSchema();

  // Core fields go through existing updateStudent adapter.
  await updateStudentProfile(
    userId,
    {
      first_name: body.first_name as string | undefined,
      middle_name: body.middle_name as string | undefined,
      last_name: body.last_name as string | undefined,
      gender: body.gender as never,
      dob: body.dob as string | undefined,
      phone_number: body.phone_number as string | undefined,
      alternate_email: body.alternate_email as string | undefined,
      alternate_phone: body.alternate_phone as string | undefined,
      degree: body.degree as string | undefined,
      specialization: body.specialization as string | undefined,
      class_name: (body.class_name ?? body.semester) as string | undefined,
      section: body.section as string | undefined,
      passing_year: body.passing_year != null ? Number(body.passing_year) : undefined,
      cgpa: body.cgpa != null ? Number(body.cgpa) : undefined,
      percentage: body.percentage != null ? Number(body.percentage) : undefined,
      roll_number: body.roll_number as string | undefined,
      linkedin_url: body.linkedin_url as string | undefined,
      github_url: body.github_url as string | undefined,
      career_goals: body.career_goals as string | undefined,
      skills: body.skills as string[] | string | undefined,
    },
    files
  );

  // Extended columns — never overwrite college-managed category / identifier.
  await query(
    `UPDATE student_details SET
       preferred_name = COALESCE($2, preferred_name),
       blood_group = COALESCE($3, blood_group),
       nationality = COALESCE($4, nationality),
       address_line1 = COALESCE($5, address_line1),
       address_line2 = COALESCE($6, address_line2),
       city = COALESCE($7, city),
       district = COALESCE($8, district),
       state = COALESCE($9, state),
       country = COALESCE($10, country),
       postal_code = COALESCE($11, postal_code),
       emergency_name = COALESCE($12, emergency_name),
       emergency_relationship = COALESCE($13, emergency_relationship),
       emergency_phone = COALESCE($14, emergency_phone),
       academic_advisor = COALESCE($15, academic_advisor),
       admission_year = COALESCE($16, admission_year),
       current_backlogs = COALESCE($17, current_backlogs),
       academic_status = COALESCE($18, academic_status),
       portfolio_url = COALESCE($19, portfolio_url),
       kaggle_url = COALESCE($20, kaggle_url),
       hackerrank_url = COALESCE($21, hackerrank_url),
       leetcode_url = COALESCE($22, leetcode_url),
       codechef_url = COALESCE($23, codechef_url),
       other_links = COALESCE($24, other_links),
       updated_at = NOW()
     WHERE user_id = $1`,
    [
      userId,
      body.preferred_name ?? null,
      body.blood_group ?? null,
      body.nationality ?? null,
      body.address_line1 ?? null,
      body.address_line2 ?? null,
      body.city ?? null,
      body.district ?? null,
      body.state ?? null,
      body.country ?? null,
      body.postal_code ?? null,
      body.emergency_name ?? null,
      body.emergency_relationship ?? null,
      body.emergency_phone ?? null,
      body.academic_advisor ?? null,
      body.admission_year != null ? Number(body.admission_year) : null,
      body.current_backlogs != null ? Number(body.current_backlogs) : null,
      body.academic_status ?? null,
      body.portfolio_url ?? null,
      body.kaggle_url ?? null,
      body.hackerrank_url ?? null,
      body.leetcode_url ?? null,
      body.codechef_url ?? null,
      body.other_links ?? null,
    ]
  ).catch(() => {});

  return getFullProfile(userId);
}

export async function deletePhoto(userId: string) {
  await ensureSchema();
  await query(
    `UPDATE student_details SET face_photo_url = NULL, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
  await query(`UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = $1`, [userId]).catch(() => {});
  return { deleted: true };
}

export async function deleteResume(userId: string) {
  await ensureSchema();
  await query(
    `UPDATE student_details SET resume_url = NULL, updated_at = NOW() WHERE user_id = $1`,
    [userId]
  );
  return { deleted: true };
}

export async function getResume(userId: string) {
  const row = await queryOne<{ resume_url: string | null; updated_at: string }>(
    `SELECT resume_url, updated_at::text FROM student_details WHERE user_id = $1`,
    [userId]
  );
  if (!row?.resume_url) return null;
  return {
    url: row.resume_url,
    uploaded_at: row.updated_at,
    file_size: null as number | null,
    version: 1,
  };
}

// ── Skills ───────────────────────────────────────────────────────────────────

export async function listSkills(userId: string) {
  await ensureSchema();
  return query(
    `SELECT id, category, name, proficiency, years_experience::float AS years_experience,
            created_at::text, updated_at::text
     FROM student_profile_skills WHERE user_id = $1
     ORDER BY category, name`,
    [userId]
  );
}

export async function replaceSkills(
  userId: string,
  skills: Array<{
    category?: string;
    name: string;
    proficiency?: string;
    years_experience?: number | null;
  }>
) {
  await ensureSchema();
  if (!Array.isArray(skills)) throw new AppError("skills must be an array", 400);

  const normalized = skills
    .map((s) => ({
      category: (SKILL_CATEGORIES as readonly string[]).includes(String(s.category || ""))
        ? String(s.category)
        : "other",
      name: String(s.name || "").trim(),
      proficiency: String(s.proficiency || "intermediate").trim() || "intermediate",
      years_experience: s.years_experience != null ? Number(s.years_experience) : null,
    }))
    .filter((s) => s.name.length > 0);

  // Duplicate detection (case-insensitive name within category)
  const seen = new Set<string>();
  for (const s of normalized) {
    const key = `${s.category}::${s.name.toLowerCase()}`;
    if (seen.has(key)) throw new AppError(`Duplicate skill: ${s.name}`, 400);
    seen.add(key);
  }

  await query(`DELETE FROM student_profile_skills WHERE user_id = $1`, [userId]);
  for (const s of normalized) {
    await query(
      `INSERT INTO student_profile_skills (user_id, category, name, proficiency, years_experience)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, s.category, s.name, s.proficiency, s.years_experience]
    );
  }

  // Keep legacy TEXT[] in sync for Module 01/02 completion.
  const names = normalized.map((s) => s.name);
  await query(
    `UPDATE student_details SET skills = $2, updated_at = NOW() WHERE user_id = $1`,
    [userId, names.length ? names : null]
  ).catch(() => {});

  return listSkills(userId);
}

// ── Certifications ───────────────────────────────────────────────────────────

export async function listCertifications(userId: string) {
  await ensureSchema();
  return query(
    `SELECT id, name, provider, issue_date::text, expiry_date::text, credential_id,
            verification_url, certificate_url, created_at::text, updated_at::text
     FROM student_profile_certifications WHERE user_id = $1
     ORDER BY issue_date DESC NULLS LAST, created_at DESC`,
    [userId]
  );
}

export async function createCertification(userId: string, body: Record<string, unknown>, file?: Express.Multer.File) {
  await ensureSchema();
  const name = String(body.name || "").trim();
  if (!name) throw new AppError("Certification name is required", 400);

  const dup = await queryOne(
    `SELECT id FROM student_profile_certifications
     WHERE user_id = $1 AND LOWER(name) = LOWER($2)
       AND COALESCE(credential_id,'') = COALESCE($3,'')`,
    [userId, name, body.credential_id ? String(body.credential_id) : ""]
  );
  if (dup) throw new AppError("Duplicate certification", 409);

  let certificate_url: string | null = null;
  if (file) {
    const key = `students/${userId}/certs/${uuidv4()}-${file.originalname}`;
    certificate_url = await uploadFile(key, file.buffer, file.mimetype);
  }

  const row = await queryOne(
    `INSERT INTO student_profile_certifications
       (user_id, name, provider, issue_date, expiry_date, credential_id, verification_url, certificate_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, name, provider, issue_date::text, expiry_date::text, credential_id,
               verification_url, certificate_url, created_at::text, updated_at::text`,
    [
      userId, name,
      body.provider ? String(body.provider) : null,
      body.issue_date || null,
      body.expiry_date || null,
      body.credential_id ? String(body.credential_id) : null,
      body.verification_url ? String(body.verification_url) : null,
      certificate_url,
    ]
  );
  return row;
}

export async function updateCertification(
  userId: string,
  id: string,
  body: Record<string, unknown>,
  file?: Express.Multer.File
) {
  await ensureSchema();
  const existing = await queryOne<{ id: string; certificate_url: string | null }>(
    `SELECT id, certificate_url FROM student_profile_certifications WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (!existing) throw new AppError("Certification not found", 404);

  let certificate_url = existing.certificate_url;
  if (file) {
    const key = `students/${userId}/certs/${uuidv4()}-${file.originalname}`;
    certificate_url = await uploadFile(key, file.buffer, file.mimetype);
  }

  return queryOne(
    `UPDATE student_profile_certifications SET
       name = COALESCE($3, name),
       provider = COALESCE($4, provider),
       issue_date = COALESCE($5, issue_date),
       expiry_date = COALESCE($6, expiry_date),
       credential_id = COALESCE($7, credential_id),
       verification_url = COALESCE($8, verification_url),
       certificate_url = COALESCE($9, certificate_url),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, provider, issue_date::text, expiry_date::text, credential_id,
               verification_url, certificate_url, created_at::text, updated_at::text`,
    [
      id, userId,
      body.name ? String(body.name) : null,
      body.provider !== undefined ? String(body.provider || "") || null : null,
      body.issue_date || null,
      body.expiry_date || null,
      body.credential_id !== undefined ? String(body.credential_id || "") || null : null,
      body.verification_url !== undefined ? String(body.verification_url || "") || null : null,
      certificate_url,
    ]
  );
}

export async function deleteCertification(userId: string, id: string) {
  await ensureSchema();
  const row = await queryOne(
    `DELETE FROM student_profile_certifications WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (!row) throw new AppError("Certification not found", 404);
  return { deleted: true };
}

// ── Projects ─────────────────────────────────────────────────────────────────

export async function listProjects(userId: string) {
  await ensureSchema();
  return query(
    `SELECT id, name, description, technologies, role, start_date::text, end_date::text,
            github_url, live_url, document_url, created_at::text, updated_at::text
     FROM student_profile_projects WHERE user_id = $1
     ORDER BY start_date DESC NULLS LAST, created_at DESC`,
    [userId]
  );
}

export async function createProject(userId: string, body: Record<string, unknown>, file?: Express.Multer.File) {
  await ensureSchema();
  const name = String(body.name || "").trim();
  if (!name) throw new AppError("Project name is required", 400);

  let document_url: string | null = null;
  if (file) {
    const key = `students/${userId}/projects/${uuidv4()}-${file.originalname}`;
    document_url = await uploadFile(key, file.buffer, file.mimetype);
  }

  return queryOne(
    `INSERT INTO student_profile_projects
       (user_id, name, description, technologies, role, start_date, end_date, github_url, live_url, document_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, name, description, technologies, role, start_date::text, end_date::text,
               github_url, live_url, document_url, created_at::text, updated_at::text`,
    [
      userId, name,
      body.description ? String(body.description) : null,
      asStringArray(body.technologies),
      body.role ? String(body.role) : null,
      body.start_date || null,
      body.end_date || null,
      body.github_url ? String(body.github_url) : null,
      body.live_url ? String(body.live_url) : null,
      document_url,
    ]
  );
}

export async function updateProject(
  userId: string,
  id: string,
  body: Record<string, unknown>,
  file?: Express.Multer.File
) {
  await ensureSchema();
  const existing = await queryOne<{ id: string; document_url: string | null }>(
    `SELECT id, document_url FROM student_profile_projects WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (!existing) throw new AppError("Project not found", 404);

  let document_url = existing.document_url;
  if (file) {
    const key = `students/${userId}/projects/${uuidv4()}-${file.originalname}`;
    document_url = await uploadFile(key, file.buffer, file.mimetype);
  }

  return queryOne(
    `UPDATE student_profile_projects SET
       name = COALESCE($3, name),
       description = COALESCE($4, description),
       technologies = COALESCE($5, technologies),
       role = COALESCE($6, role),
       start_date = COALESCE($7, start_date),
       end_date = COALESCE($8, end_date),
       github_url = COALESCE($9, github_url),
       live_url = COALESCE($10, live_url),
       document_url = COALESCE($11, document_url),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, name, description, technologies, role, start_date::text, end_date::text,
               github_url, live_url, document_url, created_at::text, updated_at::text`,
    [
      id, userId,
      body.name ? String(body.name) : null,
      body.description !== undefined ? String(body.description || "") || null : null,
      body.technologies !== undefined ? asStringArray(body.technologies) : null,
      body.role !== undefined ? String(body.role || "") || null : null,
      body.start_date || null,
      body.end_date || null,
      body.github_url !== undefined ? String(body.github_url || "") || null : null,
      body.live_url !== undefined ? String(body.live_url || "") || null : null,
      document_url,
    ]
  );
}

export async function deleteProject(userId: string, id: string) {
  await ensureSchema();
  const row = await queryOne(
    `DELETE FROM student_profile_projects WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (!row) throw new AppError("Project not found", 404);
  return { deleted: true };
}

// ── Experience ───────────────────────────────────────────────────────────────

export async function listExperience(userId: string) {
  await ensureSchema();
  return query(
    `SELECT id, experience_type, organization, role, start_date::text, end_date::text,
            responsibilities, technologies, certificate_url, created_at::text, updated_at::text
     FROM student_profile_experience WHERE user_id = $1
     ORDER BY start_date DESC NULLS LAST, created_at DESC`,
    [userId]
  );
}

export async function createExperience(userId: string, body: Record<string, unknown>, file?: Express.Multer.File) {
  await ensureSchema();
  const organization = String(body.organization || "").trim();
  if (!organization) throw new AppError("Organization is required", 400);
  const experience_type = (EXPERIENCE_TYPES as readonly string[]).includes(String(body.experience_type || ""))
    ? String(body.experience_type)
    : "internship";

  let certificate_url: string | null = null;
  if (file) {
    const key = `students/${userId}/experience/${uuidv4()}-${file.originalname}`;
    certificate_url = await uploadFile(key, file.buffer, file.mimetype);
  }

  return queryOne(
    `INSERT INTO student_profile_experience
       (user_id, experience_type, organization, role, start_date, end_date, responsibilities, technologies, certificate_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id, experience_type, organization, role, start_date::text, end_date::text,
               responsibilities, technologies, certificate_url, created_at::text, updated_at::text`,
    [
      userId, experience_type, organization,
      body.role ? String(body.role) : null,
      body.start_date || null,
      body.end_date || null,
      body.responsibilities ? String(body.responsibilities) : null,
      asStringArray(body.technologies),
      certificate_url,
    ]
  );
}

export async function updateExperience(
  userId: string,
  id: string,
  body: Record<string, unknown>,
  file?: Express.Multer.File
) {
  await ensureSchema();
  const existing = await queryOne<{ id: string; certificate_url: string | null }>(
    `SELECT id, certificate_url FROM student_profile_experience WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  if (!existing) throw new AppError("Experience not found", 404);

  let certificate_url = existing.certificate_url;
  if (file) {
    const key = `students/${userId}/experience/${uuidv4()}-${file.originalname}`;
    certificate_url = await uploadFile(key, file.buffer, file.mimetype);
  }

  const experience_type = body.experience_type
    && (EXPERIENCE_TYPES as readonly string[]).includes(String(body.experience_type))
    ? String(body.experience_type)
    : null;

  return queryOne(
    `UPDATE student_profile_experience SET
       experience_type = COALESCE($3, experience_type),
       organization = COALESCE($4, organization),
       role = COALESCE($5, role),
       start_date = COALESCE($6, start_date),
       end_date = COALESCE($7, end_date),
       responsibilities = COALESCE($8, responsibilities),
       technologies = COALESCE($9, technologies),
       certificate_url = COALESCE($10, certificate_url),
       updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING id, experience_type, organization, role, start_date::text, end_date::text,
               responsibilities, technologies, certificate_url, created_at::text, updated_at::text`,
    [
      id, userId, experience_type,
      body.organization ? String(body.organization) : null,
      body.role !== undefined ? String(body.role || "") || null : null,
      body.start_date || null,
      body.end_date || null,
      body.responsibilities !== undefined ? String(body.responsibilities || "") || null : null,
      body.technologies !== undefined ? asStringArray(body.technologies) : null,
      certificate_url,
    ]
  );
}

export async function deleteExperience(userId: string, id: string) {
  await ensureSchema();
  const row = await queryOne(
    `DELETE FROM student_profile_experience WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (!row) throw new AppError("Experience not found", 404);
  return { deleted: true };
}

// ── Preferences ──────────────────────────────────────────────────────────────

export async function getPreferences(userId: string) {
  await ensureSchema();
  const row = await queryOne(
    `SELECT * FROM student_profile_preferences WHERE user_id = $1`,
    [userId]
  );
  if (row) return row;
  return {
    user_id: userId,
    preferred_roles: [],
    preferred_industries: [],
    preferred_locations: [],
    expected_salary: null,
    willing_to_relocate: false,
    higher_studies_interest: false,
    government_jobs_interest: false,
    entrepreneurship_interest: false,
    email_notifications: true,
    sms_notifications: false,
    push_notifications: true,
    placement_visibility: true,
    resume_visibility: true,
    profile_visibility: true,
    marketing_preferences: false,
  };
}

export async function savePreferences(userId: string, body: Record<string, unknown>) {
  await ensureSchema();
  const row = await queryOne(
    `INSERT INTO student_profile_preferences (
       user_id, preferred_roles, preferred_industries, preferred_locations, expected_salary,
       willing_to_relocate, higher_studies_interest, government_jobs_interest, entrepreneurship_interest,
       email_notifications, sms_notifications, push_notifications,
       placement_visibility, resume_visibility, profile_visibility, marketing_preferences, updated_at
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()
     )
     ON CONFLICT (user_id) DO UPDATE SET
       preferred_roles = EXCLUDED.preferred_roles,
       preferred_industries = EXCLUDED.preferred_industries,
       preferred_locations = EXCLUDED.preferred_locations,
       expected_salary = EXCLUDED.expected_salary,
       willing_to_relocate = EXCLUDED.willing_to_relocate,
       higher_studies_interest = EXCLUDED.higher_studies_interest,
       government_jobs_interest = EXCLUDED.government_jobs_interest,
       entrepreneurship_interest = EXCLUDED.entrepreneurship_interest,
       email_notifications = EXCLUDED.email_notifications,
       sms_notifications = EXCLUDED.sms_notifications,
       push_notifications = EXCLUDED.push_notifications,
       placement_visibility = EXCLUDED.placement_visibility,
       resume_visibility = EXCLUDED.resume_visibility,
       profile_visibility = EXCLUDED.profile_visibility,
       marketing_preferences = EXCLUDED.marketing_preferences,
       updated_at = NOW()
     RETURNING *`,
    [
      userId,
      asStringArray(body.preferred_roles) ?? [],
      asStringArray(body.preferred_industries) ?? [],
      asStringArray(body.preferred_locations) ?? [],
      body.expected_salary != null ? String(body.expected_salary) : null,
      Boolean(body.willing_to_relocate),
      Boolean(body.higher_studies_interest),
      Boolean(body.government_jobs_interest),
      Boolean(body.entrepreneurship_interest),
      body.email_notifications !== false,
      Boolean(body.sms_notifications),
      body.push_notifications !== false,
      body.placement_visibility !== false,
      body.resume_visibility !== false,
      body.profile_visibility !== false,
      Boolean(body.marketing_preferences),
    ]
  );
  return row;
}

// ── Documents ────────────────────────────────────────────────────────────────

export async function listDocuments(userId: string) {
  await ensureSchema();
  return query(
    `SELECT id, doc_type, original_name, mime_type, file_size, storage_url, created_at::text
     FROM student_self_documents
     WHERE user_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );
}

export async function uploadDocument(userId: string, docType: string, file: Express.Multer.File) {
  await ensureSchema();
  if (!(DOC_TYPES as readonly string[]).includes(docType)) {
    throw new AppError(`Invalid document type. Allowed: ${DOC_TYPES.join(", ")}`, 400);
  }
  if (!file) throw new AppError("File is required", 400);

  const allowed = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  if (!allowed.has(file.mimetype)) throw new AppError("Unsupported file type", 400);
  if (file.size > 5 * 1024 * 1024) throw new AppError("File must be 5MB or smaller", 400);

  const key = `students/${userId}/docs/${docType}/${uuidv4()}-${file.originalname}`;
  const storage_url = await uploadFile(key, file.buffer, file.mimetype);

  return queryOne(
    `INSERT INTO student_self_documents
       (user_id, doc_type, original_name, mime_type, file_size, storage_key, storage_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id, doc_type, original_name, mime_type, file_size, storage_url, created_at::text`,
    [userId, docType, file.originalname, file.mimetype, file.size, key, storage_url]
  );
}

export async function deleteDocument(userId: string, id: string) {
  await ensureSchema();
  const row = await queryOne(
    `UPDATE student_self_documents SET deleted_at = NOW()
     WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
     RETURNING id`,
    [id, userId]
  );
  if (!row) throw new AppError("Document not found", 404);
  return { deleted: true };
}

/** Enhanced completion with section breakdown (keeps Module 02 top-level keys). */
export async function getSectionCompletion(userId: string) {
  await ensureSchema();
  const base = await getProfileCompletion(userId);
  const [skills, certs, projects, resume] = await Promise.all([
    queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM student_profile_skills WHERE user_id = $1`, [userId]),
    queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM student_profile_certifications WHERE user_id = $1`, [userId]),
    queryOne<{ n: number }>(`SELECT COUNT(*)::int AS n FROM student_profile_projects WHERE user_id = $1`, [userId]),
    queryOne<{ resume_url: string | null }>(`SELECT resume_url FROM student_details WHERE user_id = $1`, [userId]),
  ]);

  const sections = [
    {
      id: "personal",
      label: "Personal Information",
      complete: !base.missing.some((f) =>
        ["first_name", "last_name", "dob", "phone_number"].includes(f)
      ),
      href: "personal",
    },
    {
      id: "academic",
      label: "Academic Information",
      complete: !base.missing.some((f) =>
        ["degree", "specialization", "passing_year", "academic_score", "student_identifier"].includes(f)
      ),
      href: "academic",
    },
    {
      id: "skills",
      label: "Skills",
      complete: (skills?.n ?? 0) > 0 || !base.missing.includes("skills"),
      href: "skills",
    },
    {
      id: "resume",
      label: "Resume",
      complete: Boolean(resume?.resume_url),
      href: "resume",
    },
    {
      id: "career",
      label: "Career Preferences",
      complete: !base.missing.includes("career_goals"),
      href: "career",
    },
    {
      id: "documents",
      label: "Documents",
      complete: (certs?.n ?? 0) + (projects?.n ?? 0) > 0 || Boolean(resume?.resume_url),
      href: "documents",
    },
  ];

  return {
    ...base,
    sections,
    missing_links: base.missing.map((field) => ({
      field,
      section:
        ["first_name", "last_name", "dob", "phone_number"].includes(field)
          ? "personal"
          : ["degree", "specialization", "passing_year", "academic_score", "student_identifier"].includes(field)
            ? "academic"
            : field === "skills"
              ? "skills"
              : field === "resume_url"
                ? "resume"
                : field === "career_goals"
                  ? "career"
                  : "overview",
    })),
  };
}

export {
  uploadStudentPhoto,
  uploadStudentResume,
  SKILL_CATEGORIES,
  EXPERIENCE_TYPES,
  DOC_TYPES,
};
