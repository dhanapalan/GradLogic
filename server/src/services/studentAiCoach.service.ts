/**
 * Student Portal Module 08 — AI Learning Coach facade.
 *
 * Consume-only: aggregates Learning Intelligence + adaptive + placement +
 * dashboard signals. Does NOT evaluate, score, or invent recommendations.
 * Conversational endpoints stream via AI service with student-scoped context.
 */
import { queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateStream } from "./ai.service.js";
import {
  generateLearningPath,
  getWeakSkills,
  recommendNext,
  type LearningPath,
} from "./adaptive.service.js";
import { getPlacementCoachReport } from "./placementCoach.service.js";
import * as results from "./studentResultsAnalytics.service.js";
import * as dashboard from "./studentDashboard.service.js";
import { converseCompanion } from "./learningCompanion.service.js";

const PORTAL = "/app/student-portal";

export type ChatTurn = { role: "student" | "coach"; text: string };

async function streakFor(studentId: string) {
  const row = await queryOne<{ current_streak: number }>(
    `SELECT current_streak FROM practice_streaks WHERE student_id = $1`,
    [studentId]
  ).catch(() => null);
  return row?.current_streak ?? 0;
}

async function studentGreetingName(studentId: string) {
  const row = await queryOne<{ name: string; first_name: string | null }>(
    `SELECT name, first_name FROM users WHERE id = $1`,
    [studentId]
  ).catch(() => null);
  return row?.first_name || row?.name?.split(/\s+/)[0] || "there";
}

function mapRecPriority(p: string | number): "High" | "Medium" | "Low" {
  if (p === "High" || p === 1 || p === 2) return "High";
  if (p === "Medium" || p === 3 || p === 4) return "Medium";
  return "Low";
}

function liCard(opts: {
  kind: string;
  title: string;
  description?: string;
  href: string;
  skill?: string | null;
  topic?: string | null;
  difficulty?: string | null;
  bloom?: string | null;
  learning_outcome?: string | null;
  estimated_minutes?: number | null;
  priority?: "High" | "Medium" | "Low";
  meta?: Record<string, unknown>;
}) {
  return {
    kind: opts.kind,
    title: opts.title,
    description: opts.description || null,
    href: opts.href,
    learning_intelligence: {
      skill: opts.skill ?? null,
      topic: opts.topic ?? opts.skill ?? null,
      sub_topic: null as string | null,
      difficulty: opts.difficulty ?? null,
      bloom_level: opts.bloom ?? null,
      learning_outcome: opts.learning_outcome ?? null,
      competency_weight: null as number | null,
      estimated_learning_time_minutes: opts.estimated_minutes ?? null,
      prerequisites: [] as string[],
      related_voice_lessons: [] as Array<{ title: string; href: string }>,
      related_practice_sets: [] as Array<{ title: string; href: string }>,
      related_assessments: [] as Array<{ title: string; href: string }>,
      reference_notes: [] as string[],
    },
    priority: opts.priority || "Medium",
    meta: opts.meta || {},
  };
}

/** GET /ai/dashboard */
export async function getDashboard(studentId: string) {
  const name = await studentGreetingName(studentId);
  const [
    readiness,
    performance,
    skills,
    next,
    recs,
    upcoming,
    streak,
    history,
  ] = await Promise.all([
    results.getReadinessAnalytics(studentId).catch(() => null),
    results.getPerformanceOverview(studentId).catch(() => null),
    results.getSkillAnalysis(studentId).catch(() => null),
    recommendNext(studentId).catch(() => null),
    results.getRecommendations(studentId).catch(() => null),
    dashboard.getUpcomingAssessments(studentId, 3).catch(() => []),
    streakFor(studentId),
    results.getHistory(studentId, { status: "completed", limit: 5, page: 1 }).catch(() => ({
      data: [],
    })),
  ]);

  const weak = skills?.weakest_skill || null;
  const strong = skills?.strongest_skill || null;
  const todayGoal = weak
    ? `Improve ${weak.name} with a voice lesson + short practice set`
    : "Complete today's practice and review one weak topic";

  const recentImprovement =
    readiness?.improvement != null
      ? readiness.improvement
      : performance && "overall_performance_score" in (performance as object)
        ? null
        : null;

  return {
    greeting: `Hi ${name} — ready to learn?`,
    todays_goal: todayGoal,
    placement_readiness: readiness
      ? {
          score: readiness.current_readiness ?? readiness.score,
          level: readiness.level,
          previous: readiness.previous_readiness ?? readiness.previous_score,
          improvement: readiness.improvement ?? readiness.trend,
        }
      : null,
    learning_progress: {
      overall_score: performance?.overall_performance_score ?? null,
      category: performance?.performance_category ?? null,
      outcomes_achieved: performance?.learning_outcomes_achieved ?? 0,
      outcomes_total: performance?.learning_outcomes_total ?? 0,
      assessments_completed: performance?.assessments_completed ?? 0,
    },
    todays_recommendations: (recs?.items || []).slice(0, 5).map((r) =>
      liCard({
        kind: r.type,
        title: r.title,
        description: r.description,
        href: r.href,
        priority: mapRecPriority(r.priority),
        skill: weak?.name,
      })
    ),
    pending_practice: next
      ? liCard({
          kind: "practice",
          title: `Practice ${next.weakestSkill.category.replace(/_/g, " ")}`,
          description: `Difficulty ${next.recommendedDifficulty} · ~${next.estimatedLearningTimeMinutes} min`,
          href: `${PORTAL}/practice?topic=${encodeURIComponent(next.weakestSkill.category)}&difficulty=${next.recommendedDifficulty}`,
          skill: next.weakestSkill.category,
          difficulty: next.recommendedDifficulty,
          estimated_minutes: next.estimatedLearningTimeMinutes,
          priority: "High",
        })
      : null,
    upcoming_assessments: (upcoming || []).slice(0, 3),
    weakest_skill: weak,
    strongest_skill: strong,
    recent_improvement: recentImprovement,
    current_streak: streak,
    estimated_study_minutes: next?.estimatedLearningTimeMinutes ?? null,
    recent_results: history.data.slice(0, 3),
    quick_actions: {
      continue_learning: `${PORTAL}/my-learning`,
      practice_weak: weak
        ? `${PORTAL}/practice?topic=${encodeURIComponent(weak.name)}`
        : `${PORTAL}/practice`,
      explain_last_assessment: history.data[0]
        ? `${PORTAL}/results/report/${history.data[0].attempt_id}`
        : `${PORTAL}/results`,
      ask_ai: `${PORTAL}/placement-coach?tab=ask`,
      results: `${PORTAL}/results`,
    },
  };
}

/** GET /ai/recommendations */
export async function getRecommendations(studentId: string) {
  const [recs, next, path] = await Promise.all([
    results.getRecommendations(studentId),
    recommendNext(studentId).catch(() => null),
    generateLearningPath(studentId, 3).catch(() => null),
  ]);

  const voiceLessons = [] as ReturnType<typeof liCard>[];
  const lessonHref = (lessonId: string, moduleType: string | null | undefined) =>
    moduleType === "voice_lesson"
      ? `${PORTAL}/my-learning`
      : `${PORTAL}/adaptive-learning`;

  if (next?.nextLesson) {
    voiceLessons.push(
      liCard({
        kind: "voice_lesson",
        title: next.nextLesson.title,
        description: "Recommended voice lesson for your weakest skill",
        href: lessonHref(next.nextLesson.id, next.nextLesson.moduleType),
        skill: next.weakestSkill.category,
        difficulty: next.nextLesson.difficulty,
        estimated_minutes: next.nextLesson.durationMinutes,
        priority: "High",
      })
    );
  }
  for (const step of path?.steps || []) {
    if (step.lesson) {
      voiceLessons.push(
        liCard({
          kind: "voice_lesson",
          title: step.lesson.title,
          href: lessonHref(step.lesson.id, step.lesson.moduleType),
          skill: step.category,
          difficulty: step.difficulty,
          estimated_minutes: step.lesson.durationMinutes,
        })
      );
    }
  }

  return {
    voice_lessons: voiceLessons.slice(0, 5),
    reading_notes: (recs.panels.recommended_learning_path || []).map((r) =>
      liCard({
        kind: "notes",
        title: r.title,
        description: r.description,
        href: r.href,
        priority: mapRecPriority(r.priority),
      })
    ),
    practice_sets: (recs.panels.recommended_practice_sets || []).map((r) =>
      liCard({
        kind: "practice_set",
        title: r.title,
        description: r.description,
        href: r.href,
        priority: mapRecPriority(r.priority),
      })
    ),
    question_library: (recs.panels.recommended_question_library || []).map((r) =>
      liCard({
        kind: "question_library",
        title: r.title,
        description: r.description,
        href: r.href,
        priority: mapRecPriority(r.priority),
      })
    ),
    mini_quiz: next?.nextQuestion
      ? [
          liCard({
            kind: "mini_quiz",
            title: "Mini practice quiz",
            description: String(next.nextQuestion.question_text || "").slice(0, 120),
            href: `${PORTAL}/practice?topic=${encodeURIComponent(next.weakestSkill.category)}`,
            skill: next.weakestSkill.category,
            difficulty: next.recommendedDifficulty,
            estimated_minutes: 15,
            priority: "Medium",
          }),
        ]
      : [],
    assessments: (recs.panels.recommended_next_assessment || []).map((r) =>
      liCard({
        kind: "assessment",
        title: r.title,
        description: r.description,
        href: r.href,
        priority: mapRecPriority(r.priority),
      })
    ),
    study_plan: recs.panels.study_plan,
    items: recs.items,
  };
}

/** GET /ai/practice-recommendations */
export async function getPracticeRecommendations(studentId: string) {
  const [next, path, skills] = await Promise.all([
    recommendNext(studentId).catch(() => null),
    generateLearningPath(studentId, 4).catch(() => ({ steps: [], totalEstimatedMinutes: 0 })),
    results.getSkillAnalysis(studentId).catch(() => null),
  ]);
  const topic = next?.weakestSkill?.category || skills?.weakest_skill?.name || "general";
  const weakName = String(topic).replace(/_/g, " ");
  const difficulty = next?.recommendedDifficulty || "easy";

  const cards = [
    liCard({
      kind: "weak_topic_practice",
      title: `Weak topic: ${weakName}`,
      description: next
        ? `Accuracy ${Math.round(next.weakestSkill.accuracy * 100)}% · expected improvement with focused drills`
        : "Start practice to unlock personalized weak-topic drills",
      href: `${PORTAL}/practice?topic=${encodeURIComponent(topic)}&difficulty=${difficulty}`,
      skill: topic,
      difficulty,
      estimated_minutes: next?.estimatedLearningTimeMinutes ?? 20,
      priority: "High",
      meta: {
        questions_count: 10,
        expected_improvement: "Raise accuracy toward 70%+",
        mode: "weak_topic",
      },
    }),
    liCard({
      kind: "topic_practice",
      title: `Topic practice: ${weakName}`,
      href: `${PORTAL}/practice?topic=${encodeURIComponent(topic)}`,
      skill: topic,
      difficulty,
      estimated_minutes: 20,
      meta: { questions_count: 8, mode: "topic" },
    }),
    liCard({
      kind: "timed_practice",
      title: "Timed practice",
      description: "Build speed under exam-like conditions",
      href: `${PORTAL}/practice`,
      skill: topic,
      difficulty: "medium",
      estimated_minutes: 25,
      meta: { questions_count: 12, mode: "timed" },
    }),
    liCard({
      kind: "revision_practice",
      title: "Revision practice",
      description: "Revisit recently missed topics",
      href: `${PORTAL}/question-bank`,
      skill: skills?.weakest_skill?.name,
      estimated_minutes: 15,
      meta: { questions_count: 6, mode: "revision" },
    }),
    liCard({
      kind: "daily_practice",
      title: "Daily practice",
      description: "Keep your streak and placement readiness moving",
      href: `${PORTAL}/practice`,
      estimated_minutes: 15,
      priority: "Medium",
      meta: { questions_count: 5, mode: "daily" },
    }),
  ];

  return {
    recommendations: cards,
    path_preview: (path.steps || []).slice(0, 3).map((s) => ({
      skill: s.category,
      difficulty: s.difficulty,
      estimated_minutes: s.estimatedMinutes,
      questions_count: s.practiceQuestions.length,
      lesson: s.lesson,
    })),
  };
}

/** GET /ai/study-plan */
export async function getStudyPlan(studentId: string) {
  const path = await generateLearningPath(studentId, 5);
  return shapeStudyPlan(path);
}

/** POST /ai/generate-study-plan — same engine, optional max_steps */
export async function generateStudyPlan(studentId: string, maxSteps = 5) {
  const path = await generateLearningPath(studentId, Math.min(8, Math.max(1, maxSteps)));
  return shapeStudyPlan(path);
}

function shapeStudyPlan(path: LearningPath) {
  const daily = path.steps.slice(0, 1).flatMap((step) => {
    const items: Array<{ order: number; type: string; title: string; href: string; minutes: number }> =
      [];
    let order = 1;
    if (step.lesson) {
      items.push({
        order: order++,
        type: "voice_lesson",
        title: step.lesson.title,
        href: `${PORTAL}/adaptive-learning`,
        minutes: step.lesson.durationMinutes || 15,
      });
    }
    items.push({
      order: order++,
      type: "practice_set",
      title: `Practice ${step.category.replace(/_/g, " ")}`,
      href: `${PORTAL}/practice?topic=${encodeURIComponent(step.category)}&difficulty=${step.difficulty}`,
      minutes: Math.max(10, step.estimatedMinutes - (step.lesson?.durationMinutes || 0)),
    });
    items.push({
      order: order++,
      type: "mini_quiz",
      title: "Mini quiz",
      href: `${PORTAL}/practice?topic=${encodeURIComponent(step.category)}`,
      minutes: 10,
    });
    items.push({
      order: order++,
      type: "assessment",
      title: "Check My Assessments",
      href: `${PORTAL}/my-assessments`,
      minutes: 5,
    });
    return items;
  });

  const weekly = path.steps.map((step, i) => ({
    day: i + 1,
    skill: step.category,
    difficulty: step.difficulty,
    estimated_minutes: step.estimatedMinutes,
    voice_lesson: step.lesson
      ? { title: step.lesson.title, href: `${PORTAL}/adaptive-learning` }
      : null,
    practice: {
      title: `Practice ${step.category.replace(/_/g, " ")}`,
      href: `${PORTAL}/practice?topic=${encodeURIComponent(step.category)}`,
      questions_count: step.practiceQuestions.length,
    },
  }));

  return {
    daily_plan: {
      steps: daily,
      estimated_minutes: daily.reduce((s, d) => s + d.minutes, 0) || path.totalEstimatedMinutes,
    },
    weekly_plan: {
      days: weekly,
      total_estimated_minutes: path.totalEstimatedMinutes,
    },
    assessment_prep_plan: {
      focus_skills: path.steps.map((s) => s.category),
      sequence: ["Voice Lesson", "Practice Set", "Mini Quiz", "Assessment"],
      hrefs: {
        learning: `${PORTAL}/my-learning`,
        practice: `${PORTAL}/practice`,
        assessments: `${PORTAL}/my-assessments`,
        results: `${PORTAL}/results`,
      },
    },
    engine_path: path,
  };
}

/** GET /ai/learning-path */
export async function getLearningPath(studentId: string) {
  const path = await generateLearningPath(studentId, 5);
  return {
    ...path,
    steps: path.steps.map((s) => ({
      ...s,
      learning_intelligence: {
        skill: s.category,
        topic: s.category,
        sub_topic: null,
        difficulty: s.difficulty,
        bloom_level: null,
        learning_outcome: `Improve accuracy in ${s.category.replace(/_/g, " ")}`,
        estimated_learning_time_minutes: s.estimatedMinutes,
        related_voice_lessons: s.lesson
          ? [{ title: s.lesson.title, href: `${PORTAL}/adaptive-learning` }]
          : [],
        related_practice_sets: [
          {
            title: `Practice ${s.category.replace(/_/g, " ")}`,
            href: `${PORTAL}/practice?topic=${encodeURIComponent(s.category)}`,
          },
        ],
      },
    })),
  };
}

/** GET /ai/weak-areas */
export async function getWeakAreas(studentId: string) {
  const [gaps, adaptiveWeak, next] = await Promise.all([
    results.getStrengthsAndGaps(studentId),
    getWeakSkills(studentId, 8),
    recommendNext(studentId).catch(() => null),
  ]);

  const areas = (gaps.improvement_areas.weak_skills || []).map((s) => ({
    skill: s.skill_name,
    topic: s.skill_name,
    sub_topic: null as string | null,
    percentage: s.percentage,
    performance: s.performance,
    recommended_lesson: next?.nextLesson
      ? {
          title: next.nextLesson.title,
          href: `${PORTAL}/adaptive-learning`,
          estimated_minutes: next.nextLesson.durationMinutes,
        }
      : {
          title: `Voice lesson: ${s.skill_name}`,
          href: `${PORTAL}/my-learning`,
          estimated_minutes: 20,
        },
    recommended_practice: {
      title: `Practice ${s.skill_name}`,
      href: `${PORTAL}/practice?topic=${encodeURIComponent(s.skill_name)}`,
      estimated_minutes: 20,
    },
    estimated_improvement: "Target +10–15% accuracy with lesson → practice loop",
  }));

  return {
    weak_skills: areas,
    weak_topics: gaps.improvement_areas.weak_topics,
    weak_sub_topics: gaps.improvement_areas.weak_sub_topics,
    weak_difficulty_levels: gaps.improvement_areas.weak_difficulty_levels,
    learning_outcomes_not_achieved: gaps.improvement_areas.learning_outcomes_not_achieved,
    adaptive_weak_skills: adaptiveWeak.map((w) => ({
      category: w.category,
      accuracy: Math.round(w.accuracy * 100),
      attempts: w.attempts,
    })),
  };
}

/** GET /ai/progress */
export async function getProgress(studentId: string) {
  const [skills, trends, readiness, performance, streak] = await Promise.all([
    results.getSkillAnalysis(studentId),
    results.getTrends(studentId),
    results.getReadinessAnalytics(studentId),
    results.getPerformanceOverview(studentId),
    streakFor(studentId),
  ]);

  const improved = (skills.skills || []).filter((s) => (s.percentage || 0) >= 70);

  return {
    skills_improved: improved.slice(0, 6).map((s) => ({
      skill: s.skill_name,
      percentage: s.percentage,
    })),
    topics_completed: trends.assessments_completed,
    practice_accuracy: null as number | null,
    assessment_trend: trends.score_trend,
    learning_hours: Math.round((trends.time_spent_seconds || 0) / 3600 * 10) / 10,
    learning_velocity:
      trends.assessments_completed > 0
        ? Math.round((trends.improvement_pct || 0) / Math.max(1, trends.assessments_completed))
        : null,
    current_readiness: readiness.current_readiness ?? readiness.score,
    readiness_level: readiness.level,
    overall_performance: performance.overall_performance_score,
    current_streak: streak,
    time_spent_seconds: trends.time_spent_seconds,
  };
}

/** Build Learning Coach system prompt with LI context (chat only — not recommendation generation). */
async function buildCoachContext(studentId: string) {
  const [skills, weak, readiness, performance] = await Promise.all([
    results.getSkillAnalysis(studentId).catch(() => null),
    getWeakSkills(studentId, 5).catch(() => []),
    results.getReadinessAnalytics(studentId).catch(() => null),
    results.getPerformanceOverview(studentId).catch(() => null),
  ]);

  return {
    strongest: skills?.strongest_skill?.name || null,
    weakest: skills?.weakest_skill?.name || null,
    weakLabels: (weak || []).map((w) => `${w.category.replace(/_/g, " ")} (${Math.round(w.accuracy * 100)}%)`),
    readiness: readiness?.current_readiness ?? readiness?.score ?? null,
    readinessLevel: readiness?.level ?? null,
    overall: performance?.overall_performance_score ?? null,
    skillLines: (skills?.skills || [])
      .slice(0, 8)
      .map((s) => `${s.skill_name}: ${s.percentage}% (${s.performance})`),
  };
}

function learningCoachSystem(ctx: Awaited<ReturnType<typeof buildCoachContext>>) {
  return [
    "You are the Gradlogic AI Learning Coach — not a generic chatbot.",
    "Your primary job: help the student decide what to learn and practice next to improve.",
    "Always reason with Learning Intelligence metadata: Skill, Topic, Sub Topic, Difficulty, Bloom's Taxonomy, Learning Outcome.",
    "Prioritize the journey: Voice Lesson → Practice → Assessment → Review results.",
    "Do NOT invent assessment scores, ranks, or evaluation outcomes. Use only the student context provided.",
    "Do NOT claim access to other students' data.",
    "Prefer concise, actionable answers. Markdown and fenced code blocks are allowed when helpful.",
    "When recommending next steps, point to Learning Hub, Practice Hub, Results, or My Assessments conceptually — never fabricate URLs with fake IDs.",
    "",
    `Placement readiness: ${ctx.readiness ?? "unknown"}${ctx.readinessLevel ? ` (${ctx.readinessLevel})` : ""}`,
    `Overall performance: ${ctx.overall ?? "unknown"}`,
    `Strongest skill: ${ctx.strongest ?? "unknown"}`,
    `Weakest skill: ${ctx.weakest ?? "unknown"}`,
    ctx.weakLabels.length ? `Weak areas: ${ctx.weakLabels.join("; ")}` : "",
    ctx.skillLines.length ? `Skill snapshot:\n${ctx.skillLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Deterministic LI reply when the LLM provider is unavailable. */
function buildOfflineCoachReply(ctx: Awaited<ReturnType<typeof buildCoachContext>>, message: string) {
  const weak = ctx.weakest || ctx.weakLabels[0]?.split(" (")[0] || "your weakest skill";
  const strong = ctx.strongest || "your stronger areas";
  const readiness =
    ctx.readiness != null ? `${ctx.readiness}%${ctx.readinessLevel ? ` (${ctx.readinessLevel})` : ""}` : "not yet scored";
  const overall = ctx.overall != null ? `${ctx.overall}%` : "not enough assessments yet";

  return [
    "Here's a Learning Intelligence plan based on your latest results (offline coach mode — LLM provider unavailable):",
    "",
    `• Placement readiness: ${readiness}`,
    `• Overall assessment performance: ${overall}`,
    `• Strongest skill: ${strong}`,
    `• Focus next: ${weak}`,
    "",
    "Recommended journey:",
    `1. Open Learning Hub and complete a voice/notes lesson related to ${weak}.`,
    `2. Practice Hub → weak-topic drills for ${weak} (start Easy/Intermediate).`,
    "3. Return to My Assessments when a campaign is live to reassess.",
    "4. Review Results for skill / topic / difficulty breakdowns after publish.",
    "",
    `You asked: "${message.slice(0, 240)}"`,
    "",
    "I will use live generative coaching again once the AI provider key is configured.",
  ].join("\n");
}

function streamTextChunks(text: string, onDelta: (chunk: string) => void) {
  // Small chunks so the UI streaming path still works offline.
  const size = 48;
  for (let i = 0; i < text.length; i += size) {
    onDelta(text.slice(i, i + size));
  }
}

/** Shared streaming coach reply */
export async function streamCoachReply(
  studentId: string,
  message: string,
  history: ChatTurn[],
  onDelta: (chunk: string) => void
) {
  const ctx = await buildCoachContext(studentId);
  const system = learningCoachSystem(ctx);
  const trimmed = history.slice(-8);
  const historyBlock = trimmed.length
    ? `Conversation so far:\n${trimmed.map((t) => `${t.role === "student" ? "Student" : "Coach"}: ${t.text}`).join("\n")}\n\n`
    : "";
  const userPrompt = `${historyBlock}Student: ${message}\n\nRespond as the AI Learning Coach.`;

  try {
    const result = await generateStream(userPrompt, onDelta, {
      system,
      maxTokens: 900,
      riskLevel: "practice",
    });
    return { text: result.text, requiresReview: result.requiresReview, offline: false as const };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const providerDown =
      /x-api-key|authentication_error|ANTHROPIC|not configured|401|API key/i.test(msg);
    if (!providerDown) throw err;
    const text = buildOfflineCoachReply(ctx, message);
    streamTextChunks(text, onDelta);
    return { text, requiresReview: false, offline: true as const };
  }
}

/** POST /ai/explain-result */
export async function explainResultContext(studentId: string, attemptId: string) {
  if (!attemptId?.trim()) throw new AppError("attempt_id is required", 400);
  const [summary, skills, topics, difficulty, bloom, outcomes, gaps] = await Promise.all([
    results.getAttemptSummary(studentId, attemptId),
    results.getSkillAnalysis(studentId, attemptId),
    results.getTopicAnalysis(studentId, attemptId),
    results.getDifficultyAnalysis(studentId, attemptId),
    results.getBloomAnalysis(studentId, attemptId),
    results.getLearningOutcomes(studentId, attemptId),
    results.getStrengthsAndGaps(studentId, attemptId),
  ]);

  const weakSkills = gaps.improvement_areas.weak_skills || [];
  const narrativeParts = [
    `Assessment "${summary.assessment_name}" scored ${summary.percentage}% (grade ${summary.grade || "—"}, ${summary.pass_fail}).`,
  ];
  if (weakSkills.length) {
    const top = weakSkills[0];
    narrativeParts.push(
      `Score was reduced mainly by weaker performance in ${top.skill_name} (${top.percentage}%).`
    );
  }
  if (difficulty.weakest_difficulty) {
    narrativeParts.push(difficulty.headline);
  }

  return {
    attempt_id: attemptId,
    overall_summary: {
      percentage: summary.percentage,
      grade: summary.grade,
      pass_fail: summary.pass_fail,
      performance_category: summary.performance_category,
      assessment_name: summary.assessment_name,
      campaign_name: summary.campaign_name,
    },
    strengths: gaps.strengths,
    weak_areas: gaps.improvement_areas,
    skill_analysis: skills.skills,
    topic_analysis: topics.flat,
    difficulty_analysis: difficulty.levels,
    bloom_analysis: bloom.levels,
    learning_outcomes: outcomes.items,
    ai_prompt_context: narrativeParts.join(" "),
    continue_learning: summary.continue_learning,
  };
}

/** Stream explanation for a result (uses LI context in the prompt). */
export async function streamExplainResult(
  studentId: string,
  attemptId: string,
  history: ChatTurn[],
  onDelta: (chunk: string) => void,
  extraMessage?: string
) {
  const pack = await explainResultContext(studentId, attemptId);
  const message = [
    "Explain my assessment results using Learning Intelligence metadata.",
    pack.ai_prompt_context,
    `Strengths: ${(pack.strengths.top_skills || []).map((s) => s.skill_name).join(", ") || "n/a"}`,
    `Weak areas: ${(pack.weak_areas.weak_skills || []).map((s) => `${s.skill_name} ${s.percentage}%`).join(", ") || "n/a"}`,
    `Topics: ${(pack.topic_analysis || [])
      .slice(0, 6)
      .map((t) => `${t.topic} ${t.accuracy ?? "—"}%`)
      .join("; ")}`,
    extraMessage ? `Student follow-up: ${extraMessage}` : "",
    "Explain why the score looks this way and what voice lesson → practice → assessment loop to follow next.",
  ]
    .filter(Boolean)
    .join("\n");

  const streamed = await streamCoachReply(studentId, message, history, onDelta);
  return { ...streamed, context: pack };
}

/** POST /ai/explain-question */
export async function streamExplainQuestion(
  studentId: string,
  body: {
    question_id?: string;
    learning_object_id?: string;
    question?: string;
    student_answer?: string | string[];
    correct_answer?: string | string[];
    skill?: string;
    topic?: string;
    difficulty?: string;
    bloom_level?: string;
    learning_outcome?: string;
    mode?: "explain" | "simplify" | "example" | "again";
    history?: ChatTurn[];
  },
  onDelta: (chunk: string) => void
) {
  const history = body.history || [];
  const learningObjectId = body.learning_object_id || undefined;

  // Practice knowledge objects → Learning Companion explain action
  if (learningObjectId) {
    const action =
      body.mode === "simplify"
        ? "explain"
        : body.mode === "example"
          ? "example"
          : body.mode === "again"
            ? "explain"
            : "explain";
    const companionHistory = history.map((t) => ({
      role: t.role === "coach" ? ("companion" as const) : ("student" as const),
      text: t.text,
    }));
    try {
      const result = await converseCompanion(
        {
          learningObjectId,
          action: action as "explain" | "example",
          message:
            body.mode === "simplify"
              ? "Simplify the explanation for a beginner."
              : body.mode === "again"
                ? "Explain again with a different angle."
                : body.question,
          language: "en",
          history: companionHistory,
        },
        onDelta
      );
      return { text: result.text, requiresReview: result.requiresReview, source: "learning_companion" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!/x-api-key|authentication_error|ANTHROPIC|not configured|401|API key/i.test(msg)) throw err;
      // Fall through to LI-context coach (with offline fallback)
    }
  }

  const modeHint =
    body.mode === "simplify"
      ? "Simplify for a beginner."
      : body.mode === "example"
        ? "Show a concrete worked example."
        : body.mode === "again"
          ? "Explain again with a fresh angle."
          : "Explain clearly.";

  const message = [
    "Explain this wrong / reviewed question using Learning Intelligence metadata.",
    modeHint,
    body.question ? `Question: ${body.question}` : "",
    body.student_answer
      ? `Student answer: ${Array.isArray(body.student_answer) ? body.student_answer.join(", ") : body.student_answer}`
      : "",
    body.correct_answer
      ? `Correct answer: ${Array.isArray(body.correct_answer) ? body.correct_answer.join(", ") : body.correct_answer}`
      : "",
    `Skill: ${body.skill || "unknown"}`,
    `Topic: ${body.topic || body.skill || "unknown"}`,
    `Difficulty: ${body.difficulty || "unknown"}`,
    `Bloom: ${body.bloom_level || "N/A"}`,
    `Learning outcome: ${body.learning_outcome || "N/A"}`,
    "Cover: why incorrect, correct explanation, common mistake, key concept, and what to practice next (voice lesson → practice).",
  ]
    .filter(Boolean)
    .join("\n");

  const streamed = await streamCoachReply(studentId, message, history, onDelta);
  return { ...streamed, source: "learning_coach" };
}

/** Placement report passthrough for future Interview/Resume coach tabs */
export async function getPlacementCapability(studentId: string, company?: string, role?: string) {
  return getPlacementCoachReport(studentId, company, role);
}
