/**
 * Phase 2 Module 03 — College Portal Question Bank.
 */
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";

export const CATEGORIES = [
  "aptitude",
  "logical_reasoning",
  "english",
  "technical",
  "domain",
] as const;

export const QUESTION_TYPES = [
  "mcq_single",
  "mcq_multiple",
  "true_false",
  "short_answer",
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const STATUSES = ["draft", "active", "inactive"] as const;

export type CollegeCategory = (typeof CATEGORIES)[number];
export type CollegeQuestionType = (typeof QUESTION_TYPES)[number];
export type CollegeDifficulty = (typeof DIFFICULTIES)[number];
export type CollegeQuestionStatus = (typeof STATUSES)[number];

export const CATEGORY_LABELS: Record<CollegeCategory, string> = {
  aptitude: "Aptitude",
  logical_reasoning: "Logical Reasoning",
  english: "English",
  technical: "Technical",
  domain: "Domain",
};

export const TYPE_LABELS: Record<CollegeQuestionType, string> = {
  mcq_single: "Multiple Choice (Single Answer)",
  mcq_multiple: "Multiple Choice (Multiple Answers)",
  true_false: "True / False",
  short_answer: "Short Answer",
};

export interface QuestionOptionInput {
  option_label?: string;
  option_text: string;
  is_correct?: boolean;
  display_order?: number;
}

export interface QuestionInput {
  title: string;
  description?: string | null;
  category: string;
  question_type: string;
  difficulty: string;
  marks: number;
  correct_answer?: string | null;
  status?: string;
  options?: QuestionOptionInput[];
  force?: boolean;
}

export interface QuestionOptionRow {
  id: string;
  question_id: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order: number;
}

export interface QuestionRow {
  id: string;
  college_id: string;
  question_code: string;
  title: string;
  description: string | null;
  category: CollegeCategory;
  question_type: CollegeQuestionType;
  difficulty: CollegeDifficulty;
  marks: number;
  correct_answer: string | null;
  status: CollegeQuestionStatus;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  options?: QuestionOptionRow[];
}

let schemaReady = false;

export async function ensureCollegeQuestionBankSchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS college_questions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id),
      question_code VARCHAR(40) NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category VARCHAR(50) NOT NULL,
      question_type VARCHAR(50) NOT NULL,
      difficulty VARCHAR(20) NOT NULL,
      marks NUMERIC(8,2) NOT NULL DEFAULT 1,
      correct_answer TEXT,
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
    CREATE TABLE IF NOT EXISTS college_question_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      question_id UUID NOT NULL REFERENCES college_questions(id) ON DELETE CASCADE,
      option_label VARCHAR(5) NOT NULL,
      option_text TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE,
      display_order INT NOT NULL DEFAULT 0
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_questions_code_unique
      ON college_questions (college_id, question_code)
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_questions_college
      ON college_questions (college_id) WHERE deleted_at IS NULL
  `).catch(() => {});

  // Learning Intelligence metadata (Module 07/08)
  await query(`ALTER TABLE college_questions ADD COLUMN IF NOT EXISTS topic VARCHAR(120)`).catch(() => {});
  await query(`ALTER TABLE college_questions ADD COLUMN IF NOT EXISTS sub_topic VARCHAR(120)`).catch(() => {});
  await query(`ALTER TABLE college_questions ADD COLUMN IF NOT EXISTS bloom_level VARCHAR(40)`).catch(() => {});
  await query(`ALTER TABLE college_questions ADD COLUMN IF NOT EXISTS learning_outcome TEXT`).catch(() => {});

  // Best-effort backfill so analytics are not empty for existing banks
  await query(`
    UPDATE college_questions SET
      topic = COALESCE(NULLIF(topic, ''), category),
      sub_topic = COALESCE(NULLIF(sub_topic, ''), question_type),
      bloom_level = COALESCE(NULLIF(bloom_level, ''), CASE LOWER(difficulty)
        WHEN 'easy' THEN 'Remember'
        WHEN 'beginner' THEN 'Understand'
        WHEN 'medium' THEN 'Apply'
        WHEN 'intermediate' THEN 'Apply'
        WHEN 'hard' THEN 'Analyze'
        WHEN 'advanced' THEN 'Evaluate'
        WHEN 'expert' THEN 'Create'
        ELSE 'Understand'
      END),
      learning_outcome = COALESCE(
        NULLIF(learning_outcome, ''),
        'Demonstrate competence in ' || COALESCE(category, 'General') ||
          ' (' || COALESCE(difficulty, 'mixed') || ')'
      )
    WHERE deleted_at IS NULL
      AND (
        topic IS NULL OR sub_topic IS NULL OR bloom_level IS NULL OR learning_outcome IS NULL
        OR topic = '' OR sub_topic = '' OR bloom_level = '' OR learning_outcome = ''
      )
  `).catch(() => {});

  schemaReady = true;
}

function isCategory(v: string): v is CollegeCategory {
  return (CATEGORIES as readonly string[]).includes(v);
}
function isType(v: string): v is CollegeQuestionType {
  return (QUESTION_TYPES as readonly string[]).includes(v);
}
function isDifficulty(v: string): v is CollegeDifficulty {
  return (DIFFICULTIES as readonly string[]).includes(v);
}
function isStatus(v: string): v is CollegeQuestionStatus {
  return (STATUSES as readonly string[]).includes(v);
}

function normalizeCategory(raw: string): CollegeCategory | null {
  const s = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  const map: Record<string, CollegeCategory> = {
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

function normalizeType(raw: string): CollegeQuestionType | null {
  const s = raw.trim().toLowerCase().replace(/[\s\-]+/g, "_");
  const map: Record<string, CollegeQuestionType> = {
    mcq_single: "mcq_single",
    multiple_choice: "mcq_single",
    multiple_choice_single: "mcq_single",
    mcq: "mcq_single",
    single: "mcq_single",
    mcq_multiple: "mcq_multiple",
    multiple_choice_multiple: "mcq_multiple",
    multiple_answers: "mcq_multiple",
    multi: "mcq_multiple",
    true_false: "true_false",
    truefalse: "true_false",
    boolean: "true_false",
    short_answer: "short_answer",
    short: "short_answer",
  };
  return map[s] ?? (isType(s) ? s : null);
}

function normalizeDifficulty(raw: string): CollegeDifficulty | null {
  const s = raw.trim().toLowerCase();
  return isDifficulty(s) ? s : null;
}

async function nextQuestionCode(collegeId: string): Promise<string> {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM college_questions WHERE college_id = $1`,
    [collegeId]
  );
  const n = (Number(row?.n) || 0) + 1;
  return `CQ-${String(n).padStart(5, "0")}`;
}

function validatePayload(body: QuestionInput, mode: "create" | "update") {
  const title = (body.title || "").trim();
  if (!title) throw new AppError("Question Title is mandatory.", 400);

  const category = normalizeCategory(String(body.category || ""));
  if (!category) {
    throw new AppError(
      `Invalid Category. Allowed: ${CATEGORIES.map((c) => CATEGORY_LABELS[c]).join(", ")}.`,
      400
    );
  }

  const question_type = normalizeType(String(body.question_type || ""));
  if (!question_type) {
    throw new AppError(
      `Invalid Question Type. Allowed: ${QUESTION_TYPES.map((t) => TYPE_LABELS[t]).join(", ")}.`,
      400
    );
  }

  const difficulty = normalizeDifficulty(String(body.difficulty || ""));
  if (!difficulty) throw new AppError("Invalid Difficulty. Allowed: Easy, Medium, Hard.", 400);

  const marks = Number(body.marks);
  if (!Number.isFinite(marks) || marks <= 0) {
    throw new AppError("Marks must be greater than zero.", 400);
  }

  let status: CollegeQuestionStatus = "draft";
  if (body.status != null && String(body.status).trim() !== "") {
    const s = String(body.status).trim().toLowerCase();
    if (!isStatus(s)) throw new AppError("Invalid Status. Allowed: Draft, Active, Inactive.", 400);
    status = s;
  } else if (mode === "create") {
    status = "draft";
  }

  const options = Array.isArray(body.options) ? body.options : [];
  let correct_answer = body.correct_answer != null ? String(body.correct_answer).trim() : "";

  if (question_type === "mcq_single" || question_type === "mcq_multiple") {
    const filled = options
      .map((o, i) => ({
        option_label: (o.option_label || String.fromCharCode(65 + i)).toUpperCase().slice(0, 5),
        option_text: String(o.option_text || "").trim(),
        is_correct: !!o.is_correct,
        display_order: o.display_order ?? i,
      }))
      .filter((o) => o.option_text.length > 0);

    if (filled.length < 2) {
      throw new AppError("At least two options are required for MCQ questions.", 400);
    }
    const correctCount = filled.filter((o) => o.is_correct).length;
    if (correctCount < 1) {
      throw new AppError("At least one correct answer is required.", 400);
    }
    if (question_type === "mcq_single" && correctCount > 1) {
      throw new AppError("Single-answer MCQ must have exactly one correct option.", 400);
    }
    correct_answer = filled
      .filter((o) => o.is_correct)
      .map((o) => o.option_label)
      .join(",");
    return {
      title,
      description: body.description?.trim() || null,
      category,
      question_type,
      difficulty,
      marks,
      status,
      correct_answer,
      options: filled,
    };
  }

  if (question_type === "true_false") {
    const ans = correct_answer.toLowerCase();
    if (ans !== "true" && ans !== "false") {
      throw new AppError("True / False questions require Correct Answer of True or False.", 400);
    }
    const opts = [
      { option_label: "A", option_text: "True", is_correct: ans === "true", display_order: 0 },
      { option_label: "B", option_text: "False", is_correct: ans === "false", display_order: 1 },
    ];
    return {
      title,
      description: body.description?.trim() || null,
      category,
      question_type,
      difficulty,
      marks,
      status,
      correct_answer: ans === "true" ? "True" : "False",
      options: opts,
    };
  }

  // short_answer
  if (!correct_answer) {
    throw new AppError("Expected answer is required for Short Answer questions.", 400);
  }
  return {
    title,
    description: body.description?.trim() || null,
    category,
    question_type,
    difficulty,
    marks,
    status,
    correct_answer,
    options: [] as Array<{
      option_label: string;
      option_text: string;
      is_correct: boolean;
      display_order: number;
    }>,
  };
}

async function findDuplicateTitle(
  collegeId: string,
  title: string,
  excludeId?: string
) {
  return queryOne<{ id: string; question_code: string }>(
    `SELECT id, question_code FROM college_questions
     WHERE college_id = $1 AND deleted_at IS NULL
       AND LOWER(TRIM(title)) = LOWER(TRIM($2))
       AND ($3::uuid IS NULL OR id <> $3)
     LIMIT 1`,
    [collegeId, title, excludeId ?? null]
  );
}

export async function listQuestions(
  collegeId: string,
  filters: {
    search?: string;
    category?: string;
    question_type?: string;
    difficulty?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort?: string;
    order?: "asc" | "desc";
  }
) {
  await ensureCollegeQuestionBankSchema();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * limit;

  const params: unknown[] = [collegeId];
  let i = 2;
  let where = `WHERE q.college_id = $1 AND q.deleted_at IS NULL`;

  if (filters.search?.trim()) {
    where += ` AND (q.title ILIKE $${i} OR q.description ILIKE $${i} OR q.question_code ILIKE $${i})`;
    params.push(`%${filters.search.trim()}%`);
    i++;
  }
  if (filters.category) {
    const c = normalizeCategory(filters.category);
    if (c) {
      where += ` AND q.category = $${i++}`;
      params.push(c);
    }
  }
  if (filters.question_type) {
    const t = normalizeType(filters.question_type);
    if (t) {
      where += ` AND q.question_type = $${i++}`;
      params.push(t);
    }
  }
  if (filters.difficulty) {
    const d = normalizeDifficulty(filters.difficulty);
    if (d) {
      where += ` AND q.difficulty = $${i++}`;
      params.push(d);
    }
  }
  if (filters.status) {
    const s = filters.status.trim().toLowerCase();
    if (isStatus(s)) {
      where += ` AND q.status = $${i++}`;
      params.push(s);
    }
  }

  const sortMap: Record<string, string> = {
    title: "q.title",
    category: "q.category",
    difficulty: "q.difficulty",
    marks: "q.marks",
    status: "q.status",
    created_at: "q.created_at",
    updated_at: "q.updated_at",
    question_code: "q.question_code",
  };
  const sortCol = sortMap[filters.sort || "updated_at"] || "q.updated_at";
  const order = filters.order === "asc" ? "ASC" : "DESC";

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM college_questions q ${where}`,
    params
  );
  const total = Number(countRow?.total || 0);

  const rows = await query<QuestionRow>(
    `SELECT q.id, q.college_id, q.question_code, q.title, q.description,
            q.category, q.question_type, q.difficulty, q.marks::float AS marks,
            q.correct_answer, q.status, q.created_by, q.updated_by,
            cu.name AS created_by_name, uu.name AS updated_by_name,
            q.created_at::text, q.updated_at::text, q.is_active
     FROM college_questions q
     LEFT JOIN users cu ON cu.id = q.created_by
     LEFT JOIN users uu ON uu.id = q.updated_by
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

async function loadOptions(questionId: string) {
  return query<QuestionOptionRow>(
    `SELECT id, question_id, option_label, option_text, is_correct, display_order
     FROM college_question_options
     WHERE question_id = $1
     ORDER BY display_order ASC, option_label ASC`,
    [questionId]
  );
}

export async function getQuestion(collegeId: string, id: string) {
  await ensureCollegeQuestionBankSchema();
  const row = await queryOne<QuestionRow>(
    `SELECT q.id, q.college_id, q.question_code, q.title, q.description,
            q.category, q.question_type, q.difficulty, q.marks::float AS marks,
            q.correct_answer, q.status, q.created_by, q.updated_by,
            cu.name AS created_by_name, uu.name AS updated_by_name,
            q.created_at::text, q.updated_at::text, q.is_active
     FROM college_questions q
     LEFT JOIN users cu ON cu.id = q.created_by
     LEFT JOIN users uu ON uu.id = q.updated_by
     WHERE q.id = $1 AND q.college_id = $2 AND q.deleted_at IS NULL`,
    [id, collegeId]
  );
  if (!row) throw new AppError("Question not found.", 404);
  row.options = await loadOptions(id);
  return row;
}

async function insertOptions(
  client: { query: typeof pool.query },
  questionId: string,
  options: Array<{
    option_label: string;
    option_text: string;
    is_correct: boolean;
    display_order: number;
  }>
) {
  for (const o of options) {
    await client.query(
      `INSERT INTO college_question_options
         (question_id, option_label, option_text, is_correct, display_order)
       VALUES ($1,$2,$3,$4,$5)`,
      [questionId, o.option_label, o.option_text, o.is_correct, o.display_order]
    );
  }
}

export async function createQuestion(
  collegeId: string,
  body: QuestionInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeQuestionBankSchema();
  const data = validatePayload(body, "create");

  const dup = await findDuplicateTitle(collegeId, data.title);
  if (dup && !body.force) {
    throw new AppError(
      `Duplicate question title warning: similar question already exists (${dup.question_code}). Resubmit with force=true to create anyway.`,
      409
    );
  }

  const code = await nextQuestionCode(collegeId);
  const id = uuidv4();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO college_questions
         (id, college_id, question_code, title, description, category, question_type,
          difficulty, marks, correct_answer, status, created_by, updated_by, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12, TRUE)`,
      [
        id,
        collegeId,
        code,
        data.title,
        data.description,
        data.category,
        data.question_type,
        data.difficulty,
        data.marks,
        data.correct_answer,
        data.status,
        actor.id,
      ]
    );
    await insertOptions(client, id, data.options);
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
    action: "QUESTION_CREATED",
    target_type: "question",
    target_id: id,
    reason: `College question created (${code})`,
    metadata: { college_id: collegeId, question_code: code, category: data.category },
    ip_address: actor.ip,
  }).catch(() => {});

  return getQuestion(collegeId, id);
}

export async function updateQuestion(
  collegeId: string,
  id: string,
  body: QuestionInput,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeQuestionBankSchema();
  const existing = await getQuestion(collegeId, id);
  const data = validatePayload(
    {
      ...body,
      status: body.status ?? existing.status,
    },
    "update"
  );

  const dup = await findDuplicateTitle(collegeId, data.title, id);
  if (dup && !body.force) {
    throw new AppError(
      `Duplicate question title warning: similar question already exists (${dup.question_code}). Resubmit with force=true to save anyway.`,
      409
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE college_questions
       SET title = $1, description = $2, category = $3, question_type = $4,
           difficulty = $5, marks = $6, correct_answer = $7, status = $8::varchar,
           updated_by = $9, updated_at = NOW(),
           is_active = CASE WHEN $8::text = 'inactive' THEN FALSE ELSE TRUE END
       WHERE id = $10 AND college_id = $11 AND deleted_at IS NULL`,
      [
        data.title,
        data.description,
        data.category,
        data.question_type,
        data.difficulty,
        data.marks,
        data.correct_answer,
        data.status,
        actor.id,
        id,
        collegeId,
      ]
    );
    await client.query(`DELETE FROM college_question_options WHERE question_id = $1`, [id]);
    await insertOptions(client, id, data.options);
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
    action: "QUESTION_UPDATED",
    target_type: "question",
    target_id: id,
    reason: `College question updated (${existing.question_code})`,
    metadata: { college_id: collegeId, status: data.status },
    ip_address: actor.ip,
  }).catch(() => {});

  return getQuestion(collegeId, id);
}

export async function patchQuestionStatus(
  collegeId: string,
  id: string,
  statusRaw: string,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeQuestionBankSchema();
  const status = statusRaw.trim().toLowerCase();
  if (!isStatus(status)) {
    throw new AppError("Invalid Status. Allowed: Draft, Active, Inactive.", 400);
  }
  const existing = await getQuestion(collegeId, id);

  await query(
    `UPDATE college_questions
     SET status = $1::varchar,
         is_active = CASE WHEN $1::text = 'inactive' THEN FALSE ELSE TRUE END,
         updated_by = $2,
         updated_at = NOW()
     WHERE id = $3 AND college_id = $4 AND deleted_at IS NULL`,
    [status, actor.id, id, collegeId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "QUESTION_UPDATED",
    target_type: "question",
    target_id: id,
    reason: `Status changed to ${status}`,
    metadata: { from: existing.status, to: status, college_id: collegeId },
    ip_address: actor.ip,
  }).catch(() => {});

  return getQuestion(collegeId, id);
}

export async function softDeleteQuestion(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeQuestionBankSchema();
  const existing = await getQuestion(collegeId, id);
  await query(
    `UPDATE college_questions
     SET deleted_at = NOW(), is_active = FALSE, status = 'inactive',
         updated_by = $1, updated_at = NOW()
     WHERE id = $2 AND college_id = $3 AND deleted_at IS NULL`,
    [actor.id, id, collegeId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "QUESTION_DELETED",
    target_type: "question",
    target_id: id,
    reason: `Soft-deleted college question (${existing.question_code})`,
    metadata: { college_id: collegeId },
    ip_address: actor.ip,
  }).catch(() => {});

  return { success: true, id };
}

const BULK_ACTIONS = ["activate", "deactivate", "delete"] as const;
export type BulkQuestionAction = (typeof BULK_ACTIONS)[number];

export async function bulkUpdateQuestions(
  collegeId: string,
  ids: string[],
  action: string,
  actor: { id: string; role: string; ip?: string }
) {
  if (!BULK_ACTIONS.includes(action as BulkQuestionAction)) {
    throw new AppError(`Invalid action. Allowed: ${BULK_ACTIONS.join(", ")}.`, 400);
  }
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === "string" && id.trim())));
  if (!uniqueIds.length) throw new AppError("No questions selected.", 400);
  if (uniqueIds.length > 200) throw new AppError("Maximum 200 questions per bulk action.", 400);

  const successful: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const id of uniqueIds) {
    try {
      if (action === "delete") {
        await softDeleteQuestion(collegeId, id, actor);
      } else {
        await patchQuestionStatus(collegeId, id, action === "activate" ? "active" : "inactive", actor);
      }
      successful.push(id);
    } catch (e: any) {
      failed.push({ id, error: e?.message || "Update failed" });
    }
  }

  return {
    summary: { total: uniqueIds.length, successful: successful.length, failed: failed.length },
    successful,
    failed,
  };
}

export async function duplicateQuestion(
  collegeId: string,
  id: string,
  actor: { id: string; role: string; ip?: string }
) {
  const src = await getQuestion(collegeId, id);
  return createQuestion(
    collegeId,
    {
      title: `${src.title} (Copy)`,
      description: src.description,
      category: src.category,
      question_type: src.question_type,
      difficulty: src.difficulty,
      marks: src.marks,
      correct_answer: src.correct_answer,
      status: "draft",
      force: true,
      options: (src.options || []).map((o) => ({
        option_label: o.option_label,
        option_text: o.option_text,
        is_correct: o.is_correct,
        display_order: o.display_order,
      })),
    },
    actor
  );
}

export interface AiGeneratedQuestion {
  question: string;
  options?: string[];
  correct_answer: string;
  category?: string;
  difficulty?: string;
}

/** Maps the AI question engine's broader category set onto the college portal's 5 categories. */
function mapAiCategory(raw: string | undefined): CollegeCategory {
  const s = (raw || "").toLowerCase();
  if (s === "reasoning") return "logical_reasoning";
  if (s === "aptitude" || s === "maths") return "aptitude";
  if (["data_structures", "programming", "python_coding", "java_coding", "data_science"].includes(s)) {
    return "technical";
  }
  return "domain";
}

function mapAiDifficulty(raw: string | undefined): CollegeDifficulty {
  const s = (raw || "").toLowerCase();
  if (s === "expert") return "hard";
  return isDifficulty(s) ? s : "medium";
}

/**
 * Imports AI-generated questions (from POST /api/qb-ai/generate) into this
 * college's question bank, going through the same createQuestion() path as
 * manual creation — so duplicate-title detection, validation, and audit
 * logging all apply identically. Lands as 'draft' pending human review,
 * same as the global question_bank AI import does.
 */
export async function importAiGeneratedQuestions(
  collegeId: string,
  questions: AiGeneratedQuestion[],
  actor: { id: string; role: string; ip?: string }
) {
  const successful: string[] = [];
  const failed: Array<{ index: number; error: string }> = [];
  const skipped: Array<{ index: number; reason: string }> = [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    try {
      const options = (q.options || []).map((text, idx) => ({
        option_label: String.fromCharCode(65 + idx),
        option_text: text,
        is_correct: text.trim() === (q.correct_answer || "").trim(),
        display_order: idx,
      }));
      const hasCorrect = options.some((o) => o.is_correct);

      const created = await createQuestion(
        collegeId,
        {
          title: q.question,
          category: mapAiCategory(q.category),
          question_type: options.length >= 2 ? "mcq_single" : "short_answer",
          difficulty: mapAiDifficulty(q.difficulty),
          marks: 1,
          correct_answer: options.length >= 2 ? undefined : q.correct_answer,
          status: "draft",
          options:
            options.length >= 2
              ? hasCorrect
                ? options
                : options.map((o, idx) => ({ ...o, is_correct: idx === 0 }))
              : [],
        },
        actor
      );
      successful.push(created.id);
    } catch (e: any) {
      const msg = e?.message || "Import failed";
      if (String(msg).toLowerCase().includes("duplicate")) {
        skipped.push({ index: i, reason: msg });
      } else {
        failed.push({ index: i, error: msg });
      }
    }
  }

  return {
    summary: { total: questions.length, successful: successful.length, failed: failed.length, skipped: skipped.length },
    successful,
    failed,
    skipped,
  };
}

// SheetJS Community Edition (the `xlsx` package used for parsing imports)
// cannot write data-validation dropdowns, so the downloadable template is
// built with ExcelJS instead — dropdowns are what stop typo'd category/
// difficulty values from failing bulk import (see E1 in the college module
// feedback backlog).
export async function buildImportTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Questions");

  sheet.columns = [
    { header: "Question", key: "question", width: 50 },
    { header: "Category", key: "category", width: 20 },
    { header: "Type", key: "type", width: 16 },
    { header: "Difficulty", key: "difficulty", width: 12 },
    { header: "Marks", key: "marks", width: 8 },
    { header: "Option A", key: "optionA", width: 20 },
    { header: "Option B", key: "optionB", width: 20 },
    { header: "Option C", key: "optionC", width: 20 },
    { header: "Option D", key: "optionD", width: 20 },
    { header: "Correct Answer", key: "correctAnswer", width: 16 },
  ];

  sheet.addRow({
    question: "What is 2 + 2?",
    category: CATEGORY_LABELS.aptitude,
    type: "mcq_single",
    difficulty: "Easy",
    marks: 1,
    optionA: "3",
    optionB: "4",
    optionC: "5",
    optionD: "6",
    correctAnswer: "B",
  });

  const categoryOptions = CATEGORIES.map((c) => CATEGORY_LABELS[c]);
  const typeOptions = [...QUESTION_TYPES];
  const difficultyOptions = DIFFICULTIES.map((d) => d.charAt(0).toUpperCase() + d.slice(1));

  const dropdown = (options: string[], errorTitle: string) => ({
    type: "list" as const,
    allowBlank: true,
    formulae: [`"${options.join(",")}"`],
    showErrorMessage: true,
    errorTitle,
    error: `Choose one of: ${options.join(", ")}`,
  });

  const MAX_ROW = 501; // header + up to 500 data rows, matching the import cap
  for (let row = 2; row <= MAX_ROW; row++) {
    sheet.getCell(`B${row}`).dataValidation = dropdown(categoryOptions, "Invalid Category");
    sheet.getCell(`C${row}`).dataValidation = dropdown(typeOptions, "Invalid Type");
    sheet.getCell(`D${row}`).dataValidation = dropdown(difficultyOptions, "Invalid Difficulty");
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

function cell(row: Record<string, unknown>, ...keys: string[]) {
  for (const k of keys) {
    const found = Object.keys(row).find(
      (rk) => rk.trim().toLowerCase().replace(/[\s_]+/g, " ") === k.toLowerCase()
    );
    if (found != null && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return "";
}

export async function importQuestionsFromExcel(
  collegeId: string,
  buffer: Buffer,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureCollegeQuestionBankSchema();
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) throw new AppError("Excel file has no sheets.", 400);
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!raw.length) throw new AppError("Excel file has no data rows.", 400);
  if (raw.length > 500) throw new AppError("Maximum 500 questions per import.", 400);

  const successful: string[] = [];
  const failed: Array<{ row: number; error: string }> = [];
  const skipped: Array<{ row: number; reason: string }> = [];

  for (let idx = 0; idx < raw.length; idx++) {
    const rowNum = idx + 2;
    const r = raw[idx];
    try {
      const title = cell(r, "question", "question title", "title");
      const category = cell(r, "category");
      const type = cell(r, "type", "question type");
      const difficulty = cell(r, "difficulty");
      const marks = Number(cell(r, "marks") || "0");
      const a = cell(r, "option a", "option_a", "a");
      const b = cell(r, "option b", "option_b", "b");
      const c = cell(r, "option c", "option_c", "c");
      const d = cell(r, "option d", "option_d", "d");
      const correct = cell(r, "correct answer", "correct_answer", "answer");

      const qType = normalizeType(type) || "mcq_single";
      const options = [
        { option_label: "A", option_text: a, is_correct: false, display_order: 0 },
        { option_label: "B", option_text: b, is_correct: false, display_order: 1 },
        { option_label: "C", option_text: c, is_correct: false, display_order: 2 },
        { option_label: "D", option_text: d, is_correct: false, display_order: 3 },
      ];

      let correct_answer = correct;
      if (qType === "mcq_single" || qType === "mcq_multiple") {
        const labels = correct
          .toUpperCase()
          .split(/[,|;/\s]+/)
          .map((x) => x.trim())
          .filter(Boolean);
        for (const o of options) {
          o.is_correct = labels.includes(o.option_label);
        }
      } else if (qType === "true_false") {
        correct_answer = correct;
      } else {
        correct_answer = correct;
      }

      const created = await createQuestion(
        collegeId,
        {
          title,
          category,
          question_type: qType,
          difficulty,
          marks,
          correct_answer,
          status: "draft",
          options:
            qType === "short_answer"
              ? []
              : qType === "true_false"
                ? undefined
                : options.filter((o) => o.option_text),
        },
        actor
      );
      successful.push(created.id);
    } catch (e: any) {
      const msg = e?.message || "Import failed";
      if (String(msg).toLowerCase().includes("duplicate")) {
        skipped.push({ row: rowNum, reason: msg });
      } else {
        failed.push({ row: rowNum, error: msg });
      }
    }
  }

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "QUESTION_CREATED",
    target_type: "campus",
    target_id: collegeId,
    reason: `Bulk imported ${successful.length} college questions`,
    metadata: {
      total: raw.length,
      successful: successful.length,
      failed: failed.length,
      skipped: skipped.length,
    },
    ip_address: actor.ip,
  }).catch(() => {});

  return {
    summary: {
      total: raw.length,
      successful: successful.length,
      failed: failed.length,
      skipped: skipped.length,
    },
    successful,
    failed,
    skipped,
  };
}

export function metaCatalog() {
  return {
    categories: CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
    types: QUESTION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] })),
    difficulties: DIFFICULTIES.map((d) => ({
      value: d,
      label: d.charAt(0).toUpperCase() + d.slice(1),
    })),
    statuses: STATUSES.map((s) => ({
      value: s,
      label: s.charAt(0).toUpperCase() + s.slice(1),
    })),
  };
}
