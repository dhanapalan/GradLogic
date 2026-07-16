/**
 * Phase 2 Module 04 — College Assessment Management (definitions only).
 */
import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";
import { ensureCollegeQuestionBankSchema } from "./collegeQuestionBank.service.js";

export const ASSESSMENT_TYPES = ["practice_test", "mock_test", "placement_test"] as const;
export const ASSESSMENT_CATEGORIES = [
  "aptitude",
  "logical_reasoning",
  "english",
  "technical",
  "domain",
] as const;
export const ASSESSMENT_STATUSES = ["draft", "published", "archived"] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];
export type AssessmentCategory = (typeof ASSESSMENT_CATEGORIES)[number];
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const TYPE_LABELS: Record<AssessmentType, string> = {
  practice_test: "Practice Test",
  mock_test: "Mock Test",
  placement_test: "Placement Test",
};

export const CATEGORY_LABELS: Record<AssessmentCategory, string> = {
  aptitude: "Aptitude",
  logical_reasoning: "Logical Reasoning",
  english: "English",
  technical: "Technical",
  domain: "Domain",
};

export interface AssessmentQuestionInput {
  question_id: string;
  display_order?: number;
  marks?: number;
}

export interface AssessmentInput {
  name: string;
  description?: string | null;
  assessment_type: string;
  category: string;
  duration_minutes: number;
  passing_marks: number;
  instructions?: string | null;
  status?: string;
  questions: AssessmentQuestionInput[];
  force?: boolean;
}

export interface AssessmentQuestionRow {
  id: string;
  assessment_id: string;
  question_id: string;
  display_order: number;
  marks: number;
  question_code?: string;
  title?: string;
  category?: string;
  difficulty?: string;
  question_type?: string;
  question_status?: string;
}

export interface AssessmentRow {
  id: string;
  college_id: string;
  assessment_code: string;
  name: string;
  description: string | null;
  assessment_type: AssessmentType;
  category: AssessmentCategory;
  duration_minutes: number;
  passing_marks: number;
  total_marks: number;
  total_questions: number;
  instructions: string | null;
  status: AssessmentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  questions?: AssessmentQuestionRow[];
}

let schemaReady = false;

export async function ensureCollegeAssessmentSchema(): Promise<void> {
  if (schemaReady) return;
  await ensureCollegeQuestionBankSchema();
  await query(`
    CREATE TABLE IF NOT EXISTS college_assessments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id),
      assessment_code VARCHAR(40) NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      assessment_type VARCHAR(50) NOT NULL,
      category VARCHAR(50) NOT NULL,
      duration_minutes INT NOT NULL,
      passing_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
      total_marks NUMERIC(8,2) NOT NULL DEFAULT 0,
      total_questions INT NOT NULL DEFAULT 0,
      instructions TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'draft',
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      is_active BOOLEAN NOT NULL DEFAULT TRUE
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS college_assessment_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      assessment_id UUID NOT NULL REFERENCES college_assessments(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES college_questions(id),
      display_order INT NOT NULL DEFAULT 0,
      marks NUMERIC(8,2) NOT NULL DEFAULT 1
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_assessments_code_unique
      ON college_assessments (college_id, assessment_code)
  `).catch(() => {});
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_assessment_questions_unique
      ON college_assessment_questions (assessment_id, question_id)
  `).catch(() => {});
  schemaReady = true;
}

function isType(v: string): v is AssessmentType {
  return (ASSESSMENT_TYPES as readonly string[]).includes(v);
}
function isCategory(v: string): v is AssessmentCategory {
  return (ASSESSMENT_CATEGORIES as readonly string[]).includes(v);
}
function isStatus(v: string): v is AssessmentStatus {
  return (ASSESSMENT_STATUSES as readonly string[]).includes(v);
}

function normalizeType(raw: string): AssessmentType | null {
  const s = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  const map: Record<string, AssessmentType> = {
    practice_test: "practice_test",
    practice: "practice_test",
    mock_test: "mock_test",
    mock: "mock_test",
    placement_test: "placement_test",
    placement: "placement_test",
  };
  return map[s] ?? (isType(s) ? s : null);
}

function normalizeCategory(raw: string): AssessmentCategory | null {
  const s = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  const map: Record<string, AssessmentCategory> = {
    aptitude: "aptitude",
    logical_reasoning: "logical_reasoning",
    logical: "logical_reasoning",
    reasoning: "logical_reasoning",
    english: "english",
    technical: "technical",
    domain: "domain",
  };
  return map[s] ?? (isCategory(s) ? s : null);
}

async function nextCode(collegeId: string): Promise<string> {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM college_assessments WHERE college_id = $1`,
    [collegeId]
  );
  return `CA-${String((Number(row?.n) || 0) + 1).padStart(5, "0")}`;
}

async function findDuplicateName(collegeId: string, name: string, excludeId?: string) {
  return queryOne<{ id: string; assessment_code: string }>(
    `SELECT id, assessment_code FROM college_assessments
     WHERE college_id = $1 AND deleted_at IS NULL
       AND LOWER(TRIM(name)) = LOWER(TRIM($2))
       AND ($3::uuid IS NULL OR id <> $3)
     LIMIT 1`,
    [collegeId, name, excludeId ?? null]
  );
}

async function resolveQuestions(
  collegeId: string,
  items: AssessmentQuestionInput[]
) {
  if (!items.length) throw new AppError("Assessment must contain at least one question.", 400);

  const ids = items.map((q) => q.question_id);
  const unique = new Set(ids);
  if (unique.size !== ids.length) {
    throw new AppError("Duplicate question selection is not allowed.", 400);
  }

  const rows = await query<{
    id: string;
    marks: number;
    status: string;
    deleted_at: string | null;
    title: string;
  }>(
    `SELECT id, marks::float AS marks, status, deleted_at::text, title
     FROM college_questions
     WHERE college_id = $1 AND id = ANY($2::uuid[])`,
    [collegeId, ids]
  );

  if (rows.length !== ids.length) {
    throw new AppError("One or more selected questions were not found in this college.", 400);
  }

  for (const r of rows) {
    if (r.deleted_at) {
      throw new AppError(`Question "${r.title}" is deleted and cannot be used.`, 400);
    }
    if (r.status !== "active") {
      throw new AppError(
        `Only Active questions can be added. "${r.title}" is ${r.status}.`,
        400
      );
    }
  }

  const byId = new Map(rows.map((r) => [r.id, r]));
  return items.map((item, idx) => {
    const q = byId.get(item.question_id)!;
    const marks = item.marks != null ? Number(item.marks) : Number(q.marks);
    if (!Number.isFinite(marks) || marks <= 0) {
      throw new AppError("Question marks must be greater than zero.", 400);
    }
    return {
      question_id: item.question_id,
      display_order: item.display_order ?? idx,
      marks,
    };
  });
}

function validateHeader(body: AssessmentInput, mode: "create" | "update") {
  const name = (body.name || "").trim();
  if (!name) throw new AppError("Assessment Name is mandatory.", 400);

  const assessment_type = normalizeType(String(body.assessment_type || ""));
  if (!assessment_type) {
    throw new AppError(
      `Invalid Assessment Type. Allowed: ${ASSESSMENT_TYPES.map((t) => TYPE_LABELS[t]).join(", ")}.`,
      400
    );
  }

  const category = normalizeCategory(String(body.category || ""));
  if (!category) {
    throw new AppError(
      `Invalid Category. Allowed: ${ASSESSMENT_CATEGORIES.map((c) => CATEGORY_LABELS[c]).join(", ")}.`,
      400
    );
  }

  const duration_minutes = Number(body.duration_minutes);
  if (!Number.isFinite(duration_minutes) || duration_minutes <= 0) {
    throw new AppError("Duration must be greater than zero.", 400);
  }

  const passing_marks = Number(body.passing_marks);
  if (!Number.isFinite(passing_marks) || passing_marks < 0) {
    throw new AppError("Passing Marks must be zero or greater.", 400);
  }

  let status: AssessmentStatus = "draft";
  if (body.status != null && String(body.status).trim() !== "") {
    const s = String(body.status).trim().toLowerCase();
    if (!isStatus(s)) {
      throw new AppError("Invalid Status. Allowed: Draft, Published, Archived.", 400);
    }
    status = s;
  } else if (mode === "create") {
    status = "draft";
  }

  return {
    name,
    description: body.description?.trim() || null,
    assessment_type,
    category,
    duration_minutes: Math.floor(duration_minutes),
    passing_marks,
    instructions: body.instructions?.trim() || null,
    status,
  };
}

export async function listAssessments(
  collegeId: string,
  filters: {
    search?: string;
    assessment_type?: string;
    category?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: "asc" | "desc";
  }
) {
  await ensureCollegeAssessmentSchema();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * limit;

  const params: unknown[] = [collegeId];
  let i = 2;
  let where = `WHERE a.college_id = $1 AND a.deleted_at IS NULL`;

  if (filters.search?.trim()) {
    where += ` AND (a.name ILIKE $${i} OR a.assessment_code ILIKE $${i})`;
    params.push(`%${filters.search.trim()}%`);
    i++;
  }
  if (filters.assessment_type) {
    const t = normalizeType(filters.assessment_type);
    if (t) {
      where += ` AND a.assessment_type = $${i++}`;
      params.push(t);
    }
  }
  if (filters.category) {
    const c = normalizeCategory(filters.category);
    if (c) {
      where += ` AND a.category = $${i++}`;
      params.push(c);
    }
  }
  if (filters.status) {
    const s = filters.status.trim().toLowerCase();
    if (isStatus(s)) {
      where += ` AND a.status = $${i++}`;
      params.push(s);
    }
  }

  const sortMap: Record<string, string> = {
    name: "a.name",
    assessment_code: "a.assessment_code",
    assessment_type: "a.assessment_type",
    category: "a.category",
    status: "a.status",
    total_marks: "a.total_marks",
    duration_minutes: "a.duration_minutes",
    updated_at: "a.updated_at",
    created_at: "a.created_at",
  };
  const sortCol = sortMap[filters.sort || "updated_at"] || "a.updated_at";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM college_assessments a ${where}`,
    params
  );
  const total = Number(countRow?.total || 0);

  const rows = await query<AssessmentRow>(
    `SELECT a.id, a.college_id, a.assessment_code, a.name, a.description,
            a.assessment_type, a.category, a.duration_minutes,
            a.passing_marks::float AS passing_marks,
            a.total_marks::float AS total_marks,
            a.total_questions, a.instructions, a.status,
            a.created_by, a.updated_by,
            cu.name AS created_by_name, uu.name AS updated_by_name,
            a.created_at::text, a.updated_at::text, a.is_active
     FROM college_assessments a
     LEFT JOIN users cu ON cu.id = a.created_by
     LEFT JOIN users uu ON uu.id = a.updated_by
     ${where}
     ORDER BY ${sortCol} ${order}
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  return {
    data: rows,
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function loadQuestions(assessmentId: string) {
  return query<AssessmentQuestionRow>(
    `SELECT aq.id, aq.assessment_id, aq.question_id, aq.display_order,
            aq.marks::float AS marks,
            q.question_code, q.title, q.category, q.difficulty, q.question_type,
            q.status AS question_status
     FROM college_assessment_questions aq
     JOIN college_questions q ON q.id = aq.question_id
     WHERE aq.assessment_id = $1
     ORDER BY aq.display_order ASC`,
    [assessmentId]
  );
}

export async function getAssessment(collegeId: string, id: string) {
  await ensureCollegeAssessmentSchema();
  const row = await queryOne<AssessmentRow>(
    `SELECT a.id, a.college_id, a.assessment_code, a.name, a.description,
            a.assessment_type, a.category, a.duration_minutes,
            a.passing_marks::float AS passing_marks,
            a.total_marks::float AS total_marks,
            a.total_questions, a.instructions, a.status,
            a.created_by, a.updated_by,
            cu.name AS created_by_name, uu.name AS updated_by_name,
            a.created_at::text, a.updated_at::text, a.is_active
     FROM college_assessments a
     LEFT JOIN users cu ON cu.id = a.created_by
     LEFT JOIN users uu ON uu.id = a.updated_by
     WHERE a.id = $1 AND a.college_id = $2 AND a.deleted_at IS NULL`,
    [id, collegeId]
  );
  if (!row) throw new AppError("Assessment not found.", 404);
  row.questions = await loadQuestions(id);
  return row;
}

async function replaceQuestions(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  assessmentId: string,
  questions: Array<{ question_id: string; display_order: number; marks: number }>
) {
  await client.query(`DELETE FROM college_assessment_questions WHERE assessment_id = $1`, [
    assessmentId,
  ]);
  for (const q of questions) {
    await client.query(
      `INSERT INTO college_assessment_questions
         (assessment_id, question_id, display_order, marks)
       VALUES ($1,$2,$3,$4)`,
      [assessmentId, q.question_id, q.display_order, q.marks]
    );
  }
}

export async function createAssessment(
  collegeId: string,
  body: AssessmentInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeAssessmentSchema();
  const header = validateHeader(body, "create");
  const questions = await resolveQuestions(collegeId, body.questions || []);
  const total_marks = questions.reduce((s, q) => s + q.marks, 0);
  const total_questions = questions.length;

  if (header.passing_marks > total_marks) {
    throw new AppError("Passing Marks cannot exceed Total Marks.", 400);
  }

  const dup = await findDuplicateName(collegeId, header.name);
  if (dup && !body.force) {
    throw new AppError(
      `Duplicate assessment name warning: similar assessment exists (${dup.assessment_code}). Resubmit with force=true to create anyway.`,
      409
    );
  }

  // Publishing on create allowed only if rules pass
  if (header.status === "published" && total_questions < 1) {
    throw new AppError("Cannot publish an assessment without questions.", 400);
  }

  const id = uuidv4();
  const code = await nextCode(collegeId);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO college_assessments
         (id, college_id, assessment_code, name, description, assessment_type, category,
          duration_minutes, passing_marks, total_marks, total_questions, instructions,
          status, created_by, updated_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14, TRUE)`,
      [
        id,
        collegeId,
        code,
        header.name,
        header.description,
        header.assessment_type,
        header.category,
        header.duration_minutes,
        header.passing_marks,
        total_marks,
        total_questions,
        header.instructions,
        header.status,
        actor.id,
      ]
    );
    await replaceQuestions(client, id, questions);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_CREATED",
    target_type: "assessment",
    target_id: id,
    reason: `College assessment created (${code})`,
    metadata: {
      college_id: collegeId,
      assessment_code: code,
      total_questions,
      total_marks,
      status: header.status,
    },
    ip_address: actor.ip,
  }).catch(() => {});

  return getAssessment(collegeId, id);
}

export async function updateAssessment(
  collegeId: string,
  id: string,
  body: AssessmentInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeAssessmentSchema();
  const existing = await getAssessment(collegeId, id);
  const header = validateHeader(
    { ...body, status: body.status ?? existing.status },
    "update"
  );
  const questions = await resolveQuestions(collegeId, body.questions || []);
  const total_marks = questions.reduce((s, q) => s + q.marks, 0);
  const total_questions = questions.length;

  if (header.passing_marks > total_marks) {
    throw new AppError("Passing Marks cannot exceed Total Marks.", 400);
  }

  const dup = await findDuplicateName(collegeId, header.name, id);
  if (dup && !body.force) {
    throw new AppError(
      `Duplicate assessment name warning: similar assessment exists (${dup.assessment_code}). Resubmit with force=true to save anyway.`,
      409
    );
  }

  if (existing.status === "published" && header.status === "draft") {
    throw new AppError(
      "Invalid status transition: Published assessments cannot return to Draft. Archive instead.",
      400
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE college_assessments
       SET name = $1, description = $2, assessment_type = $3, category = $4,
           duration_minutes = $5, passing_marks = $6, total_marks = $7,
           total_questions = $8, instructions = $9, status = $10::varchar,
           updated_by = $11, updated_at = NOW(),
           is_active = CASE WHEN $10::text = 'archived' THEN FALSE ELSE TRUE END
       WHERE id = $12 AND college_id = $13 AND deleted_at IS NULL`,
      [
        header.name,
        header.description,
        header.assessment_type,
        header.category,
        header.duration_minutes,
        header.passing_marks,
        total_marks,
        total_questions,
        header.instructions,
        header.status,
        actor.id,
        id,
        collegeId,
      ]
    );
    await replaceQuestions(client, id, questions);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_UPDATED",
    target_type: "assessment",
    target_id: id,
    reason: `College assessment updated (${existing.assessment_code})`,
    metadata: { status: header.status, total_questions, total_marks },
    ip_address: actor.ip,
  }).catch(() => {});

  return getAssessment(collegeId, id);
}

export async function publishAssessment(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getAssessment(collegeId, id);
  if (!existing.questions?.length) {
    throw new AppError("Cannot publish an assessment without questions.", 400);
  }
  if (existing.passing_marks > existing.total_marks) {
    throw new AppError("Passing Marks cannot exceed Total Marks.", 400);
  }
  if (existing.duration_minutes <= 0) {
    throw new AppError("Duration must be greater than zero.", 400);
  }

  await query(
    `UPDATE college_assessments
     SET status = 'published', is_active = TRUE, updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_PUBLISHED",
    target_type: "assessment",
    target_id: id,
    reason: `Assessment published (${existing.assessment_code})`,
    metadata: { from: existing.status },
    ip_address: actor.ip,
  }).catch(() => {});

  return getAssessment(collegeId, id);
}

export async function archiveAssessment(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getAssessment(collegeId, id);
  await query(
    `UPDATE college_assessments
     SET status = 'archived', is_active = FALSE, updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_ARCHIVED",
    target_type: "assessment",
    target_id: id,
    reason: `Assessment archived (${existing.assessment_code})`,
    metadata: { from: existing.status },
    ip_address: actor.ip,
  }).catch(() => {});

  return getAssessment(collegeId, id);
}

export async function duplicateAssessment(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const src = await getAssessment(collegeId, id);
  return createAssessment(
    collegeId,
    {
      name: `${src.name} (Copy)`,
      description: src.description,
      assessment_type: src.assessment_type,
      category: src.category,
      duration_minutes: src.duration_minutes,
      passing_marks: src.passing_marks,
      instructions: src.instructions,
      status: "draft",
      force: true,
      questions: (src.questions || []).map((q, i) => ({
        question_id: q.question_id,
        display_order: i,
        marks: q.marks,
      })),
    },
    actor
  );
}

export async function softDeleteAssessment(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const existing = await getAssessment(collegeId, id);
  if (existing.status === "published") {
    throw new AppError("Published assessments cannot be deleted. Archive them first.", 400);
  }

  await query(
    `UPDATE college_assessments
     SET deleted_at = NOW(), is_active = FALSE, status = 'archived',
         updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_DELETED",
    target_type: "assessment",
    target_id: id,
    reason: `Soft-deleted assessment (${existing.assessment_code})`,
    metadata: { college_id: collegeId },
    ip_address: actor.ip,
  }).catch(() => {});

  return { success: true, id };
}

export function metaCatalog() {
  return {
    types: ASSESSMENT_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
    categories: ASSESSMENT_CATEGORIES.map((c) => ({
      value: c,
      label: CATEGORY_LABELS[c],
    })),
    statuses: ASSESSMENT_STATUSES.map((s) => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    })),
  };
}
