// =============================================================================
// TalentSecure AI — Adaptive Complexity Service
// =============================================================================
// Implements an Item Response Theory-lite adaptive engine:
//   • Student answers → correct/wrong signal
//   • Difficulty steps UP on correct, DOWN on wrong
//   • Fetches a random question from question_bank at the new difficulty
//   • Avoids re-serving already-seen questions via an exclusion list
// =============================================================================

import { query, queryOne } from "../config/database.js";
import {
  QuestionBankRow,
  QuestionCategory,
  DifficultyLevel,
} from "../types/index.js";
import { logger } from "../config/logger.js";

// ── Difficulty ladder ────────────────────────────────────────────────────────

const DIFFICULTY_LADDER: DifficultyLevel[] = ["easy", "medium", "hard"];

function stepDifficulty(
  current: DifficultyLevel,
  correct: boolean,
): DifficultyLevel {
  const idx = DIFFICULTY_LADDER.indexOf(current);
  if (correct) {
    // Move up (harder), cap at "hard"
    return DIFFICULTY_LADDER[Math.min(idx + 1, DIFFICULTY_LADDER.length - 1)];
  }
  // Move down (easier), floor at "easy"
  return DIFFICULTY_LADDER[Math.max(idx - 1, 0)];
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface AdaptiveRequest {
  /** The category to pull the next question from */
  category: string;
  /** Difficulty of the question the student just answered */
  current_difficulty: DifficultyLevel;
  /** Whether the student answered correctly */
  answered_correctly: boolean;
  /** IDs of questions already seen (to avoid repeats) */
  seen_question_ids?: string[];
}

export interface AdaptiveResponse {
  /** The newly selected question */
  question: QuestionBankRow | null;
  /** The difficulty that was targeted */
  target_difficulty: DifficultyLevel;
  /** The previous difficulty (for UI) */
  previous_difficulty: DifficultyLevel;
  /** Whether difficulty went up, down, or stayed */
  direction: "up" | "down" | "same";
  /** How many questions remain at the target difficulty (excluding seen) */
  pool_remaining: number;
  /** Whether we had to fall back to a different difficulty */
  fallback: boolean;
}

// ── Category alias mapping (same as curateBlueprint) ─────────────────────────

const CATEGORY_ALIAS: Record<string, QuestionCategory> = {
  reasoning: "reasoning",
  maths: "maths",
  math: "maths",
  aptitude: "aptitude",
  "data structures": "data_structures",
  data_structures: "data_structures",
  ds: "data_structures",
  programming: "programming",
};

function normalizeCategory(label: string): QuestionCategory {
  const key = label.trim().toLowerCase();
  const mapped = CATEGORY_ALIAS[key];
  if (!mapped) {
    throw new Error(
      `Unknown category: "${label}". Valid: ${Object.keys(CATEGORY_ALIAS).join(", ")}`,
    );
  }
  return mapped;
}

// ── Core adaptive function ───────────────────────────────────────────────────

export async function getNextAdaptiveQuestion(
  req: AdaptiveRequest,
): Promise<AdaptiveResponse> {
  const category = normalizeCategory(req.category);
  const prevDifficulty = req.current_difficulty;
  const targetDifficulty = stepDifficulty(prevDifficulty, req.answered_correctly);
  const seen = req.seen_question_ids ?? [];

  const direction =
    targetDifficulty === prevDifficulty
      ? "same"
      : DIFFICULTY_LADDER.indexOf(targetDifficulty) >
        DIFFICULTY_LADDER.indexOf(prevDifficulty)
      ? "up"
      : "down";

  logger.info("Adaptive engine: computing next question", {
    category,
    prevDifficulty,
    targetDifficulty,
    direction,
    seenCount: seen.length,
  });

  // Build exclusion clause
  const excludeClause =
    seen.length > 0
      ? `AND id NOT IN (${seen.map((_, i) => `$${i + 3}`).join(", ")})`
      : "";
  const baseParams: unknown[] = [category, targetDifficulty, ...seen];

  // Try to find a question at the target difficulty
  let question = await queryOne<QuestionBankRow>(
    `SELECT * FROM question_bank
     WHERE category = $1
       AND difficulty_level = $2
       AND is_active = TRUE
       AND status = 'published'
       ${excludeClause}
     ORDER BY RANDOM()
     LIMIT 1`,
    baseParams,
  );

  let fallback = false;

  // If no question at target difficulty, try adjacent difficulties
  if (!question) {
    logger.warn("Adaptive engine: no questions at target difficulty, falling back", {
      category,
      targetDifficulty,
    });
    fallback = true;

    // Try all difficulties in order of closeness
    const fallbackOrder = DIFFICULTY_LADDER
      .map((d) => ({ d, dist: Math.abs(DIFFICULTY_LADDER.indexOf(d) - DIFFICULTY_LADDER.indexOf(targetDifficulty)) }))
      .sort((a, b) => a.dist - b.dist)
      .filter((x) => x.d !== targetDifficulty)
      .map((x) => x.d);

    for (const fbDifficulty of fallbackOrder) {
      const fbParams: unknown[] = [category, fbDifficulty, ...seen];
      const fbExclude =
        seen.length > 0
          ? `AND id NOT IN (${seen.map((_, i) => `$${i + 3}`).join(", ")})`
          : "";

      question = await queryOne<QuestionBankRow>(
        `SELECT * FROM question_bank
         WHERE category = $1
           AND difficulty_level = $2
           AND is_active = TRUE
           AND status = 'published'
           ${fbExclude}
         ORDER BY RANDOM()
         LIMIT 1`,
        fbParams,
      );

      if (question) break;
    }
  }

  // Count remaining pool at target difficulty
  const countParams: unknown[] = [category, targetDifficulty, ...seen];
  const countExclude =
    seen.length > 0
      ? `AND id NOT IN (${seen.map((_, i) => `$${i + 3}`).join(", ")})`
      : "";
  const countRow = await queryOne<{ remaining: number }>(
    `SELECT COUNT(*)::int AS remaining FROM question_bank
     WHERE category = $1
       AND difficulty_level = $2
       AND is_active = TRUE
       AND status = 'published'
       ${countExclude}`,
    countParams,
  );

  return {
    question,
    target_difficulty: targetDifficulty,
    previous_difficulty: prevDifficulty,
    direction,
    pool_remaining: countRow?.remaining ?? 0,
    fallback,
  };
}

// =============================================================================
// Phase 8 — Adaptive Learning
//
// Tracking (attempts/time/accuracy) already happens at write time in
// practice.routes.ts (every practice_attempts row records is_correct and
// time_spent_seconds). Everything below is the read side: aggregate that
// history per category ("skill"), rank weak skills, and recommend a next
// lesson/question/difficulty/estimated time. A "Learning Path" is generated
// live from this aggregation on every request rather than persisted — this
// codebase already has two different, unpopulated persisted "learning path"
// schemas (skill_programs/program_modules and learning_paths/
// learning_path_courses); computing on demand from real practice data avoids
// picking one arbitrarily and avoids a path going stale as the student
// practices more.
// =============================================================================

const ALL_CATEGORIES: QuestionCategory[] = [
  "reasoning", "maths", "aptitude", "data_structures",
  "programming", "python_coding", "java_coding", "data_science",
];

/** Below this many attempts in a category, accuracy isn't a reliable signal yet. */
const MIN_ATTEMPTS_FOR_SIGNAL = 3;

export interface SkillAccuracy {
  category: QuestionCategory;
  attempts: number;
  correct: number;
  /** 0-1. 0 for categories with no attempts yet (treated as "needs attention", not "mastered"). */
  accuracy: number;
  avgTimeSeconds: number;
  hasEnoughData: boolean;
}

/** Attempts/time/accuracy per category (every one of the 8 fixed categories, even with zero attempts). */
export async function getSkillAccuracy(studentId: string): Promise<SkillAccuracy[]> {
  const rows = await query<{ category: string; attempts: number; correct: number; avg_time: number | null }>(
    `SELECT qb.category::text AS category,
            COUNT(*)::int AS attempts,
            COUNT(*) FILTER (WHERE pa.is_correct)::int AS correct,
            AVG(pa.time_spent_seconds)::float AS avg_time
     FROM practice_attempts pa
     JOIN practice_sessions ps ON ps.id = pa.session_id
     JOIN question_bank qb ON qb.id = pa.question_id
     WHERE ps.student_id = $1 AND pa.is_correct IS NOT NULL
     GROUP BY qb.category`,
    [studentId],
  );
  const byCategory = new Map(rows.map((r) => [r.category, r]));

  return ALL_CATEGORIES.map((category) => {
    const r = byCategory.get(category);
    const attempts = r?.attempts ?? 0;
    const correct = r?.correct ?? 0;
    return {
      category,
      attempts,
      correct,
      accuracy: attempts > 0 ? correct / attempts : 0,
      avgTimeSeconds: r?.avg_time ?? 0,
      hasEnoughData: attempts >= MIN_ATTEMPTS_FOR_SIGNAL,
    };
  });
}

/**
 * Weakest skills first: lowest accuracy, ties broken by fewest attempts (a
 * never-practiced category is ranked alongside a genuinely-failing one —
 * both need attention, just for different reasons).
 */
export async function getWeakSkills(studentId: string, limit = 5): Promise<SkillAccuracy[]> {
  const all = await getSkillAccuracy(studentId);
  return [...all]
    .sort((a, b) => (a.accuracy !== b.accuracy ? a.accuracy - b.accuracy : a.attempts - b.attempts))
    .slice(0, limit);
}

/** Cold start (no data) starts gentle; otherwise scale to demonstrated accuracy. */
export function recommendDifficulty(skill: SkillAccuracy): DifficultyLevel {
  if (!skill.hasEnoughData) return "easy";
  if (skill.accuracy < 0.5) return "easy";
  if (skill.accuracy < 0.8) return "medium";
  return "hard";
}

async function getRecentQuestionIds(studentId: string, category: QuestionCategory, limit: number): Promise<string[]> {
  const rows = await query<{ question_id: string }>(
    `SELECT pa.question_id
     FROM practice_attempts pa
     JOIN practice_sessions ps ON ps.id = pa.session_id
     JOIN question_bank qb ON qb.id = pa.question_id
     WHERE ps.student_id = $1 AND qb.category = $2
     ORDER BY pa.attempted_at DESC
     LIMIT $3`,
    [studentId, category, limit],
  );
  return rows.map((r) => r.question_id);
}

async function findPracticeQuestions(
  category: QuestionCategory,
  difficulty: DifficultyLevel,
  excludeIds: string[],
  count: number,
): Promise<QuestionBankRow[]> {
  return query<QuestionBankRow>(
    `SELECT * FROM question_bank
     WHERE category = $1 AND difficulty_level = $2 AND is_active = TRUE AND status = 'published'
       AND ($3::uuid[] IS NULL OR NOT (id = ANY($3::uuid[])))
     ORDER BY RANDOM()
     LIMIT $4`,
    [category, difficulty, excludeIds.length ? excludeIds : null, count],
  );
}

export interface LessonRecommendation {
  id: string;
  title: string;
  moduleType: string;
  durationMinutes: number | null;
  difficulty: string | null;
}

/**
 * Best-effort match against the existing (admin-authored) learning_modules
 * catalog via its linked skill's name — question_bank.category is a fixed
 * enum ("data_structures") while skills.name is free text, so this is a
 * fuzzy ILIKE match, not a foreign key. Returns null (never a fabricated
 * lesson) when nothing published matches.
 */
export async function findLessonForCategory(category: QuestionCategory): Promise<LessonRecommendation | null> {
  const label = category.replace(/_/g, " ");
  const pattern = `%${label}%`;

  // 1) Prefer skill-linked modules when skills catalog is populated
  const bySkill = await queryOne<{
    id: string; title: string; module_type: string; duration_minutes: number | null; difficulty: string | null;
  }>(
    `SELECT lm.id, lm.title, lm.module_type, lm.duration_minutes, lm.difficulty
     FROM learning_modules lm
     JOIN skills s ON s.id = lm.skill_id
     WHERE lm.is_published = TRUE AND s.name ILIKE $1
     ORDER BY lm.duration_minutes ASC NULLS LAST
     LIMIT 1`,
    [pattern],
  ).catch(() => null);
  if (bySkill) {
    return {
      id: bySkill.id,
      title: bySkill.title,
      moduleType: bySkill.module_type,
      durationMinutes: bySkill.duration_minutes,
      difficulty: bySkill.difficulty,
    };
  }

  // 2) Title/description match (skills table may be empty in demo)
  const byTitle = await queryOne<{
    id: string; title: string; module_type: string; duration_minutes: number | null; difficulty: string | null;
  }>(
    `SELECT lm.id, lm.title, lm.module_type, lm.duration_minutes, lm.difficulty
     FROM learning_modules lm
     WHERE lm.is_published = TRUE
       AND (lm.title ILIKE $1 OR COALESCE(lm.description, '') ILIKE $1)
     ORDER BY lm.duration_minutes ASC NULLS LAST
     LIMIT 1`,
    [pattern],
  ).catch(() => null);
  if (byTitle) {
    return {
      id: byTitle.id,
      title: byTitle.title,
      moduleType: byTitle.module_type,
      durationMinutes: byTitle.duration_minutes,
      difficulty: byTitle.difficulty,
    };
  }

  // 3) LMS lesson/course titled for the category
  const lmsLesson = await queryOne<{
    id: string; title: string; duration_minutes: number | null;
  }>(
    `SELECT l.id, l.title, NULL::int AS duration_minutes
     FROM lessons l
     JOIN course_modules m ON m.id = l.module_id
     JOIN courses c ON c.id = m.course_id
     WHERE l.title ILIKE $1 OR c.title ILIKE $1
     ORDER BY l.created_at ASC NULLS LAST
     LIMIT 1`,
    [pattern],
  ).catch(() => null);
  if (lmsLesson) {
    return {
      id: lmsLesson.id,
      title: lmsLesson.title,
      moduleType: "voice_lesson",
      durationMinutes: lmsLesson.duration_minutes,
      difficulty: null,
    };
  }

  // 4) Any published soft-skill / reading module as placement journey fallback
  const fallback = await queryOne<{
    id: string; title: string; module_type: string; duration_minutes: number | null; difficulty: string | null;
  }>(
    `SELECT lm.id, lm.title, lm.module_type, lm.duration_minutes, lm.difficulty
     FROM learning_modules lm
     WHERE lm.is_published = TRUE
       AND lm.module_type IN ('soft_skill', 'reading', 'video')
     ORDER BY lm.duration_minutes ASC NULLS LAST
     LIMIT 1`,
  ).catch(() => null);
  if (!fallback) return null;
  return {
    id: fallback.id,
    title: fallback.title,
    moduleType: fallback.module_type,
    durationMinutes: fallback.duration_minutes,
    difficulty: fallback.difficulty,
  };
}

/** Rough estimate, not a promise — surfaced to the student as "about N minutes". */
function estimateMinutes(skill: SkillAccuracy, lesson: LessonRecommendation | null, practiceCount: number): number {
  const avgTimePerQuestionMin = skill.avgTimeSeconds > 0 ? skill.avgTimeSeconds / 60 : 1.5; // default guess: 90s/question
  const practiceMinutes = Math.round(avgTimePerQuestionMin * practiceCount);
  const lessonMinutes = lesson?.durationMinutes ?? 0;
  return Math.max(5, lessonMinutes + practiceMinutes);
}

export interface NextRecommendation {
  weakestSkill: SkillAccuracy;
  recommendedDifficulty: DifficultyLevel;
  nextQuestion: QuestionBankRow | null;
  nextLesson: LessonRecommendation | null;
  estimatedLearningTimeMinutes: number;
}

/** Recommend next lesson / next question / difficulty / estimated time for the student's single weakest skill. */
export async function recommendNext(studentId: string): Promise<NextRecommendation> {
  const [weakestSkill] = await getWeakSkills(studentId, 1);
  const recommendedDifficulty = recommendDifficulty(weakestSkill);
  const recentIds = await getRecentQuestionIds(studentId, weakestSkill.category, 30);
  const [nextQuestion] = await findPracticeQuestions(weakestSkill.category, recommendedDifficulty, recentIds, 1);
  const nextLesson = await findLessonForCategory(weakestSkill.category);
  const estimatedLearningTimeMinutes = estimateMinutes(weakestSkill, nextLesson, 5);

  return {
    weakestSkill,
    recommendedDifficulty,
    nextQuestion: nextQuestion ?? null,
    nextLesson,
    estimatedLearningTimeMinutes,
  };
}

export interface LearningPathStep {
  order: number;
  category: QuestionCategory;
  accuracy: number;
  attempts: number;
  hasEnoughData: boolean;
  difficulty: DifficultyLevel;
  lesson: LessonRecommendation | null;
  practiceQuestions: Array<{ id: string; question_text: string; difficulty_level: DifficultyLevel }>;
  estimatedMinutes: number;
}

export interface LearningPath {
  steps: LearningPathStep[];
  totalEstimatedMinutes: number;
}

/**
 * Auto-generates an ordered learning path: weakest skills first, each with a
 * matching lesson (if one exists), a small batch of practice questions at
 * the right difficulty, and an estimated time. Computed live from real
 * attempt history — see file-header note on why this isn't persisted.
 */
export async function generateLearningPath(studentId: string, maxSteps = 5): Promise<LearningPath> {
  const weakSkills = await getWeakSkills(studentId, maxSteps);

  const steps: LearningPathStep[] = [];
  for (let i = 0; i < weakSkills.length; i++) {
    const skill = weakSkills[i];
    const difficulty = recommendDifficulty(skill);
    const recentIds = await getRecentQuestionIds(studentId, skill.category, 30);
    const practiceQuestions = await findPracticeQuestions(skill.category, difficulty, recentIds, 5);
    const lesson = await findLessonForCategory(skill.category);
    const estimatedMinutes = estimateMinutes(skill, lesson, practiceQuestions.length);

    steps.push({
      order: i + 1,
      category: skill.category,
      accuracy: skill.accuracy,
      attempts: skill.attempts,
      hasEnoughData: skill.hasEnoughData,
      difficulty,
      lesson,
      practiceQuestions: practiceQuestions.map((q) => ({
        id: q.id,
        question_text: q.question_text,
        difficulty_level: q.difficulty_level,
      })),
      estimatedMinutes,
    });
  }

  return {
    steps,
    totalEstimatedMinutes: steps.reduce((sum, s) => sum + s.estimatedMinutes, 0),
  };
}
