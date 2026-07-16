/**
 * Knowledge Library AI (Sprint 4) — admin wrappers over existing AI search,
 * embeddings, and taxonomy-aware related suggestions.
 */

import { query, queryOne } from "../config/database.js";
import { embed } from "./ai.service.js";
import { aiSearch } from "./aiSearch.service.js";
import { logger } from "../config/logger.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

const DUPLICATE_THRESHOLD = 0.92;
const RELATED_POOL = 400;

export async function adminAiSearch(q: string, limit = 10) {
  return aiSearch(q, limit);
}

export async function getRelatedQuestions(questionId: string, limit = 10) {
  const source = await queryOne<{
    id: string;
    question_text: string;
    category: string;
    topic_id: string | null;
    tags: string[] | null;
    search_embedding: number[] | null;
  }>(
    `SELECT id, question_text, category::text AS category, topic_id, tags, search_embedding
     FROM question_bank
     WHERE id = $1 AND deleted_at IS NULL`,
    [questionId]
  );
  if (!source) return null;

  const related: Array<{
    id: string;
    question_text: string;
    category: string;
    type: string;
    difficulty_level: string;
    similarity: number | null;
    reason: string;
  }> = [];

  if (source.topic_id) {
    const topicSiblings = await query<{
      id: string;
      question_text: string;
      category: string;
      type: string;
      difficulty_level: string;
    }>(
      `SELECT id, question_text, category::text AS category, type::text AS type, difficulty_level
       FROM question_bank
       WHERE topic_id = $1 AND id <> $2 AND deleted_at IS NULL AND is_active = TRUE
       ORDER BY created_at DESC
       LIMIT $3`,
      [source.topic_id, questionId, limit]
    );
    for (const row of topicSiblings) {
      related.push({ ...row, similarity: null, reason: "Same topic" });
    }
  }

  let embedding = source.search_embedding;
  if (!embedding || embedding.length === 0) {
    try {
      const { vector, model } = await embed(source.question_text);
      if (vector.length > 0) {
        embedding = vector;
        await queryOne(
          `UPDATE question_bank SET search_embedding = $1, search_embedding_model = $2 WHERE id = $3`,
          [vector, model, questionId]
        );
      }
    } catch (err) {
      logger.warn("[KL AI] related embed failed", { id: questionId, error: (err as Error).message });
    }
  }

  if (embedding && embedding.length > 0) {
    const pool = await query<{
      id: string;
      question_text: string;
      category: string;
      type: string;
      difficulty_level: string;
      search_embedding: number[];
    }>(
      `SELECT id, question_text, category::text AS category, type::text AS type,
              difficulty_level, search_embedding
       FROM question_bank
       WHERE search_embedding IS NOT NULL AND is_active = TRUE AND deleted_at IS NULL AND id <> $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [questionId, RELATED_POOL]
    );

    const ranked = pool
      .map((row) => ({
        row,
        similarity: cosineSimilarity(embedding!, row.search_embedding),
      }))
      .filter((x) => x.similarity >= 0.55)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    for (const { row, similarity } of ranked) {
      if (related.some((r) => r.id === row.id)) continue;
      related.push({
        id: row.id,
        question_text: row.question_text,
        category: row.category,
        type: row.type,
        difficulty_level: row.difficulty_level,
        similarity,
        reason: "Semantic similarity",
      });
    }
  }

  // Tag overlap fallback when nothing else matched
  if (related.length === 0 && source.tags?.length) {
    const tags = source.tags.filter((t) => !t.startsWith("ai-") && !t.startsWith("pdf-"));
    if (tags.length) {
      const tagHits = await query<{
        id: string;
        question_text: string;
        category: string;
        type: string;
        difficulty_level: string;
      }>(
        `SELECT id, question_text, category::text AS category, type::text AS type, difficulty_level
         FROM question_bank
         WHERE id <> $1 AND deleted_at IS NULL AND is_active = TRUE AND tags && $2::text[]
         ORDER BY created_at DESC
         LIMIT $3`,
        [questionId, tags, limit]
      );
      for (const row of tagHits) {
        related.push({ ...row, similarity: null, reason: "Shared tags" });
      }
    }
  }

  return {
    source: {
      id: source.id,
      question_text: source.question_text,
      category: source.category,
      topic_id: source.topic_id,
    },
    related: related.slice(0, limit),
  };
}

export async function findDuplicatesForQuestion(questionId: string, limit = 10) {
  const source = await queryOne<{ id: string; question_text: string; search_embedding: number[] | null }>(
    `SELECT id, question_text, search_embedding FROM question_bank WHERE id = $1 AND deleted_at IS NULL`,
    [questionId]
  );
  if (!source) return null;

  let embedding = source.search_embedding;
  if (!embedding || embedding.length === 0) {
    const { vector, model } = await embed(source.question_text);
    if (vector.length === 0) {
      return { source, matches: [], embeddingsUsed: false, message: "Embedding engine unavailable" };
    }
    embedding = vector;
    await queryOne(
      `UPDATE question_bank SET search_embedding = $1, search_embedding_model = $2 WHERE id = $3`,
      [vector, model, questionId]
    );
  }

  const pool = await query<{ id: string; question_text: string; search_embedding: number[] }>(
    `SELECT id, question_text, search_embedding FROM question_bank
     WHERE search_embedding IS NOT NULL AND is_active = TRUE AND deleted_at IS NULL AND id <> $1
     ORDER BY created_at DESC
     LIMIT 500`,
    [questionId]
  );

  const matches = pool
    .map((row) => ({
      id: row.id,
      question_text: row.question_text,
      similarity: cosineSimilarity(embedding!, row.search_embedding),
    }))
    .filter((m) => m.similarity >= DUPLICATE_THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return { source: { id: source.id, question_text: source.question_text }, matches, embeddingsUsed: true };
}

export async function backfillEmbeddings(limit = 50, questionIds?: string[]) {
  const rows = questionIds?.length
    ? await query<{ id: string; question_text: string }>(
        `SELECT id, question_text FROM question_bank
         WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [questionIds]
      )
    : await query<{ id: string; question_text: string }>(
        `SELECT id, question_text FROM question_bank
         WHERE search_embedding IS NULL AND deleted_at IS NULL AND is_active = TRUE
         ORDER BY created_at DESC
         LIMIT $1`,
        [Math.min(limit, 100)]
      );

  let embedded = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const { vector, model } = await embed(row.question_text);
      if (vector.length === 0) {
        failed += 1;
        continue;
      }
      await queryOne(
        `UPDATE question_bank SET search_embedding = $1, search_embedding_model = $2 WHERE id = $3`,
        [vector, model, row.id]
      );
      embedded += 1;
    } catch {
      failed += 1;
    }
  }

  const coverage = await queryOne<{ total: number; with_embedding: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE search_embedding IS NOT NULL)::int AS with_embedding
     FROM question_bank WHERE deleted_at IS NULL AND is_active = TRUE`
  );

  return {
    processed: rows.length,
    embedded,
    failed,
    coverage,
  };
}

export async function getEmbeddingCoverage() {
  return queryOne<{ total: number; with_embedding: number }>(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE search_embedding IS NOT NULL)::int AS with_embedding
     FROM question_bank WHERE deleted_at IS NULL AND is_active = TRUE`
  );
}
