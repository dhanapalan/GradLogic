/**
 * Assessment Hub — overview dashboard (single responsibility: hub KPIs).
 * Reads drives + attempts; does not build assessments or evaluate them.
 */
import { query, queryOne } from "../config/database.js";
import { PHASE1_PLACEMENT_DOMAINS } from "../shared/phase1PlacementDomains.js";

const PASS_DEFAULT = 40;

const DOMAIN_ALIASES: Record<string, string[]> = {
  aptitude: ["aptitude", "quantitative", "quant"],
  reasoning: ["reasoning", "logical"],
  python_coding: ["python", "python_coding"],
  java_coding: ["java", "java_coding"],
  ai_fundamentals: ["ai_fundamentals", "data_science", "ai fundamentals", "ai"],
};

const DOMAIN_LABELS: Record<string, string> = {
  aptitude: "Quantitative Aptitude",
  reasoning: "Logical Reasoning",
  python_coding: "Python",
  java_coding: "Java",
  ai_fundamentals: "AI Fundamentals",
};

export interface AssessmentHubDashboardFilters {
  domain?: string;
  status?: string;
  drive_type?: string;
  created_by?: string;
  from?: string;
  to?: string;
}

export interface KpiTrend {
  direction: "up" | "down" | "flat";
  percent: number | null;
  label: string;
}

function trendFromCounts(current: number, previous: number): KpiTrend {
  if (previous <= 0 && current <= 0) {
    return { direction: "flat", percent: null, label: "No change" };
  }
  if (previous <= 0) {
    return { direction: "up", percent: 100, label: "+100% vs prior week" };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { direction: "flat", percent: 0, label: "0% vs prior week" };
  return {
    direction: pct > 0 ? "up" : "down",
    percent: Math.abs(pct),
    label: `${pct > 0 ? "+" : ""}${pct}% vs prior week`,
  };
}

function mapSkillToDomain(skill: string | null | undefined): string | null {
  if (!skill) return null;
  const s = skill.trim().toLowerCase().replace(/\s+/g, "_");
  const spaced = skill.trim().toLowerCase();
  for (const d of PHASE1_PLACEMENT_DOMAINS) {
    const aliases = DOMAIN_ALIASES[d.value] || [d.value, d.bankCategory];
    if (
      aliases.some(
        (a) => s === a || s.includes(a) || spaced.includes(a.replace(/_/g, " "))
      ) ||
      s === d.bankCategory ||
      s === d.journeyDomain
    ) {
      return d.value;
    }
  }
  return null;
}

function buildDriveWhere(filters: AssessmentHubDashboardFilters): {
  sql: string;
  params: unknown[];
} {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  let i = 1;

  if (filters.status) {
    clauses.push(`UPPER(ad.status) = UPPER($${i++})`);
    params.push(filters.status);
  }
  if (filters.drive_type) {
    clauses.push(`ad.drive_type = $${i++}`);
    params.push(filters.drive_type);
  }
  if (filters.created_by) {
    clauses.push(`ad.created_by::text = $${i++}`);
    params.push(filters.created_by);
  }
  if (filters.from) {
    clauses.push(`ad.created_at::date >= $${i++}::date`);
    params.push(filters.from);
  }
  if (filters.to) {
    clauses.push(`ad.created_at::date <= $${i++}::date`);
    params.push(filters.to);
  }
  if (filters.domain) {
    const aliases = DOMAIN_ALIASES[filters.domain] || [filters.domain];
    const likeClauses = aliases
      .map((a) => {
        params.push(`%${a}%`);
        return `ad.name ILIKE $${i++}`;
      })
      .join(" OR ");
    const collIdx = i++;
    params.push(filters.domain);
    clauses.push(`(
      (${likeClauses})
      OR EXISTS (
        SELECT 1 FROM drive_source_collections dsc
        JOIN question_collections qc ON qc.id = dsc.collection_id
        WHERE dsc.drive_id = ad.id
          AND (
            qc.category::text = $${collIdx}
            OR qc.category::text ILIKE '%' || $${collIdx} || '%'
            OR qc.name ILIKE '%' || $${collIdx} || '%'
          )
      )
    )`);
  }

  return { sql: clauses.join(" AND "), params };
}

export async function getAssessmentHubDashboard(
  filters: AssessmentHubDashboardFilters = {}
) {
  const generatedAt = new Date().toISOString();
  const { sql: driveWhere, params: driveParams } = buildDriveWhere(filters);

  const typeCounts = await queryOne<{
    total: string;
    practice: string;
    mock: string;
    coding: string;
    published: string;
    draft: string;
  }>(
    `
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE ad.drive_type = 'practice_test')::text AS practice,
      COUNT(*) FILTER (WHERE ad.drive_type = 'mock_test')::text AS mock,
      COUNT(*) FILTER (WHERE ad.drive_type = 'coding_assessment')::text AS coding,
      COUNT(*) FILTER (
        WHERE UPPER(ad.status) IN ('LIVE','PUBLISHED','ACTIVE','READY','APPROVED','POOL_APPROVED','SCHEDULED')
      )::text AS published,
      COUNT(*) FILTER (WHERE UPPER(ad.status) = 'DRAFT')::text AS draft
    FROM assessment_drives ad
    WHERE ${driveWhere}
  `,
    driveParams
  );

  const codingLegacy = await queryOne<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM assessment_drives ad
    LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
    WHERE ${driveWhere}
      AND ad.drive_type <> 'coding_assessment'
      AND (
        ad.name ILIKE ANY (ARRAY['%cod%','%programming%','%dsa%','%hack%'])
        OR COALESCE(art.name, '') ILIKE ANY (ARRAY['%cod%','%programming%','%dsa%','%hack%'])
      )
  `,
    driveParams
  ).catch(() => ({ count: "0" }));

  const codingAssessments =
    (Number(typeCounts?.coding) || 0) + (Number(codingLegacy?.count) || 0);

  const attemptStats = await queryOne<{
    students_attempted: string;
    avg_score: string | null;
    completed: string;
    passed: string;
  }>(
    `
    SELECT
      COUNT(DISTINCT ds.student_id) FILTER (
        WHERE ds.status IN ('completed','in_progress') OR ds.started_at IS NOT NULL
      )::text AS students_attempted,
      ROUND(AVG(ds.score) FILTER (WHERE ds.status = 'completed' AND ds.score IS NOT NULL), 1)::text AS avg_score,
      COUNT(*) FILTER (WHERE ds.status = 'completed' AND ds.score IS NOT NULL)::text AS completed,
      COUNT(*) FILTER (
        WHERE ds.status = 'completed'
          AND ds.score IS NOT NULL
          AND ds.score >= COALESCE(
            NULLIF((ad.rule_snapshot->>'overall_cutoff')::float, 0),
            NULLIF(art.overall_cutoff, 0),
            ${PASS_DEFAULT}
          )
      )::text AS passed
    FROM drive_students ds
    JOIN assessment_drives ad ON ad.id = ds.drive_id
    LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
    WHERE ${driveWhere}
  `,
    driveParams
  );

  let placementReadiness: number | null = null;
  try {
    const pr = await queryOne<{ avg: string | null }>(`
      SELECT ROUND(AVG(placement_readiness))::text AS avg
      FROM student_journeys
      WHERE status IN ('in_progress','completed','paused')
    `);
    if (pr?.avg != null) placementReadiness = Number(pr.avg);
  } catch {
    placementReadiness = null;
  }

  // Week-over-week trends (drive creates / completions)
  const wow = await queryOne<{
    drives_cur: string;
    drives_prev: string;
    practice_cur: string;
    practice_prev: string;
    mock_cur: string;
    mock_prev: string;
    coding_cur: string;
    coding_prev: string;
    published_cur: string;
    published_prev: string;
    draft_cur: string;
    draft_prev: string;
    students_cur: string;
    students_prev: string;
    score_cur: string | null;
    score_prev: string | null;
  }>(
    `
    SELECT
      COUNT(*) FILTER (WHERE ad.created_at >= CURRENT_DATE - 6)::text AS drives_cur,
      COUNT(*) FILTER (
        WHERE ad.created_at >= CURRENT_DATE - 13 AND ad.created_at < CURRENT_DATE - 6
      )::text AS drives_prev,
      COUNT(*) FILTER (
        WHERE ad.drive_type = 'practice_test' AND ad.created_at >= CURRENT_DATE - 6
      )::text AS practice_cur,
      COUNT(*) FILTER (
        WHERE ad.drive_type = 'practice_test'
          AND ad.created_at >= CURRENT_DATE - 13 AND ad.created_at < CURRENT_DATE - 6
      )::text AS practice_prev,
      COUNT(*) FILTER (
        WHERE ad.drive_type = 'mock_test' AND ad.created_at >= CURRENT_DATE - 6
      )::text AS mock_cur,
      COUNT(*) FILTER (
        WHERE ad.drive_type = 'mock_test'
          AND ad.created_at >= CURRENT_DATE - 13 AND ad.created_at < CURRENT_DATE - 6
      )::text AS mock_prev,
      COUNT(*) FILTER (
        WHERE ad.drive_type = 'coding_assessment' AND ad.created_at >= CURRENT_DATE - 6
      )::text AS coding_cur,
      COUNT(*) FILTER (
        WHERE ad.drive_type = 'coding_assessment'
          AND ad.created_at >= CURRENT_DATE - 13 AND ad.created_at < CURRENT_DATE - 6
      )::text AS coding_prev,
      COUNT(*) FILTER (
        WHERE UPPER(ad.status) IN ('LIVE','PUBLISHED','ACTIVE','READY','APPROVED','POOL_APPROVED','SCHEDULED')
          AND ad.updated_at >= CURRENT_DATE - 6
      )::text AS published_cur,
      COUNT(*) FILTER (
        WHERE UPPER(ad.status) IN ('LIVE','PUBLISHED','ACTIVE','READY','APPROVED','POOL_APPROVED','SCHEDULED')
          AND ad.updated_at >= CURRENT_DATE - 13 AND ad.updated_at < CURRENT_DATE - 6
      )::text AS published_prev,
      COUNT(*) FILTER (
        WHERE UPPER(ad.status) = 'DRAFT' AND ad.updated_at >= CURRENT_DATE - 6
      )::text AS draft_cur,
      COUNT(*) FILTER (
        WHERE UPPER(ad.status) = 'DRAFT'
          AND ad.updated_at >= CURRENT_DATE - 13 AND ad.updated_at < CURRENT_DATE - 6
      )::text AS draft_prev,
      (
        SELECT COUNT(DISTINCT ds.student_id)::text
        FROM drive_students ds
        JOIN assessment_drives ad2 ON ad2.id = ds.drive_id
        WHERE ds.started_at >= CURRENT_DATE - 6
      ) AS students_cur,
      (
        SELECT COUNT(DISTINCT ds.student_id)::text
        FROM drive_students ds
        JOIN assessment_drives ad2 ON ad2.id = ds.drive_id
        WHERE ds.started_at >= CURRENT_DATE - 13 AND ds.started_at < CURRENT_DATE - 6
      ) AS students_prev,
      (
        SELECT ROUND(AVG(ds.score), 1)::text
        FROM drive_students ds
        WHERE ds.status = 'completed' AND ds.score IS NOT NULL
          AND ds.completed_at >= CURRENT_DATE - 6
      ) AS score_cur,
      (
        SELECT ROUND(AVG(ds.score), 1)::text
        FROM drive_students ds
        WHERE ds.status = 'completed' AND ds.score IS NOT NULL
          AND ds.completed_at >= CURRENT_DATE - 13 AND ds.completed_at < CURRENT_DATE - 6
      ) AS score_prev
    FROM assessment_drives ad
    WHERE ${driveWhere}
  `,
    driveParams
  ).catch(() => null);

  const scoreCur = wow?.score_cur != null ? Number(wow.score_cur) : 0;
  const scorePrev = wow?.score_prev != null ? Number(wow.score_prev) : 0;

  let readinessTrend: KpiTrend = {
    direction: "flat",
    percent: null,
    label: "Blended from journeys",
  };
  // Placement readiness has no clean WoW column; flat label is fine

  const kpis = {
    assessments: {
      value: Number(typeCounts?.total) || 0,
      trend: trendFromCounts(Number(wow?.drives_cur) || 0, Number(wow?.drives_prev) || 0),
    },
    practiceSets: {
      value: Number(typeCounts?.practice) || 0,
      trend: trendFromCounts(Number(wow?.practice_cur) || 0, Number(wow?.practice_prev) || 0),
    },
    mockTests: {
      value: Number(typeCounts?.mock) || 0,
      trend: trendFromCounts(Number(wow?.mock_cur) || 0, Number(wow?.mock_prev) || 0),
    },
    codingAssessments: {
      value: codingAssessments,
      trend: trendFromCounts(Number(wow?.coding_cur) || 0, Number(wow?.coding_prev) || 0),
    },
    publishedAssessments: {
      value: Number(typeCounts?.published) || 0,
      trend: trendFromCounts(
        Number(wow?.published_cur) || 0,
        Number(wow?.published_prev) || 0
      ),
    },
    draftAssessments: {
      value: Number(typeCounts?.draft) || 0,
      trend: trendFromCounts(Number(wow?.draft_cur) || 0, Number(wow?.draft_prev) || 0),
    },
    activeStudents: {
      value: Number(attemptStats?.students_attempted) || 0,
      trend: trendFromCounts(
        Number(wow?.students_cur) || 0,
        Number(wow?.students_prev) || 0
      ),
    },
    averageScore: {
      value: attemptStats?.avg_score != null ? Number(attemptStats.avg_score) : null,
      trend: trendFromCounts(scoreCur, scorePrev),
    },
    placementReadiness: {
      value: placementReadiness,
      trend: readinessTrend,
    },
  };

  // Charts
  const assessmentAttempts = await query<{ day: string; label: string; count: string }>(
    `
    SELECT
      to_char(d::date, 'YYYY-MM-DD') AS day,
      to_char(d::date, 'Mon DD') AS label,
      COALESCE((
        SELECT COUNT(*)::text
        FROM drive_students ds
        JOIN assessment_drives ad ON ad.id = ds.drive_id
        WHERE ${driveWhere}
          AND (ds.started_at::date = d::date OR ds.completed_at::date = d::date)
      ), '0') AS count
    FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
    ORDER BY d
  `,
    driveParams
  ).catch(() => []);

  const averageScoreTrend = await query<{ day: string; label: string; avg_score: string | null }>(
    `
    SELECT
      to_char(d::date, 'YYYY-MM-DD') AS day,
      to_char(d::date, 'Mon DD') AS label,
      (
        SELECT ROUND(AVG(ds.score), 1)::text
        FROM drive_students ds
        JOIN assessment_drives ad ON ad.id = ds.drive_id
        WHERE ${driveWhere}
          AND ds.status = 'completed' AND ds.score IS NOT NULL
          AND ds.completed_at::date = d::date
      ) AS avg_score
    FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
    ORDER BY d
  `,
    driveParams
  ).catch(() => []);

  const assessmentCompletion = await query<{
    day: string;
    label: string;
    started: string;
    completed: string;
  }>(
    `
    SELECT
      to_char(d::date, 'YYYY-MM-DD') AS day,
      to_char(d::date, 'Mon DD') AS label,
      COALESCE((
        SELECT COUNT(*)::text FROM drive_students ds
        JOIN assessment_drives ad ON ad.id = ds.drive_id
        WHERE ${driveWhere} AND ds.started_at::date = d::date
      ), '0') AS started,
      COALESCE((
        SELECT COUNT(*)::text FROM drive_students ds
        JOIN assessment_drives ad ON ad.id = ds.drive_id
        WHERE ${driveWhere} AND ds.completed_at::date = d::date AND ds.status = 'completed'
      ), '0') AS completed
    FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
    ORDER BY d
  `,
    driveParams
  ).catch(() => []);

  const difficultyDistribution = await query<{ difficulty: string; count: string }>(
    `
    SELECT
      COALESCE(NULLIF(LOWER(TRIM(dpq.difficulty)), ''), 'unspecified') AS difficulty,
      COUNT(*)::text AS count
    FROM drive_pool_questions dpq
    JOIN assessment_drives ad ON ad.id = dpq.drive_id
    WHERE ${driveWhere}
    GROUP BY 1
    ORDER BY
      CASE COALESCE(NULLIF(LOWER(TRIM(dpq.difficulty)), ''), 'unspecified')
        WHEN 'easy' THEN 1 WHEN 'beginner' THEN 1
        WHEN 'medium' THEN 2 WHEN 'intermediate' THEN 2
        WHEN 'hard' THEN 3 WHEN 'advanced' THEN 3
        ELSE 4
      END,
      difficulty
  `,
    driveParams
  ).catch(() => []);

  const domainScoreRows = await query<{ skill: string; avg_score: string; samples: string }>(
    `
    SELECT
      COALESCE(NULLIF(TRIM(dpq.skill), ''), 'Unspecified') AS skill,
      ROUND(AVG(ds.score), 1)::text AS avg_score,
      COUNT(*)::text AS samples
    FROM drive_students ds
    JOIN assessment_drives ad ON ad.id = ds.drive_id
    JOIN drive_pool_questions dpq ON dpq.drive_id = ds.drive_id
    WHERE ${driveWhere}
      AND ds.status = 'completed' AND ds.score IS NOT NULL
    GROUP BY 1
  `,
    driveParams
  ).catch(() => []);

  const domainAgg = new Map<string, { sum: number; weight: number }>();
  for (const d of PHASE1_PLACEMENT_DOMAINS) {
    domainAgg.set(d.value, { sum: 0, weight: 0 });
  }
  for (const row of domainScoreRows) {
    const domain = mapSkillToDomain(row.skill);
    if (!domain || !domainAgg.has(domain)) continue;
    const samples = Number(row.samples) || 0;
    const score = Number(row.avg_score) || 0;
    const cur = domainAgg.get(domain)!;
    cur.sum += score * samples;
    cur.weight += samples;
  }

  // Fallback: collection categories on drives with attempt averages
  if ([...domainAgg.values()].every((v) => v.weight === 0)) {
    const byCollection = await query<{ category: string; avg_score: string; samples: string }>(
      `
      SELECT
        COALESCE(qc.category::text, 'unknown') AS category,
        ROUND(AVG(ds.score), 1)::text AS avg_score,
        COUNT(*)::text AS samples
      FROM drive_students ds
      JOIN assessment_drives ad ON ad.id = ds.drive_id
      JOIN drive_source_collections dsc ON dsc.drive_id = ad.id
      JOIN question_collections qc ON qc.id = dsc.collection_id
      WHERE ${driveWhere}
        AND ds.status = 'completed' AND ds.score IS NOT NULL
      GROUP BY 1
    `,
      driveParams
    ).catch(() => []);

    for (const row of byCollection) {
      const domain =
        mapSkillToDomain(row.category) ||
        PHASE1_PLACEMENT_DOMAINS.find(
          (d) => d.bankCategory === row.category || d.value === row.category
        )?.value;
      if (!domain || !domainAgg.has(domain)) continue;
      const samples = Number(row.samples) || 0;
      const score = Number(row.avg_score) || 0;
      const cur = domainAgg.get(domain)!;
      cur.sum += score * samples;
      cur.weight += samples;
    }
  }

  const domainScores = PHASE1_PLACEMENT_DOMAINS.map((d) => {
    const agg = domainAgg.get(d.value)!;
    return {
      domain: d.value,
      label: DOMAIN_LABELS[d.value] || d.label,
      avg_score: agg.weight > 0 ? Math.round((agg.sum / agg.weight) * 10) / 10 : 0,
      samples: agg.weight,
    };
  });

  const topPerformingDomains = [...domainScores]
    .filter((d) => d.samples > 0)
    .sort((a, b) => b.avg_score - a.avg_score)
    .slice(0, 5);
  const weakDomains = [...domainScores]
    .filter((d) => d.samples > 0)
    .sort((a, b) => a.avg_score - b.avg_score)
    .slice(0, 5);

  // Recent activity
  const recentActivity: Array<{
    type: string;
    title: string;
    at: string;
    meta: string | null;
  }> = [];

  const driveEvents = await query<{
    event_type: string;
    title: string;
    at: string;
    meta: string | null;
  }>(
    `
    (
      SELECT
        CASE
          WHEN UPPER(ad.status) IN ('LIVE','PUBLISHED','ACTIVE') THEN 'assessment_published'
          WHEN UPPER(ad.status) = 'ARCHIVED' THEN 'assessment_archived'
          WHEN ad.drive_type = 'mock_test' THEN 'mock_test_created'
          WHEN ad.drive_type = 'practice_test' THEN 'practice_set_updated'
          ELSE 'assessment_updated'
        END AS event_type,
        ad.name AS title,
        COALESCE(ad.updated_at, ad.created_at)::text AS at,
        ad.drive_type AS meta
      FROM assessment_drives ad
      WHERE ${driveWhere}
      ORDER BY COALESCE(ad.updated_at, ad.created_at) DESC
      LIMIT 6
    )
    UNION ALL
    (
      SELECT
        'student_attempt_completed' AS event_type,
        COALESCE(ad.name, 'Assessment') AS title,
        ds.completed_at::text AS at,
        COALESCE(u.full_name, u.name, u.email) AS meta
      FROM drive_students ds
      JOIN assessment_drives ad ON ad.id = ds.drive_id
      LEFT JOIN users u ON u.id = ds.student_id
      WHERE ${driveWhere}
        AND ds.status = 'completed' AND ds.completed_at IS NOT NULL
      ORDER BY ds.completed_at DESC
      LIMIT 4
    )
    ORDER BY at DESC NULLS LAST
    LIMIT 8
  `,
    driveParams
  ).catch(() => []);

  for (const e of driveEvents) {
    recentActivity.push({
      type: e.event_type,
      title: e.title,
      at: e.at,
      meta: e.meta,
    });
  }

  // Pending items
  const pending: Array<{
    type: string;
    title: string;
    meta: string | null;
    href: string | null;
  }> = [];

  const pendingReviews = await queryOne<{ n: string }>(`
    SELECT COUNT(*)::text AS n FROM question_bank
    WHERE is_active = TRUE
      AND (
        status::text ILIKE '%pending%'
        OR status::text IN ('draft', 'DRAFT', 'pending_review')
      )
  `).catch(() => ({ n: "0" }));

  if (Number(pendingReviews?.n) > 0) {
    pending.push({
      type: "pending_reviews",
      title: `${pendingReviews?.n} questions pending review`,
      meta: "Question Bank",
      href: "/app/superadmin/question-bank?status=pending_review",
    });
  }

  const drafts = await query<{ id: string; name: string; drive_type: string | null }>(
    `
    SELECT ad.id, ad.name, ad.drive_type
    FROM assessment_drives ad
    WHERE ${driveWhere} AND UPPER(ad.status) = 'DRAFT'
    ORDER BY ad.updated_at DESC NULLS LAST
    LIMIT 4
  `,
    driveParams
  ).catch(() => []);

  for (const d of drafts) {
    pending.push({
      type: "draft_assessment",
      title: d.name,
      meta: d.drive_type || "draft",
      href: `/app/superadmin/drives/${d.id}`,
    });
  }

  const scheduledMocks = await query<{
    id: string;
    name: string;
    scheduled_start: string | null;
  }>(
    `
    SELECT ad.id, ad.name, ad.scheduled_start::text AS scheduled_start
    FROM assessment_drives ad
    WHERE ${driveWhere}
      AND ad.drive_type = 'mock_test'
      AND ad.scheduled_start IS NOT NULL
      AND ad.scheduled_start > NOW()
      AND UPPER(ad.status) NOT IN ('ARCHIVED','CANCELLED','COMPLETED')
    ORDER BY ad.scheduled_start ASC
    LIMIT 4
  `,
    driveParams
  ).catch(() => []);

  for (const m of scheduledMocks) {
    pending.push({
      type: "scheduled_mock",
      title: m.name,
      meta: m.scheduled_start
        ? `Scheduled ${new Date(m.scheduled_start).toLocaleString()}`
        : "Scheduled",
      href: `/app/superadmin/drives/${m.id}`,
    });
  }

  // Filter options
  const creators = await query<{ id: string; name: string }>(`
    SELECT DISTINCT u.id, COALESCE(u.full_name, u.name, u.email) AS name
    FROM assessment_drives ad
    JOIN users u ON u.id = ad.created_by
    WHERE ad.created_by IS NOT NULL
    ORDER BY name
    LIMIT 40
  `).catch(() => []);

  const completed = Number(attemptStats?.completed) || 0;
  const passed = Number(attemptStats?.passed) || 0;
  const passPercent = completed > 0 ? Math.round((passed / completed) * 100) : null;

  return {
    generatedAt,
    // Flat aliases for backward compatibility with older clients
    assessments: kpis.assessments.value,
    practiceTests: kpis.practiceSets.value,
    mockTests: kpis.mockTests.value,
    codingAssessments: kpis.codingAssessments.value,
    publishedAssessments: kpis.publishedAssessments.value,
    draftAssessments: kpis.draftAssessments.value,
    studentsAttempted: kpis.activeStudents.value,
    averageScore: kpis.averageScore.value,
    passPercent,
    placementReadiness: kpis.placementReadiness.value,
    kpis,
    charts: {
      assessmentAttempts: assessmentAttempts.map((r) => ({
        day: r.day,
        label: r.label,
        count: Number(r.count) || 0,
      })),
      averageScoreTrend: averageScoreTrend.map((r) => ({
        day: r.day,
        label: r.label,
        avg_score: r.avg_score != null ? Number(r.avg_score) : 0,
      })),
      difficultyDistribution: difficultyDistribution.map((r) => ({
        difficulty: r.difficulty,
        count: Number(r.count) || 0,
      })),
      assessmentCompletion: assessmentCompletion.map((r) => ({
        day: r.day,
        label: r.label,
        started: Number(r.started) || 0,
        completed: Number(r.completed) || 0,
        value:
          Number(r.started) > 0
            ? Math.round((Number(r.completed) / Number(r.started)) * 100)
            : Number(r.completed) > 0
              ? 100
              : 0,
      })),
      topPerformingDomains,
      weakDomains,
      // legacy aliases
      dailyAttempts: assessmentAttempts.map((r) => ({
        day: r.day,
        label: r.label,
        count: Number(r.count) || 0,
      })),
      averageScores: [],
      weakTopics: weakDomains.map((d) => ({
        topic: d.label,
        avg_score: d.avg_score,
        samples: d.samples,
      })),
      topPerformingCourses: [],
    },
    recentActivity,
    pending: pending.slice(0, 8),
    filterOptions: {
      domains: PHASE1_PLACEMENT_DOMAINS.map((d) => ({
        value: d.value,
        label: DOMAIN_LABELS[d.value] || d.label,
      })),
      statuses: [
        { value: "DRAFT", label: "Draft" },
        { value: "LIVE", label: "Live" },
        { value: "PUBLISHED", label: "Published" },
        { value: "READY", label: "Ready" },
        { value: "SCHEDULED", label: "Scheduled" },
        { value: "COMPLETED", label: "Completed" },
        { value: "ARCHIVED", label: "Archived" },
      ],
      assessmentTypes: [
        { value: "hiring", label: "Assessment" },
        { value: "practice_test", label: "Practice Set" },
        { value: "mock_test", label: "Mock Test" },
        { value: "coding_assessment", label: "Coding Assessment" },
      ],
      createdBy: creators,
    },
  };
}
