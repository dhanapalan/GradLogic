/**
 * Assessment Hub — Results & Evaluation
 * Single responsibility: derive attempt insights (score, sections, topics, next practice).
 * Does not build assessments or own Learning Journey templates.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import * as adaptive from "./adaptive.service.js";

export interface SectionScore {
  section: string;
  attempted: number;
  correct: number;
  marks_earned: number;
  marks_available: number;
  accuracy: number;
}

export interface TimeAnalysis {
  allotted_seconds: number | null;
  spent_seconds: number | null;
  unused_seconds: number | null;
  percent_used: number | null;
  avg_seconds_per_question: number | null;
  pace_label: string | null;
  spent_label: string | null;
  allotted_label: string | null;
}

export interface AttemptEvaluation {
  session_id: string;
  drive_id: string;
  drive_name: string;
  drive_type: string | null;
  student_id: string;
  student_name: string | null;
  student_email: string | null;
  status: string;
  overall_score: number | null;
  total_marks: number | null;
  score_percent: number | null;
  accuracy: number | null;
  questions_attempted: number;
  questions_correct: number;
  questions_total: number;
  time_spent_seconds: number | null;
  time_spent_label: string | null;
  duration_minutes: number | null;
  time_analysis: TimeAnalysis;
  section_scores: SectionScore[];
  weak_topics: string[];
  strong_topics: string[];
  recommendations: string[];
  /** True when recommendations were enriched via LLM */
  ai_recommendations_enriched?: boolean;
  next_practice: {
    topic: string | null;
    difficulty: string | null;
    question_id: string | null;
    question_preview: string | null;
    estimated_minutes: number | null;
    practice_href: string;
  };
  recommended_lesson: {
    id: string | null;
    title: string | null;
    source: string | null;
    href: string | null;
  } | null;
  learning_loop: {
    evaluated: boolean;
    weak_skills_detected: boolean;
    lesson_recommended: boolean;
    practice_assigned: boolean;
    journey_updated: boolean;
    readiness_recalculated: boolean;
  } | null;
  learning_journey: {
    updated: boolean;
    journeys_touched: number;
    avg_readiness: number | null;
  };
  completed_at: string | null;
  started_at: string | null;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || seconds < 0) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m <= 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function gradeAnswer(
  correctAnswer: string | null,
  selected: string[] | undefined
): boolean {
  if (!correctAnswer || !selected?.length) return false;
  const correctSet = new Set(correctAnswer.split(",").map((x) => x.trim()));
  const selectedSet = new Set(selected);
  return (
    correctSet.size === selectedSet.size &&
    [...correctSet].every((c) => selectedSet.has(c))
  );
}

async function buildEvaluationFromRow(row: {
  id: string;
  drive_id: string;
  student_id: string;
  status: string;
  score: number | null;
  saved_answers: Record<string, { selected?: string[] }> | null;
  question_mapping: { question_id: string }[] | null;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  time_remaining_seconds: number | null;
  drive_name: string;
  drive_type: string | null;
  duration_minutes: number | null;
  total_marks: number | null;
  student_name: string | null;
  student_email: string | null;
}): Promise<AttemptEvaluation> {
  const mapping = row.question_mapping || [];
  const questionIds = mapping.map((m) => m.question_id);
  const saved = row.saved_answers || {};

  const questions =
    questionIds.length > 0
      ? await query<{
          id: string;
          correct_answer: string | null;
          marks: number | null;
          skill: string | null;
        }>(
          `SELECT id, correct_answer, marks, skill
           FROM drive_pool_questions
           WHERE id = ANY($1::uuid[])`,
          [questionIds]
        )
      : [];

  const bySkill = new Map<
    string,
    { attempted: number; correct: number; earned: number; available: number }
  >();

  let attempted = 0;
  let correct = 0;

  for (const q of questions) {
    const section = (q.skill || "General").trim() || "General";
    const bucket = bySkill.get(section) || {
      attempted: 0,
      correct: 0,
      earned: 0,
      available: 0,
    };
    const marks = Number(q.marks) || 0;
    bucket.available += marks;

    const ans = saved[q.id];
    const hasAnswer = !!(ans?.selected && ans.selected.length > 0);
    if (hasAnswer) {
      attempted += 1;
      bucket.attempted += 1;
      if (gradeAnswer(q.correct_answer, ans.selected)) {
        correct += 1;
        bucket.correct += 1;
        bucket.earned += marks;
      }
    }
    bySkill.set(section, bucket);
  }

  const section_scores: SectionScore[] = [...bySkill.entries()]
    .map(([section, b]) => ({
      section,
      attempted: b.attempted,
      correct: b.correct,
      marks_earned: b.earned,
      marks_available: b.available,
      accuracy: b.attempted > 0 ? b.correct / b.attempted : 0,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);

  const weak_topics = section_scores
    .filter((s) => s.attempted > 0 && s.accuracy < 0.5)
    .map((s) => s.section);
  const strong_topics = section_scores
    .filter((s) => s.attempted > 0 && s.accuracy >= 0.7)
    .map((s) => s.section);

  // If no skill tags, fall back to Adaptive practice weak/strong for the student
  let adaptiveWeak: string[] = [];
  let adaptiveStrong: string[] = [];
  if (weak_topics.length === 0 || strong_topics.length === 0) {
    try {
      const skills = await adaptive.getSkillAccuracy(row.student_id);
      const withData = skills.filter((s) => s.attempts > 0);
      adaptiveWeak = withData
        .filter((s) => s.accuracy < 0.5)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 5)
        .map((s) => s.category);
      adaptiveStrong = withData
        .filter((s) => s.accuracy >= 0.7)
        .sort((a, b) => b.accuracy - a.accuracy)
        .slice(0, 5)
        .map((s) => s.category);
    } catch {
      /* optional */
    }
  }

  const finalWeak = weak_topics.length ? weak_topics : adaptiveWeak;
  const finalStrong = strong_topics.length ? strong_topics : adaptiveStrong;

  const studentPracticeHref = (topic: string | null, difficulty?: string | null) => {
    if (!topic) return "/app/student-portal/practice";
    const q = new URLSearchParams({ topic });
    if (difficulty) q.set("difficulty", difficulty);
    return `/app/student-portal/practice?${q.toString()}`;
  };

  let next_practice: AttemptEvaluation["next_practice"] = {
    topic: finalWeak[0] || null,
    difficulty: null,
    question_id: null,
    question_preview: null,
    estimated_minutes: null,
    practice_href: studentPracticeHref(finalWeak[0] || null),
  };

  let nextLesson: AttemptEvaluation["recommended_lesson"] = null;

  try {
    const rec = await adaptive.recommendNext(row.student_id);
    next_practice = {
      topic: rec.weakestSkill?.category || finalWeak[0] || null,
      difficulty: rec.recommendedDifficulty || null,
      question_id: rec.nextQuestion?.id || null,
      question_preview: rec.nextQuestion?.question_text
        ? String(rec.nextQuestion.question_text).slice(0, 120)
        : null,
      estimated_minutes: rec.estimatedLearningTimeMinutes ?? null,
      practice_href: studentPracticeHref(
        rec.weakestSkill?.category || finalWeak[0] || null,
        rec.recommendedDifficulty || null
      ),
    };
    if (rec.nextLesson) {
      nextLesson = {
        id: rec.nextLesson.id,
        title: rec.nextLesson.title,
        source: "learning_module",
        href: "/app/student-portal/adaptive-learning",
      };
    }
  } catch {
    /* optional */
  }

  // Prefer persisted continuous-loop assignment when ExamSubmitted already ran
  let learning_loop: AttemptEvaluation["learning_loop"] = null;
  try {
    const insight = await queryOne<{
      recommended_lesson_id: string | null;
      recommended_lesson_title: string | null;
      recommended_lesson_source: string | null;
      recommended_lesson_href: string | null;
      assigned_practice_topic: string | null;
      assigned_practice_difficulty: string | null;
      assigned_practice_href: string | null;
      loop_status: AttemptEvaluation["learning_loop"];
    }>(
      `SELECT recommended_lesson_id, recommended_lesson_title, recommended_lesson_source,
              recommended_lesson_href, assigned_practice_topic, assigned_practice_difficulty,
              assigned_practice_href, loop_status
       FROM student_assessment_insights
       WHERE session_id = $1`,
      [row.id]
    );
    if (insight) {
      learning_loop = insight.loop_status || null;
      if (insight.assigned_practice_topic) {
        next_practice = {
          ...next_practice,
          topic: insight.assigned_practice_topic,
          difficulty: insight.assigned_practice_difficulty || next_practice.difficulty,
          practice_href:
            insight.assigned_practice_href ||
            studentPracticeHref(
              insight.assigned_practice_topic,
              insight.assigned_practice_difficulty
            ),
        };
      }
      if (insight.recommended_lesson_id) {
        nextLesson = {
          id: insight.recommended_lesson_id,
          title: insight.recommended_lesson_title,
          source: insight.recommended_lesson_source,
          href: insight.recommended_lesson_href || "/app/student-portal/adaptive-learning",
        };
      }
    }
  } catch {
    /* migration 55 optional */
  }

  const recommendations: string[] = [];
  if (finalWeak.length) {
    recommendations.push(
      `Focus practice on: ${finalWeak.slice(0, 3).join(", ")}.`
    );
  }
  if (finalStrong.length) {
    recommendations.push(
      `Maintain strength in: ${finalStrong.slice(0, 3).join(", ")}.`
    );
  }
  const accuracy =
    attempted > 0 ? correct / attempted : questions.length ? 0 : null;
  const scorePercent =
    row.score != null && row.total_marks
      ? Math.round((Number(row.score) / Number(row.total_marks)) * 1000) / 10
      : row.score != null
        ? Number(row.score)
        : null;

  if (scorePercent != null && scorePercent < 40) {
    recommendations.push(
      "Score is below typical placement cutoff — schedule a mock and revise weak sections."
    );
  } else if (scorePercent != null && scorePercent >= 70) {
    recommendations.push(
      "Strong overall performance — move to timed mocks and coding assessments."
    );
  }
  if (next_practice.topic) {
    recommendations.push(
      `Next practice: ${next_practice.topic}${
        next_practice.difficulty ? ` (${next_practice.difficulty})` : ""
      }.`
    );
  }
  if (!recommendations.length) {
    recommendations.push(
      "Complete more attempts so AI can refine weak/strong topics and next practice."
    );
  }

  let timeSpent: number | null = null;
  if (row.started_at && row.completed_at) {
    timeSpent = Math.max(
      0,
      Math.round(
        (new Date(row.completed_at).getTime() -
          new Date(row.started_at).getTime()) /
          1000
      )
    );
  } else if (
    row.started_at &&
    row.duration_minutes != null &&
    row.time_remaining_seconds != null
  ) {
    timeSpent = Math.max(
      0,
      row.duration_minutes * 60 - Number(row.time_remaining_seconds)
    );
  }

  const allotted =
    row.duration_minutes != null ? Math.round(Number(row.duration_minutes) * 60) : null;
  const qTotal = questions.length || mapping.length || 0;
  let percentUsed: number | null = null;
  let unused: number | null = null;
  let paceLabel: string | null = null;
  if (timeSpent != null && allotted != null && allotted > 0) {
    percentUsed = Math.round((timeSpent / allotted) * 1000) / 10;
    unused = Math.max(0, allotted - timeSpent);
    if (percentUsed <= 50) paceLabel = "Finished early — review rushed sections";
    else if (percentUsed <= 85) paceLabel = "Healthy pace within allotted time";
    else if (percentUsed <= 100) paceLabel = "Used most of the allotted time";
    else paceLabel = "Ran past allotted time (or overtime submit)";
  } else if (timeSpent != null) {
    paceLabel = "Time recorded for this attempt";
  }

  if (timeSpent != null && allotted != null && percentUsed != null) {
    if (percentUsed < 40 && (scorePercent == null || scorePercent < 60)) {
      recommendations.push(
        "You finished quickly with room to improve — slow down and re-check weak sections."
      );
    } else if (percentUsed > 95 && finalWeak.length) {
      recommendations.push(
        "Time pressure showed on weak topics — practice timed drills on those sections."
      );
    }
  }

  const time_analysis: TimeAnalysis = {
    allotted_seconds: allotted,
    spent_seconds: timeSpent,
    unused_seconds: unused,
    percent_used: percentUsed,
    avg_seconds_per_question:
      timeSpent != null && qTotal > 0
        ? Math.round(timeSpent / qTotal)
        : null,
    pace_label: paceLabel,
    spent_label: formatDuration(timeSpent),
    allotted_label: formatDuration(allotted),
  };

  // Journey touch summary (events written on ExamSubmitted)
  let journeys_touched = 0;
  let avg_readiness: number | null = null;
  try {
    const j = await queryOne<{ n: string; avg: string | null }>(
      `SELECT COUNT(*)::text AS n,
              ROUND(AVG(placement_readiness))::text AS avg
       FROM student_journeys
       WHERE student_id = $1 AND status IN ('in_progress','completed','paused')`,
      [row.student_id]
    );
    journeys_touched = Number(j?.n) || 0;
    avg_readiness = j?.avg != null ? Number(j.avg) : null;
  } catch {
    /* table may be absent in older DBs */
  }

  const journeyEvent = await queryOne<{ id: string }>(
    `SELECT e.id
     FROM student_journey_events e
     JOIN student_journeys j ON j.id = e.journey_id
     WHERE j.student_id = $1
       AND e.event_type = 'assessment_evaluated'
       AND e.payload->>'session_id' = $2
     LIMIT 1`,
    [row.student_id, row.id]
  ).catch(() => null);

  return {
    session_id: row.id,
    drive_id: row.drive_id,
    drive_name: row.drive_name,
    drive_type: row.drive_type,
    student_id: row.student_id,
    student_name: row.student_name,
    student_email: row.student_email,
    status: row.status,
    overall_score: row.score != null ? Number(row.score) : null,
    total_marks: row.total_marks != null ? Number(row.total_marks) : null,
    score_percent: scorePercent,
    accuracy,
    questions_attempted: attempted,
    questions_correct: correct,
    questions_total: questions.length || mapping.length,
    time_spent_seconds: timeSpent,
    time_spent_label: formatDuration(timeSpent),
    duration_minutes: row.duration_minutes,
    time_analysis,
    section_scores,
    weak_topics: finalWeak,
    strong_topics: finalStrong,
    recommendations,
    next_practice,
    recommended_lesson: nextLesson,
    learning_loop,
    learning_journey: {
      updated: !!journeyEvent || !!(learning_loop?.journey_updated),
      journeys_touched,
      avg_readiness,
    },
    completed_at: row.completed_at
      ? new Date(row.completed_at).toISOString()
      : null,
    started_at: row.started_at
      ? new Date(row.started_at).toISOString()
      : null,
  };
}

/** Optional LLM coaching lines — used on single-attempt fetch (not list). */
async function enrichAiRecommendations(
  ev: AttemptEvaluation
): Promise<AttemptEvaluation> {
  try {
    const { generate } = await import("./ai.service.js");
    const prompt = [
      `Assessment: ${ev.drive_name} (${ev.drive_type || "assessment"})`,
      `Score: ${ev.overall_score ?? "—"} / ${ev.total_marks ?? "—"} (${ev.score_percent ?? "—"}%)`,
      `Accuracy: ${ev.accuracy != null ? Math.round(ev.accuracy * 100) : "—"}%`,
      `Time: ${ev.time_analysis.spent_label || "—"} of ${ev.time_analysis.allotted_label || "—"} (${ev.time_analysis.pace_label || ""})`,
      `Weak topics: ${ev.weak_topics.join(", ") || "none"}`,
      `Strong topics: ${ev.strong_topics.join(", ") || "none"}`,
      `Next practice topic: ${ev.next_practice.topic || "general"}`,
      "Write 3 short, actionable coaching recommendations for a campus placement student.",
      "Return plain bullet lines only (no numbering, no preamble).",
    ].join("\n");

    const result = await generate(prompt, {
      system:
        "You are TalentSecure AI Results coach. Be specific and encouraging. No full solutions.",
      maxTokens: 500,
      riskLevel: "practice",
    });

    const aiLines = result.text
      .split("\n")
      .map((l) => l.replace(/^[-*•]\s*/, "").trim())
      .filter((l) => l.length > 12)
      .slice(0, 4);

    if (!aiLines.length) return ev;
    const merged = [...aiLines, ...ev.recommendations];
    const seen = new Set<string>();
    const recommendations = merged.filter((r) => {
      const k = r.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 8);

    return { ...ev, recommendations, ai_recommendations_enriched: true };
  } catch {
    return ev;
  }
}

export async function listRecentEvaluations(filters?: {
  limit?: number;
  driveId?: string;
  search?: string;
}): Promise<AttemptEvaluation[]> {
  const limit = Math.min(filters?.limit ?? 40, 100);
  const params: unknown[] = [];
  const where = [`ds.status = 'completed'`];

  if (filters?.driveId) {
    params.push(filters.driveId);
    where.push(`ds.drive_id = $${params.length}`);
  }
  if (filters?.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(
      `(ad.name ILIKE $${params.length} OR u.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`
    );
  }

  params.push(limit);
  const rows = await query<{
    id: string;
    drive_id: string;
    student_id: string;
    status: string;
    score: number | null;
    saved_answers: Record<string, { selected?: string[] }> | null;
    question_mapping: { question_id: string }[] | null;
    started_at: string | Date | null;
    completed_at: string | Date | null;
    time_remaining_seconds: number | null;
    drive_name: string;
    drive_type: string | null;
    duration_minutes: number | null;
    total_marks: number | null;
    student_name: string | null;
    student_email: string | null;
  }>(
    `SELECT ds.id, ds.drive_id, ds.student_id, ds.status, ds.score,
            ds.saved_answers, ds.question_mapping, ds.started_at, ds.completed_at,
            ds.time_remaining_seconds,
            ad.name AS drive_name, ad.drive_type,
            COALESCE(ad.duration_minutes, art.duration_minutes) AS duration_minutes,
            art.total_marks,
            u.full_name AS student_name, u.email AS student_email
     FROM drive_students ds
     JOIN assessment_drives ad ON ad.id = ds.drive_id
     LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
     LEFT JOIN users u ON u.id = ds.student_id
     WHERE ${where.join(" AND ")}
     ORDER BY ds.completed_at DESC NULLS LAST
     LIMIT $${params.length}`,
    params
  );

  const out: AttemptEvaluation[] = [];
  for (const row of rows) {
    out.push(await buildEvaluationFromRow(row));
  }
  return out;
}

const EVAL_SELECT = `
  SELECT ds.id, ds.drive_id, ds.student_id, ds.status, ds.score,
         ds.saved_answers, ds.question_mapping, ds.started_at, ds.completed_at,
         ds.time_remaining_seconds,
         ad.name AS drive_name, ad.drive_type,
         COALESCE(ad.duration_minutes, art.duration_minutes) AS duration_minutes,
         art.total_marks,
         u.full_name AS student_name, u.email AS student_email
  FROM drive_students ds
  JOIN assessment_drives ad ON ad.id = ds.drive_id
  LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
  LEFT JOIN users u ON u.id = ds.student_id
`;

export async function getAttemptEvaluation(
  sessionId: string,
  opts?: { enrichAi?: boolean }
): Promise<AttemptEvaluation> {
  const row = await queryOne<{
    id: string;
    drive_id: string;
    student_id: string;
    status: string;
    score: number | null;
    saved_answers: Record<string, { selected?: string[] }> | null;
    question_mapping: { question_id: string }[] | null;
    started_at: string | Date | null;
    completed_at: string | Date | null;
    time_remaining_seconds: number | null;
    drive_name: string;
    drive_type: string | null;
    duration_minutes: number | null;
    total_marks: number | null;
    student_name: string | null;
    student_email: string | null;
  }>(`${EVAL_SELECT} WHERE ds.id = $1`, [sessionId]);

  if (!row) throw new AppError("Attempt not found", 404);
  const ev = await buildEvaluationFromRow(row);
  if (opts?.enrichAi) return enrichAiRecommendations(ev);
  return ev;
}

/** Student Results & Evaluation — own completed attempt for a drive. */
export async function getStudentDriveEvaluation(
  driveId: string,
  studentId: string,
  opts?: { enrichAi?: boolean }
): Promise<AttemptEvaluation> {
  const row = await queryOne<{
    id: string;
    drive_id: string;
    student_id: string;
    status: string;
    score: number | null;
    saved_answers: Record<string, { selected?: string[] }> | null;
    question_mapping: { question_id: string }[] | null;
    started_at: string | Date | null;
    completed_at: string | Date | null;
    time_remaining_seconds: number | null;
    drive_name: string;
    drive_type: string | null;
    duration_minutes: number | null;
    total_marks: number | null;
    student_name: string | null;
    student_email: string | null;
  }>(
    `${EVAL_SELECT}
     WHERE ds.drive_id = $1 AND ds.student_id = $2 AND ds.status = 'completed'
     ORDER BY ds.completed_at DESC NULLS LAST
     LIMIT 1`,
    [driveId, studentId]
  );

  if (!row) throw new AppError("No completed attempt found for this assessment", 404);
  const ev = await buildEvaluationFromRow(row);
  if (opts?.enrichAi !== false) return enrichAiRecommendations(ev);
  return ev;
}

export async function getEvaluationOverview() {
  const stats = await queryOne<{
    completed: string;
    students: string;
    avg_score: string | null;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
      COUNT(DISTINCT student_id) FILTER (WHERE status = 'completed')::text AS students,
      ROUND(AVG(score) FILTER (WHERE status = 'completed' AND score IS NOT NULL), 1)::text AS avg_score
    FROM drive_students
  `);

  return {
    completedAttempts: Number(stats?.completed) || 0,
    studentsEvaluated: Number(stats?.students) || 0,
    averageScore: stats?.avg_score != null ? Number(stats.avg_score) : null,
  };
}
