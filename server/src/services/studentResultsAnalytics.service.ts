/**
 * Student Portal Module 07 — Results & Performance Analytics facade.
 *
 * Learning Intelligence Layer (consume-only):
 * aggregates published Evaluation Engine outcomes + existing analytics/readiness
 * signals into skill / topic / difficulty / bloom / learning-outcome dimensions.
 *
 * Does NOT evaluate, score, or publish results.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureEvaluationSchema } from "./collegeCampaignEvaluation.service.js";
import { ensureCollegeQuestionBankSchema } from "./collegeQuestionBank.service.js";
import * as dashboard from "./studentDashboard.service.js";

const PORTAL = "/app/student-portal";

export type HistoryFilters = {
  search?: string;
  skill?: string;
  assessment_type?: string;
  status?: "completed" | "pending_evaluation" | string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

function performanceCategory(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(Number(pct))) return "Unknown";
  const n = Number(pct);
  if (n >= 85) return "Excellent";
  if (n >= 70) return "Good";
  if (n >= 50) return "Average";
  return "Needs Improvement";
}

function letterGrade(pct: number | null | undefined): string | null {
  if (pct == null || Number.isNaN(Number(pct))) return null;
  const n = Number(pct);
  if (n >= 90) return "A";
  if (n >= 80) return "B";
  if (n >= 70) return "C";
  if (n >= 60) return "D";
  return "F";
}

/** Map engine difficulty → Learning Intelligence labels. */
function mapDifficulty(raw: string | null | undefined): string {
  const d = String(raw || "unknown").toLowerCase();
  if (d === "beginner" || d === "easy") return d === "beginner" ? "Beginner" : "Easy";
  if (d === "medium" || d === "intermediate") return "Intermediate";
  if (d === "hard" || d === "advanced") return d === "hard" ? "Advanced" : "Advanced";
  if (d === "expert") return "Expert";
  return raw ? String(raw) : "Unknown";
}

function outcomeStatus(accuracy: number | null, attempted: boolean): string {
  if (!attempted) return "Not Attempted";
  if (accuracy == null) return "Not Attempted";
  if (accuracy >= 80) return "Achieved";
  if (accuracy >= 50) return "Partially Achieved";
  return "Needs Improvement";
}

function recommendationFor(skill: string, pct: number): string {
  if (pct >= 85) return `Maintain mastery in ${skill} with spaced practice.`;
  if (pct >= 70) return `Strengthen ${skill} with targeted topic drills.`;
  if (pct >= 50) return `Focus Learning Hub lessons on ${skill}, then practice weak topics.`;
  return `Prioritize ${skill}: start recommended lessons, then Practice Hub weak-topic sets.`;
}

type QuestionIntelRow = {
  question_id: string;
  title: string;
  description: string | null;
  category: string | null;
  topic: string | null;
  sub_topic: string | null;
  bloom_level: string | null;
  learning_outcome: string | null;
  difficulty: string | null;
  question_type: string;
  marks_possible: number;
  marks_awarded: number;
  is_correct: boolean | null;
  selected: unknown;
  correct_labels: unknown;
  evaluation_status: string;
  manual_feedback: string | null;
  attempt_id: string;
  evaluation_id: string;
  campaign_id: string;
  percentage: number;
};

function parseJsonArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return v ? [v] : [];
    }
  }
  return [];
}

async function loadStudentQuestionIntel(studentId: string, attemptId?: string): Promise<QuestionIntelRow[]> {
  await ensureEvaluationSchema();
  await ensureCollegeQuestionBankSchema();
  const params: unknown[] = [studentId];
  let attemptClause = "";
  if (attemptId) {
    params.push(attemptId);
    attemptClause = ` AND e.attempt_id = $${params.length}`;
  }

  return query<QuestionIntelRow>(
    `SELECT
       qr.question_id,
       q.title,
       q.description,
       q.category,
       COALESCE(NULLIF(q.topic, ''), q.category) AS topic,
       COALESCE(NULLIF(q.sub_topic, ''), q.question_type) AS sub_topic,
       q.bloom_level,
       q.learning_outcome,
       q.difficulty,
       q.question_type,
       qr.marks_possible::float AS marks_possible,
       qr.marks_awarded::float AS marks_awarded,
       qr.is_correct,
       qr.selected,
       qr.correct_labels,
       qr.evaluation_status,
       qr.manual_feedback,
       e.attempt_id,
       e.id AS evaluation_id,
       e.campaign_id,
       e.percentage::float AS percentage
     FROM college_campaign_question_results qr
     JOIN college_campaign_evaluations e ON e.id = qr.evaluation_id
     JOIN college_questions q ON q.id = qr.question_id
     WHERE e.user_id = $1
       AND e.status = 'published'
       ${attemptClause}
     ORDER BY q.category NULLS LAST, q.title ASC`,
    params
  );
}

function aggregateByKey(
  rows: QuestionIntelRow[],
  keyFn: (r: QuestionIntelRow) => string
) {
  const map = new Map<
    string,
    { questions: number; correct: number; wrong: number; attempted: number; marks: number; possible: number }
  >();
  for (const r of rows) {
    const key = keyFn(r) || "General";
    const b = map.get(key) || {
      questions: 0,
      correct: 0,
      wrong: 0,
      attempted: 0,
      marks: 0,
      possible: 0,
    };
    b.questions += 1;
    b.possible += Number(r.marks_possible) || 0;
    b.marks += Number(r.marks_awarded) || 0;
    if (r.is_correct === true) {
      b.correct += 1;
      b.attempted += 1;
    } else if (r.is_correct === false) {
      b.wrong += 1;
      b.attempted += 1;
    }
    map.set(key, b);
  }
  return [...map.entries()].map(([name, b]) => {
    const accuracy =
      b.attempted > 0 ? Math.round((b.correct / b.attempted) * 100) : null;
    const percentage =
      b.possible > 0 ? Math.round((b.marks / b.possible) * 100) : accuracy;
    return {
      name,
      questions: b.questions,
      correct: b.correct,
      wrong: b.wrong,
      attempted: b.attempted,
      score: Math.round(b.marks * 100) / 100,
      percentage,
      accuracy,
      performance: performanceCategory(percentage ?? accuracy),
      recommendation: recommendationFor(name, percentage ?? accuracy ?? 0),
    };
  });
}

/** GET /results/history */
export async function getHistory(studentId: string, filters: HistoryFilters = {}) {
  await ensureEvaluationSchema();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * limit;

  const params: unknown[] = [studentId];
  const where: string[] = [`e.user_id = $1`];

  if (filters.status === "pending_evaluation") {
    where.push(`e.status IN ('evaluated','pending','draft')`);
  } else if (filters.status === "completed" || !filters.status) {
    // Default history: published (+ optional pending if explicitly requested)
    if (filters.status === "completed") {
      where.push(`e.status = 'published'`);
    } else {
      where.push(`e.status IN ('published','evaluated','pending')`);
    }
  }

  if (filters.search?.trim()) {
    params.push(`%${filters.search.trim()}%`);
    where.push(
      `(a.name ILIKE $${params.length} OR c.name ILIKE $${params.length} OR COALESCE(a.assessment_type,'') ILIKE $${params.length})`
    );
  }
  if (filters.assessment_type?.trim()) {
    params.push(filters.assessment_type.trim());
    where.push(`a.assessment_type = $${params.length}`);
  }
  if (filters.date_from) {
    params.push(filters.date_from);
    where.push(`COALESCE(att.submitted_at, e.evaluated_at) >= $${params.length}::timestamptz`);
  }
  if (filters.date_to) {
    params.push(filters.date_to);
    where.push(`COALESCE(att.submitted_at, e.evaluated_at) <= $${params.length}::timestamptz`);
  }
  if (filters.skill?.trim()) {
    params.push(filters.skill.trim());
    where.push(`EXISTS (
      SELECT 1 FROM college_campaign_question_results qr
      JOIN college_questions q ON q.id = qr.question_id
      WHERE qr.evaluation_id = e.id AND q.category = $${params.length}
    )`);
  }

  const whereSql = where.join(" AND ");

  const countRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN college_assessments a ON a.id = e.assessment_id
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     WHERE ${whereSql}`,
    params
  );

  params.push(limit, offset);
  const rows = await query<{
    attempt_id: string;
    evaluation_id: string;
    campaign_id: string;
    assessment_id: string;
    assessment_name: string;
    campaign_name: string;
    assessment_type: string | null;
    subject: string | null;
    attempt_number: number;
    completed_at: string | null;
    obtained_marks: number;
    total_marks: number;
    percentage: number;
    passed: boolean | null;
    status: string;
    duration_seconds: number | null;
  }>(
    `SELECT
       e.attempt_id,
       e.id AS evaluation_id,
       e.campaign_id,
       e.assessment_id,
       a.name AS assessment_name,
       c.name AS campaign_name,
       a.assessment_type,
       COALESCE(a.assessment_type, a.name) AS subject,
       att.attempt_number,
       COALESCE(att.submitted_at, e.published_at, e.evaluated_at)::text AS completed_at,
       e.obtained_marks::float AS obtained_marks,
       e.total_marks::float AS total_marks,
       e.percentage::float AS percentage,
       e.passed,
       e.status,
       CASE
         WHEN att.started_at IS NOT NULL AND att.submitted_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (att.submitted_at - att.started_at))::int
         ELSE NULL
       END AS duration_seconds
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN college_assessments a ON a.id = e.assessment_id
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     WHERE ${whereSql}
     ORDER BY COALESCE(att.submitted_at, e.published_at, e.evaluated_at) DESC NULLS LAST
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  const data = rows.map((r) => {
    const pct = Math.round(Number(r.percentage) || 0);
    const published = r.status === "published";
    return {
      attempt_id: r.attempt_id,
      evaluation_id: r.evaluation_id,
      campaign_id: r.campaign_id,
      assessment_id: r.assessment_id,
      assessment_name: r.assessment_name,
      campaign_name: r.campaign_name,
      subject: r.subject,
      assessment_type: r.assessment_type,
      attempt: r.attempt_number,
      completed_at: r.completed_at,
      score: r.obtained_marks,
      total_marks: r.total_marks,
      percentage: pct,
      grade: letterGrade(pct),
      passed: r.passed,
      status: published ? "Completed" : "Pending Evaluation",
      evaluation_status: r.status,
      duration_seconds: r.duration_seconds,
      report_href: published
        ? `${PORTAL}/results/report/${r.attempt_id}`
        : `${PORTAL}/my-assessments/${r.campaign_id}/result`,
      action: published ? "View Report" : "Awaiting publication",
    };
  });

  const total = Number(countRow?.n || 0);
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** GET /results/:attemptId — dashboard summary for one attempt */
export async function getAttemptSummary(studentId: string, attemptId: string) {
  await ensureEvaluationSchema();
  const row = await queryOne<{
    attempt_id: string;
    evaluation_id: string;
    campaign_id: string;
    assessment_id: string;
    assessment_name: string;
    campaign_name: string;
    assessment_type: string | null;
    attempt_number: number;
    obtained_marks: number;
    total_marks: number;
    percentage: number;
    passed: boolean | null;
    status: string;
    published_at: string | null;
    submitted_at: string | null;
    started_at: string | null;
    duration_seconds: number | null;
    passing_marks: number | null;
  }>(
    `SELECT
       e.attempt_id, e.id AS evaluation_id, e.campaign_id, e.assessment_id,
       a.name AS assessment_name, c.name AS campaign_name, a.assessment_type,
       att.attempt_number,
       e.obtained_marks::float AS obtained_marks,
       e.total_marks::float AS total_marks,
       e.percentage::float AS percentage,
       e.passed, e.status,
       e.published_at::text, att.submitted_at::text, att.started_at::text,
       e.passing_marks::float AS passing_marks,
       CASE
         WHEN att.started_at IS NOT NULL AND att.submitted_at IS NOT NULL
         THEN EXTRACT(EPOCH FROM (att.submitted_at - att.started_at))::int
         ELSE NULL
       END AS duration_seconds
     FROM college_campaign_evaluations e
     JOIN college_assessments a ON a.id = e.assessment_id
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     WHERE e.attempt_id = $1 AND e.user_id = $2
     ORDER BY CASE WHEN e.status = 'published' THEN 0 ELSE 1 END, e.evaluated_at DESC NULLS LAST
     LIMIT 1`,
    [attemptId, studentId]
  );

  if (!row) throw new AppError("Result not found.", 404);
  if (row.status !== "published") {
    throw new AppError("Results have not been published yet. Please check back later.", 403);
  }

  const pct = Math.round(Number(row.percentage) || 0);
  const readiness = await dashboard.getReadiness(studentId).catch(() => null);
  const skills = await getSkillAnalysis(studentId, attemptId).catch(() => null);

  return {
    attempt_id: row.attempt_id,
    evaluation_id: row.evaluation_id,
    campaign_id: row.campaign_id,
    assessment_id: row.assessment_id,
    assessment_name: row.assessment_name,
    campaign_name: row.campaign_name,
    assessment_type: row.assessment_type,
    overall_score: row.obtained_marks,
    total_marks: row.total_marks,
    percentage: pct,
    grade: letterGrade(pct),
    pass_fail: row.passed === true ? "Pass" : row.passed === false ? "Fail" : "—",
    passed: row.passed,
    rank: null as number | null,
    percentile: null as number | null,
    placement_readiness_impact: readiness
      ? {
          current: readiness.score,
          previous: readiness.previous_score,
          trend: readiness.trend,
          level: readiness.level,
        }
      : null,
    attempt_number: row.attempt_number,
    assessment_duration_seconds: row.duration_seconds,
    submission_time: row.submitted_at,
    evaluation_status: row.status,
    published_at: row.published_at,
    performance_category: performanceCategory(pct),
    strongest_skill: skills?.strongest_skill ?? null,
    weakest_skill: skills?.weakest_skill ?? null,
    continue_learning: {
      learning_hub: `${PORTAL}/my-learning`,
      practice_hub: `${PORTAL}/practice`,
      practice_weak: skills?.weakest_skill
        ? `${PORTAL}/practice?topic=${encodeURIComponent(skills.weakest_skill.name)}`
        : `${PORTAL}/practice`,
      ai_coach: `${PORTAL}/placement-coach`,
      retry_assessment: `${PORTAL}/my-assessments/${row.campaign_id}`,
      my_assessments: `${PORTAL}/my-assessments`,
    },
  };
}

/** GET /results/:attemptId/questions */
export async function getAttemptQuestions(studentId: string, attemptId: string) {
  // Ownership + published gate
  await getAttemptSummary(studentId, attemptId);
  const rows = await loadStudentQuestionIntel(studentId, attemptId);

  return {
    attempt_id: attemptId,
    total: rows.length,
    questions: rows.map((r) => {
      const skill = r.category || "General";
      const topic = r.topic || r.category || "General";
      const difficulty = mapDifficulty(r.difficulty);
      return {
        question_id: r.question_id,
        question: r.title,
        explanation: r.description || r.manual_feedback || null,
        student_answer: parseJsonArray(r.selected),
        correct_answer: parseJsonArray(r.correct_labels),
        marks_awarded: r.marks_awarded,
        marks_possible: r.marks_possible,
        is_correct: r.is_correct,
        skill,
        topic,
        sub_topic: r.sub_topic || r.question_type || null,
        difficulty,
        bloom_level: r.bloom_level || null,
        learning_outcome:
          r.learning_outcome ||
          (skill ? `Demonstrate competence in ${skill} (${difficulty})` : null),
        reference_lesson: {
          title: `Review ${topic}`,
          href: `${PORTAL}/my-learning`,
        },
        actions: {
          explain_ai_href: `${PORTAL}/placement-coach?tab=explain`,
          practice_similar_href: `${PORTAL}/practice?topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(String(r.difficulty || ""))}`,
          bookmarkable: true,
        },
      };
    }),
  };
}

/** GET /analytics/performance */
export async function getPerformanceOverview(studentId: string) {
  const [history, skills, readiness, intel] = await Promise.all([
    getHistory(studentId, { status: "completed", limit: 100, page: 1 }),
    getSkillAnalysis(studentId),
    dashboard.getReadiness(studentId).catch(() => null),
    loadStudentQuestionIntel(studentId),
  ]);

  const scores = history.data.map((h) => h.percentage).filter((n) => n != null);
  const overall =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const outcomes = getLearningOutcomesFromRows(intel);

  return {
    overall_performance_score: overall,
    overall_grade: letterGrade(overall),
    performance_category: performanceCategory(overall),
    assessments_completed: history.data.length,
    strongest_skill: skills.strongest_skill,
    weakest_skill: skills.weakest_skill,
    learning_outcomes_achieved: outcomes.filter((o) => o.status === "Achieved").length,
    learning_outcomes_total: outcomes.length,
    readiness: readiness
      ? {
          score: readiness.score,
          level: readiness.level,
          previous: readiness.previous_score,
          trend: readiness.trend,
        }
      : null,
  };
}

/** GET /analytics/skills */
export async function getSkillAnalysis(studentId: string, attemptId?: string) {
  const dash = await dashboard.getSkills(studentId).catch(() => ({
    top_skills: [] as Array<{ name: string; proficiency: number; source?: string | null }>,
    weak_skills: [] as Array<{ name: string; proficiency: number; source?: string | null }>,
    recommended_improvements: [] as Array<{ skill: string; message: string }>,
  }));

  const rows = await loadStudentQuestionIntel(studentId, attemptId);
  const fromResults = aggregateByKey(rows, (r) => r.category || "General").map((s) => ({
    skill_name: s.name,
    score: s.score,
    percentage: s.percentage ?? 0,
    performance: s.performance,
    progress: s.percentage ?? 0,
    questions: s.questions,
    correct: s.correct,
    wrong: s.wrong,
    accuracy: s.accuracy,
    recommended_improvement: s.recommendation,
    source: "assessment_results" as const,
  }));

  // Merge dashboard proficiency when no per-question intel yet
  const skills =
    fromResults.length > 0
      ? fromResults
      : [...dash.top_skills, ...dash.weak_skills].map((s) => ({
          skill_name: s.name,
          score: s.proficiency,
          percentage: s.proficiency,
          performance: performanceCategory(s.proficiency),
          progress: s.proficiency,
          questions: null as number | null,
          correct: null as number | null,
          wrong: null as number | null,
          accuracy: s.proficiency,
          recommended_improvement: recommendationFor(s.name, s.proficiency),
          source: (s.source || "skill_progress") as string,
        }));

  const sorted = [...skills].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
  return {
    // Backward-compatible Module 02 fields
    top_skills: dash.top_skills,
    weak_skills: dash.weak_skills,
    recommended_improvements: dash.recommended_improvements,
    // Module 07
    skills: sorted,
    strongest_skill: sorted[0]
      ? { name: sorted[0].skill_name, percentage: sorted[0].percentage }
      : null,
    weakest_skill: sorted.length
      ? {
          name: sorted[sorted.length - 1].skill_name,
          percentage: sorted[sorted.length - 1].percentage,
        }
      : null,
  };
}

/** GET /analytics/topics */
export async function getTopicAnalysis(studentId: string, attemptId?: string) {
  const rows = await loadStudentQuestionIntel(studentId, attemptId);
  const skills = [...new Set(rows.map((r) => r.category || "General"))];
  const topics = skills.map((skill) => {
    const skillRows = rows.filter((r) => (r.category || "General") === skill);
    const topicRows = aggregateByKey(skillRows, (r) => r.topic || r.category || "General");
    return {
      skill,
      topics: topicRows.map((t) => ({
        topic: t.name,
        questions: t.questions,
        correct: t.correct,
        wrong: t.wrong,
        accuracy: t.accuracy,
        recommendation: t.recommendation,
      })),
    };
  });

  return {
    available: rows.length > 0,
    skills: topics,
    flat: aggregateByKey(rows, (r) => r.topic || r.category || "General").map((t) => ({
      topic: t.name,
      questions: t.questions,
      correct: t.correct,
      wrong: t.wrong,
      accuracy: t.accuracy,
      recommendation: t.recommendation,
    })),
  };
}

/** GET /analytics/subtopics */
export async function getSubtopicAnalysis(studentId: string, attemptId?: string) {
  const rows = await loadStudentQuestionIntel(studentId, attemptId);
  const items = aggregateByKey(
    rows,
    (r) => `${r.topic || r.category || "General"}::${r.sub_topic || r.question_type || "General"}`
  ).map((t) => {
    const [topic, sub] = t.name.split("::");
    return {
      topic: topic || "General",
      sub_topic: sub || "General",
      accuracy: t.accuracy,
      questions: t.questions,
      correct: t.correct,
      wrong: t.wrong,
      recommended_lesson: {
        title: `Review ${sub || topic}`,
        href: `${PORTAL}/my-learning`,
      },
    };
  });

  return {
    available: items.length > 0,
    message: items.length
      ? undefined
      : "Sub-topic metadata will appear after assessments with tagged questions are published.",
    items,
    attempted_questions: rows.length,
  };
}

/** GET /analytics/difficulty */
export async function getDifficultyAnalysis(studentId: string, attemptId?: string) {
  const rows = await loadStudentQuestionIntel(studentId, attemptId);
  const order = ["Beginner", "Easy", "Intermediate", "Advanced", "Expert", "Unknown"];
  const agg = aggregateByKey(rows, (r) => mapDifficulty(r.difficulty));
  const byName = new Map(agg.map((a) => [a.name, a]));
  const levels = order.map((name) => {
    const a = byName.get(name);
    return {
      difficulty: name,
      questions: a?.questions ?? 0,
      correct: a?.correct ?? 0,
      wrong: a?.wrong ?? 0,
      accuracy: a?.accuracy ?? null,
      performance: a?.performance ?? "Unknown",
      insight:
        a && a.accuracy != null && a.accuracy < 60
          ? `You struggle with ${name} questions — prioritize practice at this level.`
          : a && a.accuracy != null && a.accuracy >= 80
            ? `Strong on ${name} — keep challenging yourself at the next level.`
            : a
              ? `Building consistency on ${name}.`
              : `No ${name} questions in published results yet.`,
    };
  });

  const withData = [...levels].filter((l) => (l.questions || 0) > 0 && l.accuracy != null);
  const weakest = [...withData].sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))[0];
  const strongest = [...withData].sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0))[0];

  // Only call out "struggle" when accuracy is actually weak; otherwise celebrate strength.
  let headline = "Complete assessments to unlock difficulty insights.";
  let weakest_difficulty: string | null = null;
  if (weakest && (weakest.accuracy ?? 100) < 60) {
    headline = `I struggle with ${weakest.difficulty} questions (${weakest.accuracy}% accuracy)`;
    weakest_difficulty = weakest.difficulty;
  } else if (strongest) {
    headline = `Strong on ${strongest.difficulty} questions (${strongest.accuracy}% accuracy) — keep leveling up.`;
    weakest_difficulty = weakest && (weakest.accuracy ?? 100) < 80 ? weakest.difficulty : null;
  }

  return {
    available: rows.length > 0,
    levels,
    headline,
    weakest_difficulty,
  };
}

/** GET /analytics/bloom */
export async function getBloomAnalysis(studentId: string, attemptId?: string) {
  const rows = await loadStudentQuestionIntel(studentId, attemptId);
  const order = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"] as const;
  const agg = aggregateByKey(rows, (r) => r.bloom_level || "Understand");
  const byName = new Map(agg.map((a) => [a.name, a]));
  const tagged = rows.filter((r) => r.bloom_level).length;

  return {
    available: tagged > 0,
    message:
      tagged > 0
        ? undefined
        : "Bloom's Taxonomy levels are not yet tagged on college assessment questions.",
    levels: order.map((name) => {
      const a = byName.get(name);
      return {
        bloom_level: name,
        percentage: a?.accuracy ?? null,
        questions: a?.questions ?? 0,
        performance: a ? a.performance : "N/A",
      };
    }),
  };
}

function getLearningOutcomesFromRows(rows: QuestionIntelRow[]) {
  const bySkill = aggregateByKey(rows, (r) => r.category || "General");
  return bySkill.map((s) => ({
    learning_outcome: `Achieve proficiency in ${s.name}`,
    description: `Answer ${s.name} questions accurately across assessed difficulty levels.`,
    mapped_skill: s.name,
    mapped_topic: s.name,
    status: outcomeStatus(s.accuracy, s.attempted > 0),
    accuracy: s.accuracy,
    recommendation: s.recommendation,
  }));
}

/** GET /analytics/learning-outcomes */
export async function getLearningOutcomes(studentId: string, attemptId?: string) {
  const rows = await loadStudentQuestionIntel(studentId, attemptId);
  const items = getLearningOutcomesFromRows(rows);
  return {
    available: rows.length > 0,
    items,
    summary: {
      achieved: items.filter((i) => i.status === "Achieved").length,
      partially_achieved: items.filter((i) => i.status === "Partially Achieved").length,
      needs_improvement: items.filter((i) => i.status === "Needs Improvement").length,
      not_attempted: items.filter((i) => i.status === "Not Attempted").length,
    },
  };
}

/** GET /analytics/trends */
export async function getTrends(studentId: string) {
  const history = await getHistory(studentId, { status: "completed", limit: 50, page: 1 });
  const chronological = [...history.data].reverse();
  const score_trend = chronological.map((h) => ({
    date: h.completed_at,
    assessment: h.assessment_name,
    percentage: h.percentage,
    attempt_id: h.attempt_id,
  }));

  const skills = await getSkillAnalysis(studentId);
  const readiness = await dashboard.getReadiness(studentId).catch(() => null);

  const first = score_trend[0]?.percentage;
  const last = score_trend[score_trend.length - 1]?.percentage;
  const improvement_pct =
    first != null && last != null && score_trend.length >= 2 ? last - first : null;

  const timeSpent = chronological.reduce((s, h) => s + (h.duration_seconds || 0), 0);

  return {
    score_trend,
    skill_snapshot: skills.skills.slice(0, 8).map((s) => ({
      skill: s.skill_name,
      percentage: s.percentage,
    })),
    readiness_trend: readiness
      ? {
          current: readiness.score,
          previous: readiness.previous_score,
          delta: readiness.trend,
          stages: readiness.stages,
        }
      : null,
    improvement_pct,
    time_spent_seconds: timeSpent,
    assessments_completed: chronological.length,
  };
}

/** GET /analytics/readiness — Module 02 fields + Module 07 enrichment (backward compatible). */
export async function getReadinessAnalytics(studentId: string) {
  const readiness = await dashboard.getReadiness(studentId);
  const skills = await getSkillAnalysis(studentId);
  const trends = await getTrends(studentId);

  return {
    // Module 02 dashboard contract
    score: readiness.score,
    level: readiness.level,
    trend: readiness.trend,
    previous_score: readiness.previous_score,
    stages: readiness.stages,
    // Module 07
    current_readiness: readiness.score,
    previous_readiness: readiness.previous_score,
    improvement: readiness.trend,
    contributing_skills: skills.skills.filter((s) => (s.percentage || 0) >= 70).slice(0, 5),
    weak_skills: skills.skills.filter((s) => (s.percentage || 0) < 60).slice(0, 5),
    readiness_timeline: trends.score_trend.map((t) => ({
      date: t.date,
      label: t.assessment,
      score: t.percentage,
    })),
  };
}

/** GET /analytics/recommendations — consume dashboard + structure for UI */
export async function getRecommendations(studentId: string) {
  const [recs, skills, readiness] = await Promise.all([
    dashboard.getRecommendations(studentId),
    getSkillAnalysis(studentId),
    dashboard.getReadiness(studentId).catch(() => null),
  ]);

  const priorityLabel = (p: number): "High" | "Medium" | "Low" => {
    if (p <= 2) return "High";
    if (p <= 4) return "Medium";
    return "Low";
  };

  const items = (Array.isArray(recs) ? recs : []).map(
    (r: {
      id: string;
      type: string;
      title: string;
      description: string;
      href: string;
      priority: number;
    }) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.description,
      href: r.href,
      priority: priorityLabel(r.priority),
      priority_rank: r.priority,
    })
  );

  const weak = skills.weakest_skill?.name;

  return {
    items,
    panels: {
      recommended_voice_lessons: items.filter((i) => i.type === "course").slice(0, 3),
      recommended_practice_sets: [
        {
          id: "weak-practice",
          title: weak ? `Practice: ${weak}` : "Daily practice",
          description: weak
            ? `Target weak skill ${weak} in Practice Hub.`
            : "Continue daily practice in Practice Hub.",
          href: weak
            ? `${PORTAL}/practice?topic=${encodeURIComponent(weak)}`
            : `${PORTAL}/practice`,
          priority: "High" as const,
        },
        ...items.filter((i) => i.type === "practice").slice(0, 2),
      ],
      recommended_question_library: [
        {
          id: "qb",
          title: "Question Library",
          description: "Browse topics aligned to your weak skills.",
          href: `${PORTAL}/question-bank`,
          priority: "Medium" as const,
        },
      ],
      recommended_next_assessment: items.filter((i) => i.type === "assessment").slice(0, 2),
      recommended_learning_path: items.filter((i) => i.type === "course" || i.type === "interview").slice(0, 3),
      study_plan: {
        readiness: readiness?.score ?? null,
        focus_skill: weak ?? null,
        steps: [
          { label: "Open Learning Hub", href: `${PORTAL}/my-learning`, priority: "High" as const },
          {
            label: "Practice weak topics",
            href: weak
              ? `${PORTAL}/practice?topic=${encodeURIComponent(weak)}`
              : `${PORTAL}/practice`,
            priority: "High" as const,
          },
          { label: "Ask AI Coach", href: `${PORTAL}/placement-coach`, priority: "Medium" as const },
        ],
      },
    },
  };
}

/** Strengths & improvement areas (derived from skill/topic/difficulty aggregates). */
export async function getStrengthsAndGaps(studentId: string, attemptId?: string) {
  const [skills, topics, difficulty, outcomes] = await Promise.all([
    getSkillAnalysis(studentId, attemptId),
    getTopicAnalysis(studentId, attemptId),
    getDifficultyAnalysis(studentId, attemptId),
    getLearningOutcomes(studentId, attemptId),
  ]);

  return {
    strengths: {
      top_skills: skills.skills.filter((s) => (s.percentage || 0) >= 70).slice(0, 5),
      top_topics: topics.flat.filter((t) => (t.accuracy || 0) >= 70).slice(0, 5),
      strong_difficulty_levels: difficulty.levels.filter(
        (l) => (l.accuracy || 0) >= 70 && l.questions > 0
      ),
      learning_outcomes_achieved: outcomes.items.filter((o) => o.status === "Achieved"),
    },
    improvement_areas: {
      weak_skills: skills.skills.filter((s) => (s.percentage || 0) < 60).slice(0, 5),
      weak_topics: topics.flat.filter((t) => t.accuracy != null && t.accuracy < 60).slice(0, 5),
      weak_sub_topics: [] as unknown[],
      weak_difficulty_levels: difficulty.levels.filter(
        (l) => l.accuracy != null && l.accuracy < 60 && l.questions > 0
      ),
      learning_outcomes_not_achieved: outcomes.items.filter(
        (o) => o.status === "Needs Improvement" || o.status === "Not Attempted"
      ),
    },
  };
}

let bookmarkSchema: Promise<void> | null = null;
async function ensureBookmarkSchema() {
  if (!bookmarkSchema) {
    bookmarkSchema = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS student_result_question_bookmarks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          question_id UUID NOT NULL,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, question_id)
        )
      `);
    })().catch((err) => {
      bookmarkSchema = null;
      throw err;
    });
  }
  await bookmarkSchema;
}

/** POST /questions/:id/bookmark */
export async function bookmarkQuestion(
  studentId: string,
  questionId: string,
  meta?: Record<string, unknown>
) {
  if (!questionId?.trim()) throw new AppError("question id is required", 400);
  await ensureBookmarkSchema();
  const row = await queryOne(
    `INSERT INTO student_result_question_bookmarks (user_id, question_id, meta)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id, question_id) DO UPDATE SET meta = EXCLUDED.meta
     RETURNING id, question_id, created_at::text AS created_at`,
    [studentId, questionId.trim(), JSON.stringify(meta || {})]
  );
  return { bookmarked: true, ...row };
}
