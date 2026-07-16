/**
 * Knowledge Library Enterprise ops (Sprint 5) — archive, restore, bulk topic,
 * CSV export, version browsing.
 */

import { query, queryOne } from "../config/database.js";

export async function listArchivedQuestions(limit = 100, search?: string) {
  return query(
    `SELECT id, question_text, category::text AS category, type::text AS type,
            difficulty_level, status, tags, bloom_level, topic_id, updated_at, created_at
     FROM question_bank
     WHERE deleted_at IS NULL AND status = 'archived'
       AND ($1::text IS NULL OR question_text ILIKE '%' || $1 || '%')
     ORDER BY updated_at DESC NULLS LAST, created_at DESC
     LIMIT $2`,
    [search || null, Math.min(limit, 500)]
  );
}

export async function listSoftDeletedQuestions(limit = 100, search?: string) {
  return query(
    `SELECT id, question_text, category::text AS category, type::text AS type,
            difficulty_level, status, tags, bloom_level, topic_id, deleted_at, created_at
     FROM question_bank
     WHERE deleted_at IS NOT NULL
       AND ($1::text IS NULL OR question_text ILIKE '%' || $1 || '%')
     ORDER BY deleted_at DESC
     LIMIT $2`,
    [search || null, Math.min(limit, 500)]
  );
}

export async function restoreQuestions(questionIds: string[], mode: "unarchive" | "undelete" = "unarchive") {
  if (mode === "undelete") {
    return query(
      `UPDATE question_bank
       SET deleted_at = NULL, is_active = TRUE, status = COALESCE(NULLIF(status, ''), 'published'), updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NOT NULL
       RETURNING id`,
      [questionIds]
    );
  }
  return query(
    `UPDATE question_bank
     SET status = 'published', is_active = TRUE, updated_at = NOW()
     WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND status = 'archived'
     RETURNING id`,
    [questionIds]
  );
}

export async function bulkAssignTopic(input: {
  asset_type: "question" | "flashcard" | "content";
  asset_ids: string[];
  topic_id: string | null;
}) {
  if (input.asset_type === "question") {
    return query(
      `UPDATE question_bank SET topic_id = $2, updated_at = NOW()
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL
       RETURNING id, topic_id`,
      [input.asset_ids, input.topic_id]
    );
  }
  if (input.asset_type === "flashcard") {
    return query(
      `UPDATE flashcards SET topic_id = $2
       WHERE id = ANY($1::uuid[])
       RETURNING id, topic_id`,
      [input.asset_ids, input.topic_id]
    );
  }
  return query(
    `UPDATE content_library_items SET topic_id = $2, updated_at = NOW()
     WHERE id = ANY($1::uuid[])
     RETURNING id, topic_id`,
    [input.asset_ids, input.topic_id]
  );
}

export async function listRecentVersions(filters?: { status?: string; limit?: number }) {
  return query(
    `SELECT v.id, v.question_id, v.improvement_type, v.status, v.change_summary,
            v.created_at, v.applied_at,
            q.question_text, q.category::text AS category
     FROM question_bank_versions v
     JOIN question_bank q ON q.id = v.question_id
     WHERE ($1::text IS NULL OR v.status = $1)
     ORDER BY v.created_at DESC
     LIMIT $2`,
    [filters?.status || null, Math.min(filters?.limit || 50, 200)]
  );
}

export async function exportQuestions(filters?: {
  category?: string;
  status?: string;
  type?: string;
  search?: string;
  limit?: number;
}) {
  const rows = await query<{
    id: string;
    question_text: string;
    category: string;
    type: string;
    difficulty_level: string;
    status: string;
    bloom_level: string | null;
    tags: string[] | null;
    correct_answer: string | null;
    explanation: string | null;
  }>(
    `SELECT id, question_text, category::text AS category, type::text AS type,
            difficulty_level, status, bloom_level, tags, correct_answer, explanation
     FROM question_bank
     WHERE deleted_at IS NULL
       AND ($1::text IS NULL OR category::text = $1)
       AND ($2::text IS NULL OR status = $2)
       AND ($3::text IS NULL OR type::text = $3)
       AND ($4::text IS NULL OR question_text ILIKE '%' || $4 || '%')
     ORDER BY created_at DESC
     LIMIT $5`,
    [
      filters?.category || null,
      filters?.status || null,
      filters?.type || null,
      filters?.search || null,
      Math.min(filters?.limit || 2000, 5000),
    ]
  );

  const header = [
    "id",
    "question_text",
    "category",
    "type",
    "difficulty_level",
    "status",
    "bloom_level",
    "tags",
    "correct_answer",
    "explanation",
  ];

  const escape = (v: unknown) => {
    const s = v == null ? "" : Array.isArray(v) ? v.join("|") : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.id,
        row.question_text,
        row.category,
        row.type,
        row.difficulty_level,
        row.status,
        row.bloom_level,
        row.tags,
        row.correct_answer,
        row.explanation,
      ]
        .map(escape)
        .join(",")
    );
  }
  return { csv: lines.join("\n"), count: rows.length };
}

export async function getEnterpriseSummary() {
  const [archived, deleted, proposed, published] = await Promise.all([
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM question_bank WHERE deleted_at IS NULL AND status = 'archived'`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM question_bank WHERE deleted_at IS NOT NULL`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM question_bank_versions WHERE status = 'proposed'`
    ),
    queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM question_bank WHERE deleted_at IS NULL AND status = 'published'`
    ),
  ]);
  return {
    archived: archived?.count || 0,
    deleted: deleted?.count || 0,
    proposedVersions: proposed?.count || 0,
    published: published?.count || 0,
  };
}

export async function listArchivedContent(limit = 100) {
  return query(
    `SELECT id, content_type, title, category, status, updated_at
     FROM content_library_items
     WHERE status = 'archived'
     ORDER BY updated_at DESC
     LIMIT $1`,
    [Math.min(limit, 500)]
  );
}

export async function restoreContentItems(ids: string[]) {
  return query(
    `UPDATE content_library_items SET status = 'published', updated_at = NOW()
     WHERE id = ANY($1::uuid[]) AND status = 'archived'
     RETURNING id`,
    [ids]
  );
}
