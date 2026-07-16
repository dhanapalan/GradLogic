// =============================================================================
// Knowledge Library taxonomy — Category → Subject → Topic (Sprint 3)
// =============================================================================

import { query, queryOne } from "../config/database.js";

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 160);
}

export interface TaxonomyCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  subject_count: number;
  topic_count: number;
  question_count: number;
}

export interface TaxonomySubject {
  id: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  topic_count: number;
}

export interface TaxonomyTopic {
  id: string;
  subject_id: string;
  subject_name: string;
  category_id: string;
  category_name: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  question_count: number;
  flashcard_count: number;
  content_count: number;
}

export async function listTaxonomyTree() {
  const categories = await listCategories();
  const subjects = await listSubjects();
  const topics = await listTopics();
  return { categories, subjects, topics };
}

export async function listCategories(): Promise<TaxonomyCategory[]> {
  return query(
    `SELECT
       c.id, c.name, c.slug, c.description, COALESCE(c.is_active, TRUE) AS is_active,
       COUNT(DISTINCT s.id) FILTER (WHERE s.deleted_at IS NULL) AS subject_count,
       COUNT(DISTINCT t.id) FILTER (WHERE t.deleted_at IS NULL) AS topic_count,
       COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL) AS question_count
     FROM categories c
     LEFT JOIN knowledge_subjects s ON s.category_id = c.id
     LEFT JOIN knowledge_topics t ON t.subject_id = s.id
     LEFT JOIN question_bank q ON (q.topic_id = t.id OR q.category::text = c.slug) AND q.deleted_at IS NULL
     WHERE c.deleted_at IS NULL
     GROUP BY c.id
     ORDER BY c.name`
  ) as Promise<TaxonomyCategory[]>;
}

export async function listSubjects(categoryId?: string): Promise<TaxonomySubject[]> {
  return query(
    `SELECT
       s.id, s.category_id, c.name AS category_name, c.slug AS category_slug,
       s.name, s.slug, s.description, s.sort_order, s.is_active,
       COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL) AS topic_count
     FROM knowledge_subjects s
     JOIN categories c ON c.id = s.category_id
     LEFT JOIN knowledge_topics t ON t.subject_id = s.id
     WHERE s.deleted_at IS NULL
       AND c.deleted_at IS NULL
       AND ($1::uuid IS NULL OR s.category_id = $1)
     GROUP BY s.id, c.name, c.slug
     ORDER BY c.name, s.sort_order, s.name`,
    [categoryId || null]
  ) as Promise<TaxonomySubject[]>;
}

export async function createSubject(input: {
  category_id: string;
  name: string;
  description?: string;
  sort_order?: number;
}) {
  const slug = slugify(input.name);
  return queryOne(
    `INSERT INTO knowledge_subjects (category_id, name, slug, description, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.category_id, input.name.trim(), slug, input.description || null, input.sort_order ?? 0]
  );
}

export async function updateSubject(
  id: string,
  input: Partial<{ name: string; description: string; sort_order: number; is_active: boolean }>
) {
  return queryOne(
    `UPDATE knowledge_subjects SET
       name = COALESCE($2, name),
       slug = COALESCE($3, slug),
       description = COALESCE($4, description),
       sort_order = COALESCE($5, sort_order),
       is_active = COALESCE($6, is_active),
       updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [
      id,
      input.name?.trim() || null,
      input.name ? slugify(input.name) : null,
      input.description ?? null,
      input.sort_order ?? null,
      input.is_active ?? null,
    ]
  );
}

export async function softDeleteSubject(id: string) {
  return queryOne(
    `UPDATE knowledge_subjects SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id]
  );
}

export async function listTopics(filters?: {
  subject_id?: string;
  category_id?: string;
  search?: string;
}): Promise<TaxonomyTopic[]> {
  return query(
    `SELECT
       t.id, t.subject_id, s.name AS subject_name,
       c.id AS category_id, c.name AS category_name,
       t.name, t.slug, t.description, t.sort_order, t.is_active,
       COUNT(DISTINCT q.id) FILTER (WHERE q.deleted_at IS NULL) AS question_count,
       COUNT(DISTINCT f.id) FILTER (WHERE f.is_active) AS flashcard_count,
       COUNT(DISTINCT i.id) FILTER (WHERE i.status <> 'archived') AS content_count
     FROM knowledge_topics t
     JOIN knowledge_subjects s ON s.id = t.subject_id AND s.deleted_at IS NULL
     JOIN categories c ON c.id = s.category_id AND c.deleted_at IS NULL
     LEFT JOIN question_bank q ON q.topic_id = t.id
     LEFT JOIN flashcards f ON f.topic_id = t.id
     LEFT JOIN content_library_items i ON i.topic_id = t.id
     WHERE t.deleted_at IS NULL
       AND ($1::uuid IS NULL OR t.subject_id = $1)
       AND ($2::uuid IS NULL OR c.id = $2)
       AND ($3::text IS NULL OR t.name ILIKE '%' || $3 || '%' OR t.slug ILIKE '%' || $3 || '%')
     GROUP BY t.id, s.name, c.id, c.name
     ORDER BY c.name, s.name, t.sort_order, t.name`,
    [filters?.subject_id || null, filters?.category_id || null, filters?.search || null]
  ) as Promise<TaxonomyTopic[]>;
}

export async function createTopic(input: {
  subject_id: string;
  name: string;
  description?: string;
  sort_order?: number;
}) {
  const slug = slugify(input.name);
  return queryOne(
    `INSERT INTO knowledge_topics (subject_id, name, slug, description, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [input.subject_id, input.name.trim(), slug, input.description || null, input.sort_order ?? 0]
  );
}

export async function updateTopic(
  id: string,
  input: Partial<{ name: string; description: string; sort_order: number; is_active: boolean; subject_id: string }>
) {
  return queryOne(
    `UPDATE knowledge_topics SET
       subject_id = COALESCE($2, subject_id),
       name = COALESCE($3, name),
       slug = COALESCE($4, slug),
       description = COALESCE($5, description),
       sort_order = COALESCE($6, sort_order),
       is_active = COALESCE($7, is_active),
       updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [
      id,
      input.subject_id || null,
      input.name?.trim() || null,
      input.name ? slugify(input.name) : null,
      input.description ?? null,
      input.sort_order ?? null,
      input.is_active ?? null,
    ]
  );
}

export async function softDeleteTopic(id: string) {
  return queryOne(
    `UPDATE knowledge_topics SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
    [id]
  );
}

export async function getTopicDetail(id: string) {
  const topic = await queryOne(
    `SELECT
       t.*, s.name AS subject_name, s.id AS subject_id,
       c.id AS category_id, c.name AS category_name, c.slug AS category_slug
     FROM knowledge_topics t
     JOIN knowledge_subjects s ON s.id = t.subject_id
     JOIN categories c ON c.id = s.category_id
     WHERE t.id = $1 AND t.deleted_at IS NULL`,
    [id]
  );
  if (!topic) return null;

  const [questions, flashcards, content] = await Promise.all([
    query(
      `SELECT id, question_text, category, type, difficulty_level, status, tags, bloom_level, created_at
       FROM question_bank
       WHERE topic_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 100`,
      [id]
    ),
    query(
      `SELECT id, front, back, category, difficulty, tags, created_at
       FROM flashcards
       WHERE topic_id = $1 AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT 100`,
      [id]
    ),
    query(
      `SELECT id, content_type, title, body, category, difficulty, status, created_at
       FROM content_library_items
       WHERE topic_id = $1 AND status <> 'archived'
       ORDER BY updated_at DESC
       LIMIT 100`,
      [id]
    ),
  ]);

  return { topic, questions, flashcards, content };
}

export async function assignAssetTopic(input: {
  asset_type: "question" | "flashcard" | "content";
  asset_id: string;
  topic_id: string | null;
}) {
  if (input.asset_type === "question") {
    return queryOne(
      `UPDATE question_bank SET topic_id = $2 WHERE id = $1 AND deleted_at IS NULL RETURNING id, topic_id`,
      [input.asset_id, input.topic_id]
    );
  }
  if (input.asset_type === "flashcard") {
    return queryOne(
      `UPDATE flashcards SET topic_id = $2 WHERE id = $1 RETURNING id, topic_id`,
      [input.asset_id, input.topic_id]
    );
  }
  return queryOne(
    `UPDATE content_library_items SET topic_id = $2, updated_at = now() WHERE id = $1 RETURNING id, topic_id`,
    [input.asset_id, input.topic_id]
  );
}

/** Promote popular free-text tags into topics under a subject (optional bootstrap). */
export async function promoteTagsToTopics(subjectId: string, tags: string[]) {
  const created = [];
  for (const tag of tags) {
    const name = tag.trim();
    if (!name) continue;
    const row = await queryOne(
      `INSERT INTO knowledge_topics (subject_id, name, slug, description)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (subject_id, slug) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [subjectId, name, slugify(name), `Promoted from tag: ${name}`]
    );
    if (row) created.push(row);
  }
  return created;
}
