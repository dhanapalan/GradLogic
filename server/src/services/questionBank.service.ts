import { query, queryOne } from "../config/database.js";
import {
  QuestionBankRow,
  QuestionCategory,
  QuestionType,
  DifficultyLevel,
} from "../types/index.js";
import { embed } from "./ai.service.js";
import { logger } from "../config/logger.js";

// ── Filters for listing / filtering ──────────────────────────────────────────

export interface QuestionFilters {
  category?: QuestionCategory;
  type?: QuestionType;
  difficulty_level?: DifficultyLevel;
  tags?: string[];
  search?: string; // full-text search on question_text
  is_active?: boolean;
  status?: string;
  bloom_level?: string;
  source?: "ai-generated" | "manual";
  limit?: number;
  offset?: number;
}

// ── CREATE ───────────────────────────────────────────────────────────────────

export interface CreateQuestionInput {
  category: QuestionCategory;
  type: QuestionType;
  difficulty_level: DifficultyLevel;
  question_text: string;
  options?: unknown[] | null;
  correct_answer?: string | null;
  test_cases?: unknown[] | null;
  starter_code?: Record<string, string> | null;
  time_limit_ms?: number;
  memory_limit_kb?: number;
  marks?: number;
  tags?: string[];
  explanation?: string | null;
  created_by?: string | null;
  status?: string;
  bloom_level?: string | null;
}

// ── QUERIES ──────────────────────────────────────────────────────────────────

/**
 * List questions with optional filters, pagination, and full-text search.
 */
export async function filterQuestions(filters: QuestionFilters = {}) {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (filters.category) {
    conditions.push(`category = $${idx++}`);
    params.push(filters.category);
  }
  if (filters.type) {
    conditions.push(`type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters.difficulty_level) {
    conditions.push(`difficulty_level = $${idx++}`);
    params.push(filters.difficulty_level);
  }
  if (filters.is_active !== undefined) {
    conditions.push(`is_active = $${idx++}`);
    params.push(filters.is_active);
  }
  if (filters.tags && filters.tags.length > 0) {
    conditions.push(`tags && $${idx++}`); // overlap operator
    params.push(filters.tags);
  }
  if (filters.status) {
    conditions.push(`status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters.bloom_level) {
    conditions.push(`bloom_level = $${idx++}`);
    params.push(filters.bloom_level);
  }
  if (filters.source === "ai-generated") {
    conditions.push(`'ai-generated' = ANY(tags)`);
  } else if (filters.source === "manual") {
    conditions.push(`NOT ('ai-generated' = ANY(tags))`);
  }
  if (filters.search) {
    conditions.push(`to_tsvector('english', question_text) @@ plainto_tsquery('english', $${idx++})`);
    params.push(filters.search);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  // Get total count for pagination
  const countResult = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM question_bank ${where}`,
    params,
  );
  const total = parseInt(countResult?.total ?? "0", 10);

  // Get rows
  const rows = await query<QuestionBankRow>(
    `SELECT * FROM question_bank ${where}
     ORDER BY category, difficulty_level, created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    [...params, limit, offset],
  );

  return { rows, total, limit, offset };
}

/**
 * Get a single question by ID.
 */
export async function getQuestionById(id: string) {
  return queryOne<QuestionBankRow>(
    "SELECT * FROM question_bank WHERE id = $1",
    [id],
  );
}

/**
 * Create a new question and asynchronously index its embedding for dedup/search.
 */
export async function createQuestion(input: CreateQuestionInput) {
  const row = await queryOne<QuestionBankRow>(
    `INSERT INTO question_bank
       (category, type, difficulty_level, question_text, options, correct_answer,
        test_cases, starter_code, time_limit_ms, memory_limit_kb, marks, tags,
        explanation, created_by, bloom_level, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      input.category,
      input.type,
      input.difficulty_level,
      input.question_text,
      input.options ? JSON.stringify(input.options) : null,
      input.correct_answer ?? null,
      input.test_cases ? JSON.stringify(input.test_cases) : null,
      input.starter_code ? JSON.stringify(input.starter_code) : null,
      input.time_limit_ms ?? 5000,
      input.memory_limit_kb ?? 262144,
      input.marks ?? 5,
      input.tags ?? [],
      input.explanation ?? null,
      input.created_by ?? null,
      input.bloom_level ?? null,
      input.status ?? "published",
    ],
  );

  // Fire-and-forget: store embedding for semantic dedup/search.
  // Non-fatal — a missing embedding only degrades search quality, not correctness.
  if (row) {
    embed(input.question_text)
      .then(({ vector }) => {
        if (vector.length === 0) return; // AI engine unavailable
        return queryOne(
          `UPDATE question_bank SET embedding = $1 WHERE id = $2`,
          [`[${vector.join(",")}]`, row.id],
        );
      })
      .catch((err) => logger.warn("[QB] Embedding store failed", { id: row?.id, error: err.message }));
  }

  return row;
}

/**
 * Find questions semantically similar to the given text (dedup check).
 * Returns questions with cosine similarity above the threshold.
 */
export async function findSimilarQuestions(
  text: string,
  opts: { threshold?: number; limit?: number } = {},
) {
  const { threshold = 0.92, limit = 5 } = opts;
  const { vector } = await embed(text);
  if (vector.length === 0) return []; // embedding unavailable

  return query<QuestionBankRow & { similarity: number }>(
    `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
     FROM question_bank
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) >= $2
     ORDER BY similarity DESC
     LIMIT $3`,
    [`[${vector.join(",")}]`, threshold, limit],
  );
}

/**
 * Update an existing question (partial update).
 */
export async function updateQuestion(id: string, input: Partial<CreateQuestionInput>) {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  const fieldMap: Record<string, (v: unknown) => unknown> = {
    category: (v) => v,
    type: (v) => v,
    difficulty_level: (v) => v,
    question_text: (v) => v,
    options: (v) => (v ? JSON.stringify(v) : null),
    correct_answer: (v) => v,
    test_cases: (v) => (v ? JSON.stringify(v) : null),
    starter_code: (v) => (v ? JSON.stringify(v) : null),
    time_limit_ms: (v) => v,
    memory_limit_kb: (v) => v,
    marks: (v) => v,
    tags: (v) => v,
    explanation: (v) => v,
    created_by: (v) => v,
    status: (v) => v,
    bloom_level: (v) => v,
  };

  for (const [key, transform] of Object.entries(fieldMap)) {
    if (key in input) {
      sets.push(`${key} = $${idx++}`);
      params.push(transform((input as Record<string, unknown>)[key]));
    }
  }

  if (sets.length === 0) return getQuestionById(id);

  params.push(id);
  return queryOne<QuestionBankRow>(
    `UPDATE question_bank SET ${sets.join(", ")} WHERE id = $${idx} RETURNING *`,
    params,
  );
}

/**
 * Soft-delete: set is_active = false.
 */
export async function deactivateQuestion(id: string) {
  return queryOne<QuestionBankRow>(
    "UPDATE question_bank SET is_active = FALSE WHERE id = $1 RETURNING *",
    [id],
  );
}

/**
 * Hard-delete a question.
 */
export async function deleteQuestion(id: string) {
  return queryOne<{ id: string }>(
    "DELETE FROM question_bank WHERE id = $1 RETURNING id",
    [id],
  );
}

/**
 * Bulk insert questions (for AI-generated batches or CSV imports).
 * Each row is inserted independently so one malformed row (e.g. from a
 * hand-edited CSV) doesn't abort the rest of the batch.
 */
export async function bulkInsert(inputs: CreateQuestionInput[]) {
  const rows: QuestionBankRow[] = [];
  const errors: Array<{ index: number; error: string }> = [];
  for (let i = 0; i < inputs.length; i++) {
    try {
      const row = await createQuestion(inputs[i]);
      if (row) rows.push(row);
    } catch (err) {
      errors.push({ index: i, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { rows, errors };
}

/**
 * Get distinct categories with counts (for dashboard widgets).
 */
export async function getCategoryCounts() {
  return query<{ category: QuestionCategory; count: number }>(
    `SELECT category, COUNT(*)::int AS count
     FROM question_bank
     WHERE is_active = TRUE
     GROUP BY category
     ORDER BY category`,
  );
}

/**
 * Get random questions by filters (for exam generation).
 */
export async function getRandomQuestions(
  category: QuestionCategory,
  type: QuestionType,
  difficulty: DifficultyLevel,
  count: number,
) {
  return query<QuestionBankRow>(
    `SELECT * FROM question_bank
     WHERE category = $1 AND type = $2 AND difficulty_level = $3 AND is_active = TRUE
     ORDER BY RANDOM()
     LIMIT $4`,
    [category, type, difficulty, count],
  );
}

// ── Blueprint Curator ────────────────────────────────────────────────────────

/**
 * Normalize a human-friendly category label to the DB enum value.
 * e.g. "Data Structures" → "data_structures", "Maths" → "maths"
 */
const CATEGORY_ALIAS_MAP: Record<string, QuestionCategory> = {
  reasoning: "reasoning",
  maths: "maths",
  math: "maths",
  aptitude: "aptitude",
  "data structures": "data_structures",
  data_structures: "data_structures",
  ds: "data_structures",
  programming: "programming",
  "coding / programming": "programming",
  "coding": "programming",
  "python coding": "python_coding",
  "java coding": "java_coding",
  "data science": "data_science",
  "sql & databases": "programming",
  "sql": "programming",
  "core cs (ds/algo)": "data_structures",
};

function normalizeCategory(label: string): QuestionCategory {
  const key = label.trim().toLowerCase();
  const mapped = CATEGORY_ALIAS_MAP[key];
  if (!mapped) {
    throw new Error(`Unknown category: "${label}". Valid categories: ${Object.keys(CATEGORY_ALIAS_MAP).join(", ")}`);
  }
  return mapped;
}

export interface BlueprintWeight {
  category: string;   // human-friendly label from frontend
  percentage: number;  // 0-100
}

export interface CuratedBlueprint {
  totalRequested: number;
  totalCurated: number;
  breakdown: {
    category: QuestionCategory;
    requested: number;
    fulfilled: number;
    available: number;
  }[];
  questions: QuestionBankRow[];
}

/**
 * Curate a question set from the question_bank that perfectly matches
 * the requested percentage weights.
 *
 * Algorithm:
 *  1. Convert percentages → absolute question counts (largest-remainder method
 *     so the counts sum exactly to totalQuestions).
 *  2. For each category, SELECT … ORDER BY RANDOM() LIMIT n from the bank.
 *  3. Shuffle the combined result so categories are interleaved.
 *  4. Return the curated list + a breakdown showing requested vs fulfilled.
 */
export async function curateBlueprint(
  weights: BlueprintWeight[],
  totalQuestions: number,
): Promise<CuratedBlueprint> {
  // ── Step 1: Largest-remainder allocation ────────────────────────────────
  const raw = weights.map((w) => ({
    category: normalizeCategory(w.category),
    exact: (w.percentage / 100) * totalQuestions,
  }));

  // Floor each, then distribute remainders (largest remainder method)
  let allocated = raw.map((r) => ({
    category: r.category,
    count: Math.floor(r.exact),
    remainder: r.exact - Math.floor(r.exact),
  }));

  let currentTotal = allocated.reduce((s, a) => s + a.count, 0);
  const deficit = totalQuestions - currentTotal;

  // Sort by remainder desc, give +1 to the top `deficit` entries
  const sorted = [...allocated].sort((a, b) => b.remainder - a.remainder);
  for (let i = 0; i < deficit; i++) {
    sorted[i].count += 1;
  }

  // ── Step 2: Query random questions per category ─────────────────────────
  const breakdown: CuratedBlueprint["breakdown"] = [];
  const allQuestions: QuestionBankRow[] = [];

  for (const entry of allocated) {
    if (entry.count === 0) {
      // Still report in breakdown
      const [countRow] = await query<{ available: number }>(
        `SELECT COUNT(*)::int AS available FROM question_bank
         WHERE category = $1 AND is_active = TRUE`,
        [entry.category],
      );
      breakdown.push({
        category: entry.category,
        requested: 0,
        fulfilled: 0,
        available: countRow?.available ?? 0,
      });
      continue;
    }

    // Count available
    const [countRow] = await query<{ available: number }>(
      `SELECT COUNT(*)::int AS available FROM question_bank
       WHERE category = $1 AND is_active = TRUE`,
      [entry.category],
    );
    const available = countRow?.available ?? 0;

    // Fetch random questions
    const rows = await query<QuestionBankRow>(
      `SELECT * FROM question_bank
       WHERE category = $1 AND is_active = TRUE
       ORDER BY RANDOM()
       LIMIT $2`,
      [entry.category, entry.count],
    );

    allQuestions.push(...rows);
    breakdown.push({
      category: entry.category,
      requested: entry.count,
      fulfilled: rows.length,
      available,
    });
  }

  // ── Step 3: Fisher-Yates shuffle for fair interleaving ──────────────────
  for (let i = allQuestions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
  }

  return {
    totalRequested: totalQuestions,
    totalCurated: allQuestions.length,
    breakdown,
    questions: allQuestions,
  };
}
