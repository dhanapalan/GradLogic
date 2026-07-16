/**
 * AI Semantic Search (Phase 10) — "instead of SQL filters."
 *
 * Hybrid search, honestly degrading when embeddings aren't available:
 *   1. A lexical candidate set is pulled first (Postgres full-text search,
 *      the same to_tsvector/plainto_tsquery mechanism questionBank.service.ts
 *      already uses) — this guarantees results even if the AI engine is down.
 *   2. If the AI engine IS reachable, the query and any candidates missing a
 *      stored embedding are embedded (embed() in ai.service.ts, now pointed
 *      at the question-bank engine's real /embed route), and candidates are
 *      re-ranked by cosine similarity — this is the actual "search using
 *      embeddings" requirement.
 *   3. If embedding fails, results stay in lexical relevance order — never a
 *      crash, never a fabricated ranking.
 *
 * No pgvector extension exists in this database (verified), so embeddings
 * are plain float arrays and cosine similarity is computed here in JS —
 * workable at this question bank's realistic scale (hundreds/low-thousands
 * of rows), not a substitute for an indexed ANN search at much larger scale.
 *
 * "Voice Lessons" have no separate stored content type anywhere in this
 * schema (Phase 4 established Voice Lesson is synthesized on demand from a
 * question's own text via the browser's speechSynthesis / the Voice Tutor's
 * "Listen" action) — so search results mark `voiceLessonAvailable: true` on
 * every matched question rather than inventing a fake separate content type.
 */

import { query, queryOne } from "../config/database.js";
import { embed } from "./ai.service.js";
import { logger } from "../config/logger.js";
import type { QuestionBankRow } from "../types/index.js";

const SYSTEM_TAGS = new Set(["ai-generated", "manual", "book-import", "pdf-import", "content-studio", "regenerated"]);
function isSystemTag(tag: string): boolean {
  return SYSTEM_TAGS.has(tag) || tag.startsWith("pdf-") || tag.startsWith("book-");
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Bounded — computing embeddings is an HTTP round trip per row, not free. */
const MAX_EMBED_BACKFILL_PER_SEARCH = 25;

async function backfillEmbeddings(rows: QuestionBankRow[]): Promise<void> {
  const missing = rows.filter((r) => !r.search_embedding).slice(0, MAX_EMBED_BACKFILL_PER_SEARCH);
  if (!missing.length) return;
  await Promise.all(
    missing.map(async (row) => {
      try {
        const { vector, model } = await embed(row.question_text);
        if (vector.length === 0) return; // AI engine unavailable — leave for next search to retry
        row.search_embedding = vector; // update in-memory copy so this search's ranking benefits immediately
        await queryOne(
          `UPDATE question_bank SET search_embedding = $1, search_embedding_model = $2 WHERE id = $3`,
          [vector, model, row.id],
        );
      } catch (err) {
        logger.warn("[AI Search] embedding backfill failed", { id: row.id, error: (err as Error).message });
      }
    }),
  );
}

export interface QuestionSearchResult {
  id: string;
  question_text: string;
  category: string;
  difficulty_level: string;
  type: string;
  tags: string[];
  hint: string | null;
  similarity: number | null; // null when ranked lexically (embeddings unavailable)
  voiceLessonAvailable: true;
}

/**
 * Builds the candidate pool for a query. Lexical (tsvector) matches come
 * first, but a query like "Amazon Questions" or "Machine Learning" may have
 * ZERO literal keyword hits in question_text while still being answerable
 * semantically — so this always tops up with a broader recent-questions pool
 * too, rather than returning nothing when the lexical pass is sparse. This
 * is what makes embedding-based ranking actually reachable for exactly the
 * kind of query Phase 10 exists for.
 */
async function getCandidatePool(searchQuery: string, candidateLimit: number): Promise<QuestionBankRow[]> {
  const [lexical, broad] = await Promise.all([
    query<QuestionBankRow>(
      `SELECT * FROM question_bank
       WHERE is_active = TRUE AND status = 'published'
         AND to_tsvector('english', question_text) @@ plainto_tsquery('english', $1)
       ORDER BY ts_rank(to_tsvector('english', question_text), plainto_tsquery('english', $1)) DESC
       LIMIT $2`,
      [searchQuery, candidateLimit],
    ),
    query<QuestionBankRow>(
      `SELECT * FROM question_bank
       WHERE is_active = TRUE AND status = 'published'
       ORDER BY RANDOM()
       LIMIT $1`,
      [candidateLimit],
    ),
  ]);
  const seen = new Set<string>();
  const merged: QuestionBankRow[] = [];
  for (const row of [...lexical, ...broad]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

async function searchQuestions(searchQuery: string, limit: number): Promise<QuestionSearchResult[]> {
  const candidateLimit = Math.max(limit * 3, 20);
  const candidates = await getCandidatePool(searchQuery, candidateLimit);

  if (candidates.length === 0) return [];

  const { vector: queryVector } = await embed(searchQuery);
  if (queryVector.length > 0) {
    await backfillEmbeddings(candidates);
    const ranked = candidates
      .map((q) => ({
        q,
        similarity: q.search_embedding ? cosineSimilarity(queryVector, q.search_embedding) : null,
      }))
      .sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1))
      .slice(0, limit);
    return ranked.map(({ q, similarity }) => toResult(q, similarity));
  }

  // AI engine unreachable — stay in lexical relevance order.
  return candidates.slice(0, limit).map((q) => toResult(q, null));
}

function toResult(q: QuestionBankRow, similarity: number | null): QuestionSearchResult {
  return {
    id: q.id,
    question_text: q.question_text,
    category: q.category,
    difficulty_level: q.difficulty_level,
    type: q.type,
    tags: (q.tags || []).filter((t) => !isSystemTag(t)),
    hint: q.hint,
    similarity,
    voiceLessonAvailable: true,
  };
}

// ── Learning Notes / Videos (real content when it exists, honestly empty when it doesn't) ──

export interface LearningModuleResult {
  id: string;
  title: string;
  description: string | null;
  moduleType: string;
  durationMinutes: number | null;
}

async function searchModulesByType(searchQuery: string, moduleType: string, limit: number): Promise<LearningModuleResult[]> {
  const rows = await query<{ id: string; title: string; description: string | null; module_type: string; duration_minutes: number | null }>(
    `SELECT id, title, description, module_type, duration_minutes
     FROM learning_modules
     WHERE is_published = TRUE AND module_type = $1
       AND (title ILIKE $2 OR description ILIKE $2 OR content_body ILIKE $2)
     ORDER BY title
     LIMIT $3`,
    [moduleType, `%${searchQuery}%`, limit],
  );
  return rows.map((r) => ({ id: r.id, title: r.title, description: r.description, moduleType: r.module_type, durationMinutes: r.duration_minutes }));
}

// ── Related Topics ────────────────────────────────────────────────────────────

export interface RelatedTopic {
  label: string;
  kind: "category" | "tag";
  count: number;
}

function getRelatedTopics(questions: QuestionSearchResult[]): RelatedTopic[] {
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const q of questions) {
    categoryCounts.set(q.category, (categoryCounts.get(q.category) || 0) + 1);
    for (const tag of q.tags) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
  }
  const topics: RelatedTopic[] = [
    ...[...categoryCounts.entries()].map(([label, count]) => ({ label: label.replace(/_/g, " "), kind: "category" as const, count })),
    ...[...tagCounts.entries()].map(([label, count]) => ({ label, kind: "tag" as const, count })),
  ];
  return topics.sort((a, b) => b.count - a.count).slice(0, 8);
}

// ── Combined search ────────────────────────────────────────────────────────────

export interface AiSearchResult {
  questions: QuestionSearchResult[];
  learningNotes: LearningModuleResult[];
  videos: LearningModuleResult[];
  relatedTopics: RelatedTopic[];
  embeddingsUsed: boolean;
}

export async function aiSearch(searchQuery: string, limit = 10): Promise<AiSearchResult> {
  const [questions, learningNotes, videos] = await Promise.all([
    searchQuestions(searchQuery, limit),
    searchModulesByType(searchQuery, "reading", 5),
    searchModulesByType(searchQuery, "video", 5),
  ]);

  return {
    questions,
    learningNotes,
    videos,
    relatedTopics: getRelatedTopics(questions),
    embeddingsUsed: questions.some((q) => q.similarity !== null),
  };
}
