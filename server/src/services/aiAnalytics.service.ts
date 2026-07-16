/**
 * AI Analytics Dashboard (Phase 11) — superadmin-facing, platform-wide view
 * of content health and AI feature usage. Every metric below is computed
 * from real tables; nothing is a placeholder number.
 */

import { query, queryOne } from "../config/database.js";
import { logger } from "../config/logger.js";

// ── Knowledge Coverage ────────────────────────────────────────────────────────

export interface CategoryCoverage {
  category: string;
  totalQuestions: number;
  easy: number;
  medium: number;
  hard: number;
}

async function getKnowledgeCoverage(): Promise<CategoryCoverage[]> {
  const rows = await query<{ category: string; total: number; easy: number; medium: number; hard: number }>(
    `SELECT category::text AS category,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE difficulty_level = 'easy')::int AS easy,
            COUNT(*) FILTER (WHERE difficulty_level = 'medium')::int AS medium,
            COUNT(*) FILTER (WHERE difficulty_level = 'hard')::int AS hard
     FROM question_bank
     WHERE is_active = TRUE AND status = 'published'
     GROUP BY category`,
  );
  return rows.map((r) => ({ category: r.category, totalQuestions: r.total, easy: r.easy, medium: r.medium, hard: r.hard }));
  // Per-category lesson-content coverage is a separate, correctly-scoped
  // query — see getSkillCoverage() below.
}

// ── Weak Subjects (platform-wide, not per-student) ────────────────────────────

export interface WeakSubject {
  category: string;
  attempts: number;
  accuracy: number;
}

async function getWeakSubjects(): Promise<WeakSubject[]> {
  const rows = await query<{ category: string; attempts: number; correct: number }>(
    `SELECT qb.category::text AS category, COUNT(*)::int AS attempts, COUNT(*) FILTER (WHERE pa.is_correct)::int AS correct
     FROM practice_attempts pa
     JOIN question_bank qb ON qb.id = pa.question_id
     WHERE pa.is_correct IS NOT NULL
     GROUP BY qb.category
     HAVING COUNT(*) >= 5`,
  );
  return rows
    .map((r) => ({ category: r.category, attempts: r.attempts, accuracy: r.correct / r.attempts }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

// ── Duplicate Questions (reuses Phase 10 embeddings) ──────────────────────────

export interface DuplicatePair {
  a: { id: string; question_text: string };
  b: { id: string; question_text: string };
  similarity: number;
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

const DUPLICATE_THRESHOLD = 0.95;
/** Bounded — O(n^2) comparisons; only meaningful among questions already embedded (Phase 10 backfills lazily). */
const MAX_QUESTIONS_FOR_DUPLICATE_SCAN = 300;

async function getDuplicateQuestions(): Promise<{ pairs: DuplicatePair[]; scannedCount: number; totalEmbedded: number }> {
  const totalRow = await queryOne<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM question_bank WHERE search_embedding IS NOT NULL`,
  );
  const totalEmbedded = totalRow?.count ?? 0;

  const rows = await query<{ id: string; question_text: string; search_embedding: number[] }>(
    `SELECT id, question_text, search_embedding FROM question_bank
     WHERE search_embedding IS NOT NULL AND is_active = TRUE
     ORDER BY created_at DESC
     LIMIT $1`,
    [MAX_QUESTIONS_FOR_DUPLICATE_SCAN],
  );

  const pairs: DuplicatePair[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const similarity = cosineSimilarity(rows[i].search_embedding, rows[j].search_embedding);
      if (similarity >= DUPLICATE_THRESHOLD) {
        pairs.push({
          a: { id: rows[i].id, question_text: rows[i].question_text },
          b: { id: rows[j].id, question_text: rows[j].question_text },
          similarity,
        });
      }
    }
  }
  return { pairs: pairs.sort((a, b) => b.similarity - a.similarity).slice(0, 20), scannedCount: rows.length, totalEmbedded };
}

// ── Question Quality (heuristic flags, not a certified score) ─────────────────

export interface QualityFlag {
  id: string;
  question_text: string;
  category: string;
  reasons: string[];
}

async function getQuestionQualityFlags(): Promise<QualityFlag[]> {
  const missingContent = await query<{ id: string; question_text: string; category: string; explanation: string | null; hint: string | null }>(
    `SELECT id, question_text, category::text AS category, explanation, hint
     FROM question_bank
     WHERE is_active = TRUE AND status = 'published' AND (explanation IS NULL OR hint IS NULL)
     LIMIT 100`,
  );
  const lowPassRate = await query<{ id: string; question_text: string; category: string; attempts: number; correct: number }>(
    `SELECT qb.id, qb.question_text, qb.category::text AS category, COUNT(*)::int AS attempts, COUNT(*) FILTER (WHERE pa.is_correct)::int AS correct
     FROM practice_attempts pa JOIN question_bank qb ON qb.id = pa.question_id
     WHERE pa.is_correct IS NOT NULL
     GROUP BY qb.id, qb.question_text, qb.category
     HAVING COUNT(*) >= 5 AND COUNT(*) FILTER (WHERE pa.is_correct)::float / COUNT(*) < 0.1`,
  );

  const flags = new Map<string, QualityFlag>();
  for (const q of missingContent) {
    const reasons: string[] = [];
    if (!q.explanation) reasons.push("Missing explanation");
    if (!q.hint) reasons.push("Missing hint");
    flags.set(q.id, { id: q.id, question_text: q.question_text, category: q.category, reasons });
  }
  for (const q of lowPassRate) {
    const existing = flags.get(q.id);
    const reason = `Very low pass rate (${Math.round((q.correct / q.attempts) * 100)}% of ${q.attempts} attempts) — may be ambiguous or mis-keyed`;
    if (existing) existing.reasons.push(reason);
    else flags.set(q.id, { id: q.id, question_text: q.question_text, category: q.category, reasons: [reason] });
  }
  return [...flags.values()].slice(0, 30);
}

// ── Student Success ────────────────────────────────────────────────────────────

export interface StudentSuccessSummary {
  examsTaken: number;
  averageExamScore: number | null;
  studentsWithScores: number;
}

async function getStudentSuccess(): Promise<StudentSuccessSummary> {
  const row = await queryOne<{ exams_taken: number; avg_score: number | null; students: number }>(
    `SELECT COUNT(*)::int AS exams_taken, AVG(final_score)::float AS avg_score, COUNT(DISTINCT student_id)::int AS students
     FROM marks_scored`,
  );
  return {
    examsTaken: row?.exams_taken ?? 0,
    averageExamScore: row?.avg_score ?? null,
    studentsWithScores: row?.students ?? 0,
  };
}

// ── Learning Time ──────────────────────────────────────────────────────────────

export interface LearningTimeSummary {
  totalPracticeMinutes: number;
  totalSessions: number;
  averageSessionMinutes: number;
}

async function getLearningTime(): Promise<LearningTimeSummary> {
  const row = await queryOne<{ total_seconds: number; sessions: number }>(
    `SELECT COALESCE(SUM(time_spent_seconds), 0)::int AS total_seconds, COUNT(*)::int AS sessions FROM practice_sessions`,
  );
  const totalSeconds = row?.total_seconds ?? 0;
  const sessions = row?.sessions ?? 0;
  return {
    totalPracticeMinutes: Math.round(totalSeconds / 60),
    totalSessions: sessions,
    averageSessionMinutes: sessions > 0 ? Math.round(totalSeconds / sessions / 60) : 0,
  };
}

// ── Skill Coverage (which categories have real lesson content vs question-only) ──

export interface SkillCoverageEntry {
  category: string;
  questionCount: number;
  lessonCount: number;
}

async function getSkillCoverage(): Promise<SkillCoverageEntry[]> {
  const categories = await query<{ category: string; question_count: number }>(
    `SELECT category::text AS category, COUNT(*)::int AS question_count
     FROM question_bank WHERE is_active = TRUE AND status = 'published' GROUP BY category`,
  );
  const entries: SkillCoverageEntry[] = [];
  for (const c of categories) {
    const label = c.category.replace(/_/g, " ");
    const lessonRow = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM learning_modules lm JOIN skills s ON s.id = lm.skill_id
       WHERE lm.is_published = TRUE AND s.name ILIKE $1`,
      [`%${label}%`],
    );
    entries.push({ category: c.category, questionCount: c.question_count, lessonCount: lessonRow?.count ?? 0 });
  }
  return entries;
}

// ── Voice Usage / AI Usage (from ai_usage_events, Phase 11's own instrumentation) ──

export interface UsageBreakdown {
  feature: string;
  count: number;
}

async function getAiUsage(days = 30): Promise<{ total: number; byFeature: UsageBreakdown[]; voiceEvents: number }> {
  const rows = await query<{ feature: string; count: number }>(
    `SELECT feature, COUNT(*)::int AS count FROM ai_usage_events
     WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY feature ORDER BY count DESC`,
    [days],
  );
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const voiceEvents = rows.filter((r) => r.feature.includes("voice")).reduce((sum, r) => sum + r.count, 0);
  return { total, byFeature: rows, voiceEvents };
}

// ── Recommendations (rule-based over the metrics above — no extra LLM cost) ────

export interface Recommendation {
  severity: "high" | "medium" | "low";
  message: string;
}

function buildRecommendations(params: {
  weakSubjects: WeakSubject[];
  duplicates: { pairs: DuplicatePair[] };
  qualityFlags: QualityFlag[];
  skillCoverage: SkillCoverageEntry[];
}): Recommendation[] {
  const recs: Recommendation[] = [];

  const worstSubject = params.weakSubjects[0];
  if (worstSubject && worstSubject.accuracy < 0.5) {
    recs.push({
      severity: "high",
      message: `Students are averaging ${Math.round(worstSubject.accuracy * 100)}% accuracy on "${worstSubject.category.replace(/_/g, " ")}" — consider adding more worked examples or lessons here.`,
    });
  }

  if (params.duplicates.pairs.length > 0) {
    recs.push({
      severity: "medium",
      message: `${params.duplicates.pairs.length} likely-duplicate question pair(s) detected (≥95% semantic similarity) — review and merge/retire in Knowledge Library.`,
    });
  }

  const noContentCategories = params.skillCoverage.filter((c) => c.lessonCount === 0 && c.questionCount > 0);
  if (noContentCategories.length > 0) {
    recs.push({
      severity: "medium",
      message: `${noContentCategories.length} categor${noContentCategories.length === 1 ? "y has" : "ies have"} questions but no published lesson content: ${noContentCategories.map((c) => c.category.replace(/_/g, " ")).join(", ")}.`,
    });
  }

  if (params.qualityFlags.length > 5) {
    recs.push({
      severity: "low",
      message: `${params.qualityFlags.length} question(s) flagged for missing explanation/hint or an unusually low pass rate — review in Question Quality.`,
    });
  }

  if (recs.length === 0) {
    recs.push({ severity: "low", message: "No significant issues detected right now — content and performance signals look healthy." });
  }
  return recs;
}

// ── Combined dashboard ─────────────────────────────────────────────────────────

export interface AiAnalyticsDashboard {
  knowledgeCoverage: CategoryCoverage[];
  weakSubjects: WeakSubject[];
  duplicateQuestions: { pairs: DuplicatePair[]; scannedCount: number; totalEmbedded: number };
  questionQuality: QualityFlag[];
  studentSuccess: StudentSuccessSummary;
  learningTime: LearningTimeSummary;
  skillCoverage: SkillCoverageEntry[];
  aiUsage: { total: number; byFeature: UsageBreakdown[]; voiceEvents: number };
  recommendations: Recommendation[];
}

export async function getAiAnalyticsDashboard(): Promise<AiAnalyticsDashboard> {
  const [knowledgeCoverage, weakSubjects, duplicateQuestions, questionQuality, studentSuccess, learningTime, skillCoverage, aiUsage] =
    await Promise.all([
      getKnowledgeCoverage().catch((err) => { logger.warn("[AI Analytics] knowledge coverage failed", { error: err.message }); return []; }),
      getWeakSubjects(),
      getDuplicateQuestions(),
      getQuestionQualityFlags(),
      getStudentSuccess(),
      getLearningTime(),
      getSkillCoverage(),
      getAiUsage(),
    ]);

  return {
    knowledgeCoverage,
    weakSubjects,
    duplicateQuestions,
    questionQuality,
    studentSuccess,
    learningTime,
    skillCoverage,
    aiUsage,
    recommendations: buildRecommendations({ weakSubjects, duplicates: duplicateQuestions, qualityFlags: questionQuality, skillCoverage }),
  };
}
