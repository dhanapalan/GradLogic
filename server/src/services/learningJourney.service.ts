/**
 * AI Learning Journey — personalized placement-ready roadmaps.
 * Templates = learning_paths; instances = student_journeys.
 * AI Learning Companion personalizes; content references Catalog / Builder / KL only.
 */
import { query, queryOne } from "../config/database.js";

export const PHASE1_JOURNEY_DOMAINS = [
  {
    value: "aptitude",
    label: "Aptitude",
    title: "Aptitude Placement Track",
    description:
      "Quantitative aptitude roadmap from foundations to placement-speed practice.",
    difficulty: "beginner",
    duration_days: 28,
    estimated_hours: 40,
    objectives: [
      "Master percentages, ratios, and DI",
      "Build speed for campus aptitude papers",
      "Reach placement-ready aptitude score",
    ],
    target_role: "software_engineer",
    bankCategory: "aptitude",
  },
  {
    value: "reasoning",
    label: "Logical Reasoning",
    title: "Logical Reasoning Track",
    description: "Series, syllogisms, puzzles, and analytical reasoning for placement papers.",
    difficulty: "beginner",
    duration_days: 28,
    estimated_hours: 36,
    objectives: [
      "Complete reasoning foundations",
      "Solve timed placement-style sets",
      "Sustain accuracy above 70%",
    ],
    target_role: "software_engineer",
    bankCategory: "reasoning",
  },
  {
    value: "python_coding",
    label: "Python",
    title: "Python Placement Track",
    description: "Python programming path from basics through OOP and coding drills.",
    difficulty: "beginner",
    duration_days: 42,
    estimated_hours: 60,
    objectives: [
      "Complete Python basics",
      "Solve placement coding challenges",
      "Demonstrate OOP fluency",
    ],
    target_role: "software_engineer",
    bankCategory: "python_coding",
  },
  {
    value: "java_coding",
    label: "Java",
    title: "Java Placement Track",
    description: "Java fundamentals, collections, and interview-ready coding practice.",
    difficulty: "beginner",
    duration_days: 42,
    estimated_hours: 60,
    objectives: [
      "Complete Java basics",
      "Master collections",
      "Solve placement coding challenges",
    ],
    target_role: "software_engineer",
    bankCategory: "java_coding",
  },
  {
    value: "ai_fundamentals",
    label: "AI Fundamentals",
    title: "AI Fundamentals Track",
    description: "Artificial Intelligence fundamentals for fresher placement readiness.",
    difficulty: "beginner",
    duration_days: 35,
    estimated_hours: 45,
    objectives: [
      "Understand AI concepts",
      "Map AI to career skills",
      "Complete AI fundamentals assessments",
    ],
    target_role: "data_analyst",
    bankCategory: "data_science",
  },
] as const;

export type JourneyDomain = (typeof PHASE1_JOURNEY_DOMAINS)[number]["value"];

const DEFAULT_WEIGHTS = {
  course_completion: 0.25,
  assessment_scores: 0.2,
  coding_performance: 0.2,
  mock_test_performance: 0.15,
  skill_mastery: 0.1,
  consistency: 0.1,
};

export async function seedPhase1Templates(createdBy?: string | null) {
  const created: string[] = [];
  for (const d of PHASE1_JOURNEY_DOMAINS) {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM learning_paths WHERE domain = $1 LIMIT 1`,
      [d.value]
    );
    if (existing) continue;

    const row = await queryOne<{ id: string }>(
      `INSERT INTO learning_paths (
         title, description, domain, difficulty, duration_days, estimated_hours,
         status, objectives, target_role, revision_intervals_days, readiness_weights, created_by
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'published', $7::jsonb, $8,
         ARRAY[1,7,30]::int[], $9::jsonb, $10
       )
       RETURNING id`,
      [
        d.title,
        d.description,
        d.value,
        d.difficulty,
        d.duration_days,
        d.estimated_hours,
        JSON.stringify(d.objectives),
        d.target_role,
        JSON.stringify(DEFAULT_WEIGHTS),
        createdBy || null,
      ]
    );
    if (row?.id) created.push(row.id);
  }
  return { created_count: created.length, created_ids: created };
}

export async function listJourneyTemplates(filters?: {
  domain?: string;
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(filters?.limit ?? 48, 100);
  const offset = filters?.offset ?? 0;
  const params: unknown[] = [];
  const where: string[] = ["1=1"];

  if (filters?.domain) {
    params.push(filters.domain);
    where.push(`lp.domain = $${params.length}`);
  }
  if (filters?.status && filters.status !== "all") {
    params.push(filters.status);
    where.push(`lp.status = $${params.length}`);
  }
  if (filters?.search?.trim()) {
    params.push(filters.search.trim());
    where.push(
      `(lp.title ILIKE '%' || $${params.length} || '%' OR lp.description ILIKE '%' || $${params.length} || '%')`
    );
  }

  params.push(limit);
  const limIdx = params.length;
  params.push(offset);
  const offIdx = params.length;

  const rows = await query(
    `SELECT lp.id, lp.title, lp.description, lp.domain, lp.difficulty, lp.status,
        lp.duration_days, lp.estimated_hours, lp.objectives, lp.target_role,
        lp.revision_intervals_days, lp.readiness_weights, lp.updated_at, lp.created_at,
        (SELECT COUNT(*)::int FROM learning_path_courses lpc WHERE lpc.path_id = lp.id) AS course_count,
        (SELECT COUNT(*)::int FROM student_journeys sj WHERE sj.template_id = lp.id) AS student_count,
        u.name AS created_by_name
     FROM learning_paths lp
     LEFT JOIN users u ON u.id = lp.created_by
     WHERE ${where.join(" AND ")}
     ORDER BY
       CASE lp.domain
         WHEN 'aptitude' THEN 1
         WHEN 'reasoning' THEN 2
         WHEN 'python_coding' THEN 3
         WHEN 'java_coding' THEN 4
         WHEN 'ai_fundamentals' THEN 5
         ELSE 99
       END,
       lp.updated_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    params
  );

  const countParams = params.slice(0, -2);
  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM learning_paths lp WHERE ${where.join(" AND ")}`,
    countParams
  );

  return {
    templates: rows,
    total: Number(countRow?.total) || 0,
    limit,
    offset,
    domains: PHASE1_JOURNEY_DOMAINS.map((d) => ({ value: d.value, label: d.label })),
  };
}

export async function getJourneyDashboard() {
  const templateStats = await queryOne<{
    total: string;
    published: string;
  }>(
    `SELECT COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE status = 'published')::text AS published
     FROM learning_paths`
  );

  let journeyStats = {
    active: 0,
    completed: 0,
    studentsInProgress: 0,
    avgCompletion: null as number | null,
    avgReadiness: null as number | null,
  };

  try {
    const row = await queryOne<{
      active: string;
      completed: string;
      students_in_progress: string;
      avg_completion: string | null;
      avg_readiness: string | null;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('not_started','in_progress','paused'))::text AS active,
        COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'in_progress')::text AS students_in_progress,
        ROUND(AVG(progress_percent) FILTER (WHERE status IN ('in_progress','completed','paused')))::text AS avg_completion,
        ROUND(AVG(placement_readiness) FILTER (WHERE status IN ('in_progress','completed','paused')))::text AS avg_readiness
      FROM student_journeys
      WHERE status <> 'archived'
    `);
    journeyStats = {
      active: Number(row?.active) || 0,
      completed: Number(row?.completed) || 0,
      studentsInProgress: Number(row?.students_in_progress) || 0,
      avgCompletion: row?.avg_completion != null ? Number(row.avg_completion) : null,
      avgReadiness: row?.avg_readiness != null ? Number(row.avg_readiness) : null,
    };
  } catch {
    // Table may not exist before migration — keep zeros
  }

  // Inc 1 placeholders until daily plans / mocks / reviews land
  const todaysTasks = 0;
  const upcomingMockTests = 0;
  const pendingReviews = 0;

  let progressByDomain: Array<{ domain: string; label: string; avg_progress: number; count: number }> =
    [];
  let readinessTrend: Array<{ bucket: string; avg_readiness: number; count: number }> = [];
  let skillMastery: Array<{ domain: string; label: string; avg_readiness: number }> = [];
  let dailyCompletion: Array<{ day: string; completed: number }> = [];

  try {
    progressByDomain = (
      await query<{ domain: string; avg_progress: string; count: string }>(`
        SELECT COALESCE(lp.domain, 'unknown') AS domain,
               ROUND(AVG(sj.progress_percent))::text AS avg_progress,
               COUNT(*)::text AS count
        FROM student_journeys sj
        JOIN learning_paths lp ON lp.id = sj.template_id
        WHERE sj.status <> 'archived'
        GROUP BY lp.domain
        ORDER BY lp.domain
      `)
    ).map((r) => ({
      domain: r.domain,
      label: PHASE1_JOURNEY_DOMAINS.find((d) => d.value === r.domain)?.label || r.domain,
      avg_progress: Number(r.avg_progress) || 0,
      count: Number(r.count) || 0,
    }));

    readinessTrend = (
      await query<{ bucket: string; avg_readiness: string; count: string }>(`
        SELECT
          CASE
            WHEN placement_readiness < 40 THEN '0-39'
            WHEN placement_readiness < 60 THEN '40-59'
            WHEN placement_readiness < 80 THEN '60-79'
            ELSE '80-100'
          END AS bucket,
          ROUND(AVG(placement_readiness))::text AS avg_readiness,
          COUNT(*)::text AS count
        FROM student_journeys
        WHERE status <> 'archived'
        GROUP BY 1
        ORDER BY 1
      `)
    ).map((r) => ({
      bucket: r.bucket,
      avg_readiness: Number(r.avg_readiness) || 0,
      count: Number(r.count) || 0,
    }));

    skillMastery = (
      await query<{ domain: string; avg_readiness: string }>(`
        SELECT COALESCE(lp.domain, 'unknown') AS domain,
               ROUND(AVG(sj.placement_readiness))::text AS avg_readiness
        FROM student_journeys sj
        JOIN learning_paths lp ON lp.id = sj.template_id
        WHERE sj.status <> 'archived'
        GROUP BY lp.domain
        ORDER BY lp.domain
      `)
    ).map((r) => ({
      domain: r.domain,
      label: PHASE1_JOURNEY_DOMAINS.find((d) => d.value === r.domain)?.label || r.domain,
      avg_readiness: Number(r.avg_readiness) || 0,
    }));

    dailyCompletion = (
      await query<{ day: string; completed: string }>(`
        SELECT to_char(d::date, 'Dy') AS day, 0::text AS completed
        FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, '1 day'::interval) d
        ORDER BY d
      `)
    ).map((r) => ({ day: r.day, completed: Number(r.completed) || 0 }));
  } catch {
    // empty charts until student_journeys exists / has data
  }

  // If no student data, still show domain scaffolding for chart empty states
  if (progressByDomain.length === 0) {
    progressByDomain = PHASE1_JOURNEY_DOMAINS.map((d) => ({
      domain: d.value,
      label: d.label,
      avg_progress: 0,
      count: 0,
    }));
  }
  if (skillMastery.length === 0) {
    skillMastery = PHASE1_JOURNEY_DOMAINS.map((d) => ({
      domain: d.value,
      label: d.label,
      avg_readiness: 0,
    }));
  }
  if (dailyCompletion.length === 0) {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    dailyCompletion = days.map((day) => ({ day, completed: 0 }));
  }

  const phase1Templates = Number(templateStats?.published) || 0;

  return {
    activeJourneys: journeyStats.active,
    completedJourneys: journeyStats.completed,
    studentsInProgress: journeyStats.studentsInProgress,
    averageCompletion: journeyStats.avgCompletion,
    averagePlacementReadiness: journeyStats.avgReadiness,
    todaysTasks,
    upcomingMockTests,
    pendingReviews,
    templatesTotal: Number(templateStats?.total) || 0,
    templatesPublished: phase1Templates,
    phase1Domains: PHASE1_JOURNEY_DOMAINS.length,
    charts: {
      journeyProgress: progressByDomain,
      placementReadiness: readinessTrend,
      skillMastery,
      dailyLearningCompletion: dailyCompletion,
    },
  };
}

/**
 * Called after ExamSubmitted — blends assessment score into active journeys'
 * placement_readiness and records an assessment_evaluated event.
 */
export async function applyAssessmentToJourneys(input: {
  studentId: string;
  driveId: string;
  sessionId: string;
  score: number;
  driveType?: string | null;
  weakTopics?: string[];
  strongTopics?: string[];
}): Promise<{ journeysUpdated: number; avgReadiness: number | null }> {
  const drive = await queryOne<{
    name: string;
    drive_type: string | null;
    overall_cutoff: number | null;
  }>(
    `SELECT ad.name, ad.drive_type, art.overall_cutoff
     FROM assessment_drives ad
     LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
     WHERE ad.id = $1`,
    [input.driveId]
  );

  const driveType = input.driveType || drive?.drive_type || "hiring";
  const totalMarksRow = await queryOne<{ total_marks: number | null }>(
    `SELECT art.total_marks
     FROM assessment_drives ad
     JOIN assessment_rule_templates art ON art.id = ad.rule_id
     WHERE ad.id = $1`,
    [input.driveId]
  ).catch(() => null);

  const totalMarks = Number(totalMarksRow?.total_marks) || 100;
  const scoreNorm = Math.max(
    0,
    Math.min(100, Math.round((Number(input.score) / totalMarks) * 100))
  );

  // Prefer in-progress journeys; else attach student to a matching Phase-1 template domain
  let journeys = await query<{
    id: string;
    placement_readiness: number;
    progress_percent: number;
    template_id: string;
    domain: string | null;
    readiness_weights: Record<string, number> | null;
  }>(
    `SELECT sj.id, sj.placement_readiness, sj.progress_percent, sj.template_id,
            lp.domain, lp.readiness_weights
     FROM student_journeys sj
     JOIN learning_paths lp ON lp.id = sj.template_id
     WHERE sj.student_id = $1
       AND sj.status IN ('in_progress', 'paused', 'not_started')
     ORDER BY
       CASE sj.status WHEN 'in_progress' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
       sj.updated_at DESC
     LIMIT 8`,
    [input.studentId]
  );

  if (journeys.length === 0) {
    const hintDomain =
      input.weakTopics?.[0] ||
      (driveType === "coding_assessment" ? "python_coding" : null);
    const template = await queryOne<{ id: string }>(
      hintDomain
        ? `SELECT id FROM learning_paths WHERE domain = $1 AND status = 'published' LIMIT 1`
        : `SELECT id FROM learning_paths WHERE status = 'published' ORDER BY created_at ASC LIMIT 1`,
      hintDomain ? [hintDomain] : []
    );
    if (template?.id) {
      const created = await queryOne<{ id: string }>(
        `INSERT INTO student_journeys (
           student_id, template_id, status, progress_percent, placement_readiness, started_at
         ) VALUES ($1, $2, 'in_progress', 5, $3, NOW())
         ON CONFLICT (student_id, template_id) DO UPDATE SET
           status = 'in_progress',
           updated_at = NOW()
         RETURNING id`,
        [input.studentId, template.id, scoreNorm]
      );
      if (created?.id) {
        journeys = await query(
          `SELECT sj.id, sj.placement_readiness, sj.progress_percent, sj.template_id,
                  lp.domain, lp.readiness_weights
           FROM student_journeys sj
           JOIN learning_paths lp ON lp.id = sj.template_id
           WHERE sj.id = $1`,
          [created.id]
        );
      }
    }
  }

  let updated = 0;
  let readinessSum = 0;

  for (const j of journeys) {
    const weights = { ...DEFAULT_WEIGHTS, ...(j.readiness_weights || {}) };
    const assessmentW =
      driveType === "mock_test"
        ? Number(weights.mock_test_performance) || 0.15
        : driveType === "coding_assessment"
          ? Number(weights.coding_performance) || 0.2
          : Number(weights.assessment_scores) || 0.2;

    const prev = Number(j.placement_readiness) || 0;
    // Blend: keep most of prior readiness, pull toward this attempt via weight
    const blended = Math.round(
      Math.min(
        100,
        Math.max(0, prev * (1 - assessmentW) + scoreNorm * assessmentW)
      )
    );
    const progressBump = Math.min(
      100,
      Number(j.progress_percent) + (scoreNorm >= 40 ? 4 : 2)
    );

    await query(
      `UPDATE student_journeys
       SET placement_readiness = $1,
           progress_percent = $2,
           status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
           started_at = COALESCE(started_at, NOW()),
           updated_at = NOW()
       WHERE id = $3`,
      [blended, progressBump, j.id]
    );

    await query(
      `INSERT INTO student_journey_events (journey_id, event_type, payload)
       VALUES ($1, 'assessment_evaluated', $2::jsonb)`,
      [
        j.id,
        JSON.stringify({
          session_id: input.sessionId,
          drive_id: input.driveId,
          drive_name: drive?.name || null,
          drive_type: driveType,
          score: input.score,
          score_percent: scoreNorm,
          weak_topics: input.weakTopics || [],
          strong_topics: input.strongTopics || [],
          placement_readiness_before: prev,
          placement_readiness_after: blended,
        }),
      ]
    );

    updated += 1;
    readinessSum += blended;
  }

  return {
    journeysUpdated: updated,
    avgReadiness: updated ? Math.round(readinessSum / updated) : null,
  };
}
