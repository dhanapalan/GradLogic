/**
 * Assessment Hub — Analytics reports (single responsibility: reporting).
 * Separate from dashboard KPIs, evaluation detail, and certificates.
 */
import { query, queryOne } from "../config/database.js";

/** Default pass threshold when rule overall_cutoff is unset (matches Assessment Hub dashboard). */
const PASS_DEFAULT = 40;

function labelDriveType(t: string): string {
  switch (t) {
    case "practice_test":
      return "Practice";
    case "mock_test":
      return "Mock";
    case "coding_assessment":
      return "Coding";
    case "hiring":
      return "Hiring";
    case "skill_development":
      return "Skill Dev";
    default:
      return t.replace(/_/g, " ");
  }
}

async function skillAccuracyRows() {
  return query<{
    category: string;
    attempts: string;
    correct: string;
  }>(`
    SELECT qb.category::text AS category,
           COUNT(*)::text AS attempts,
           COUNT(*) FILTER (WHERE pa.is_correct)::text AS correct
    FROM practice_attempts pa
    JOIN question_bank qb ON qb.id = pa.question_id
    WHERE pa.is_correct IS NOT NULL
    GROUP BY qb.category
    HAVING COUNT(*) >= 3
  `).catch(() => []);
}

export async function getAssessmentHubAnalytics() {
  // 1. Assessment Attempts
  const attemptsSummary = await queryOne<{
    total: string;
    started: string;
    completed: string;
    in_progress: string;
  }>(`
    SELECT
      COUNT(*)::text AS total,
      COUNT(*) FILTER (WHERE started_at IS NOT NULL)::text AS started,
      COUNT(*) FILTER (WHERE status = 'completed')::text AS completed,
      COUNT(*) FILTER (WHERE status = 'in_progress')::text AS in_progress
    FROM drive_students
  `);

  const attemptsByType = (
    await query<{ drive_type: string; attempts: string }>(`
      SELECT COALESCE(ad.drive_type, 'unknown') AS drive_type,
             COUNT(ds.id)::text AS attempts
      FROM assessment_drives ad
      LEFT JOIN drive_students ds ON ds.drive_id = ad.id
        AND (ds.started_at IS NOT NULL OR ds.status IN ('completed','in_progress'))
      GROUP BY ad.drive_type
      ORDER BY COUNT(ds.id) DESC
    `)
  ).map((r) => ({
    drive_type: r.drive_type,
    label: labelDriveType(r.drive_type),
    attempts: Number(r.attempts) || 0,
  }));

  const attemptsDaily = (
    await query<{ day: string; label: string; count: string }>(`
      SELECT
        to_char(d::date, 'YYYY-MM-DD') AS day,
        to_char(d::date, 'Mon DD') AS label,
        COALESCE((
          SELECT COUNT(*)::text FROM drive_students ds
          WHERE ds.started_at::date = d::date OR ds.completed_at::date = d::date
        ), '0') AS count
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
      ORDER BY d
    `)
  ).map((r) => ({
    day: r.day,
    label: r.label,
    count: Number(r.count) || 0,
  }));

  // 2. Completion
  const started = Number(attemptsSummary?.started) || 0;
  const completed = Number(attemptsSummary?.completed) || 0;
  const completionDenom = Math.max(started, completed);
  const completionRate =
    completionDenom > 0
      ? Math.round((completed / completionDenom) * 1000) / 10
      : null;

  const completionByType = (
    await query<{
      drive_type: string;
      started: string;
      completed: string;
    }>(`
      SELECT COALESCE(ad.drive_type, 'unknown') AS drive_type,
             COUNT(ds.id) FILTER (WHERE ds.started_at IS NOT NULL)::text AS started,
             COUNT(ds.id) FILTER (WHERE ds.status = 'completed')::text AS completed
      FROM assessment_drives ad
      LEFT JOIN drive_students ds ON ds.drive_id = ad.id
      GROUP BY ad.drive_type
      ORDER BY ad.drive_type
    `)
  ).map((r) => {
    const s = Number(r.started) || 0;
    const c = Number(r.completed) || 0;
    return {
      drive_type: r.drive_type,
      label: labelDriveType(r.drive_type),
      started: s,
      completed: c,
      rate: s > 0 ? Math.round((c / s) * 1000) / 10 : null,
    };
  });

  // 3. Average Score
  const avgOverall = await queryOne<{ avg: string | null; n: string }>(`
    SELECT ROUND(AVG(score), 1)::text AS avg,
           COUNT(*)::text AS n
    FROM drive_students
    WHERE status = 'completed' AND score IS NOT NULL
  `);

  const averageScoreByType = (
    await query<{ drive_type: string; avg_score: string | null; attempts: string }>(`
      SELECT COALESCE(ad.drive_type, 'unknown') AS drive_type,
             ROUND(AVG(ds.score) FILTER (WHERE ds.status = 'completed' AND ds.score IS NOT NULL), 1)::text AS avg_score,
             COUNT(*) FILTER (WHERE ds.status = 'completed' AND ds.score IS NOT NULL)::text AS attempts
      FROM assessment_drives ad
      LEFT JOIN drive_students ds ON ds.drive_id = ad.id
      GROUP BY ad.drive_type
      ORDER BY ad.drive_type
    `)
  ).map((r) => ({
    drive_type: r.drive_type,
    label: labelDriveType(r.drive_type),
    avg_score: r.avg_score != null ? Number(r.avg_score) : null,
    attempts: Number(r.attempts) || 0,
  }));

  const averageScoreDaily = (
    await query<{ day: string; label: string; avg_score: string | null }>(`
      SELECT
        to_char(d::date, 'YYYY-MM-DD') AS day,
        to_char(d::date, 'Mon DD') AS label,
        (
          SELECT ROUND(AVG(ds.score), 1)::text
          FROM drive_students ds
          WHERE ds.status = 'completed'
            AND ds.score IS NOT NULL
            AND ds.completed_at::date = d::date
        ) AS avg_score
      FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
      ORDER BY d
    `)
  ).map((r) => ({
    day: r.day,
    label: r.label,
    avg_score: r.avg_score != null ? Number(r.avg_score) : 0,
  }));

  // 3b. Pass rate (score ≥ rule overall_cutoff, else default)
  const passOverall = await queryOne<{
    completed: string;
    passed: string;
  }>(`
    SELECT
      COUNT(*) FILTER (
        WHERE ds.status = 'completed' AND ds.score IS NOT NULL
      )::text AS completed,
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
  `);

  const passCompleted = Number(passOverall?.completed) || 0;
  const passPassed = Number(passOverall?.passed) || 0;
  const passRatePercent =
    passCompleted > 0 ? Math.round((passPassed / passCompleted) * 1000) / 10 : null;

  const passByType = (
    await query<{
      drive_type: string;
      completed: string;
      passed: string;
    }>(`
      SELECT COALESCE(ad.drive_type, 'unknown') AS drive_type,
             COUNT(*) FILTER (
               WHERE ds.status = 'completed' AND ds.score IS NOT NULL
             )::text AS completed,
             COUNT(*) FILTER (
               WHERE ds.status = 'completed'
                 AND ds.score IS NOT NULL
                 AND ds.score >= COALESCE(
                   NULLIF((ad.rule_snapshot->>'overall_cutoff')::float, 0),
                   NULLIF(art.overall_cutoff, 0),
                   ${PASS_DEFAULT}
                 )
             )::text AS passed
      FROM assessment_drives ad
      LEFT JOIN drive_students ds ON ds.drive_id = ad.id
      LEFT JOIN assessment_rule_templates art ON art.id = ad.rule_id
      GROUP BY ad.drive_type
      ORDER BY ad.drive_type
    `)
  ).map((r) => {
    const c = Number(r.completed) || 0;
    const p = Number(r.passed) || 0;
    return {
      drive_type: r.drive_type,
      label: labelDriveType(r.drive_type),
      completed: c,
      passed: p,
      rate_percent: c > 0 ? Math.round((p / c) * 1000) / 10 : null,
    };
  });

  // 3c. Question statistics
  const questionByType = (
    await query<{ type: string; count: string }>(`
      SELECT COALESCE(type::text, 'unknown') AS type, COUNT(*)::text AS count
      FROM question_bank
      WHERE is_active = TRUE
      GROUP BY type
      ORDER BY COUNT(*) DESC
    `).catch(() => [])
  ).map((r) => ({
    type: r.type,
    label: r.type.replace(/_/g, " "),
    count: Number(r.count) || 0,
  }));

  const questionByDifficulty = (
    await query<{ difficulty: string; count: string }>(`
      SELECT COALESCE(difficulty_level::text, 'unspecified') AS difficulty,
             COUNT(*)::text AS count
      FROM question_bank
      WHERE is_active = TRUE
      GROUP BY difficulty_level
      ORDER BY
        CASE difficulty_level::text
          WHEN 'easy' THEN 1
          WHEN 'medium' THEN 2
          WHEN 'hard' THEN 3
          ELSE 9
        END
    `).catch(() => [])
  ).map((r) => ({
    difficulty: r.difficulty,
    label: r.difficulty,
    count: Number(r.count) || 0,
  }));

  const questionByCategory = (
    await query<{ category: string; count: string }>(`
      SELECT COALESCE(category::text, 'unspecified') AS category,
             COUNT(*)::text AS count
      FROM question_bank
      WHERE is_active = TRUE
      GROUP BY category
      ORDER BY COUNT(*) DESC
      LIMIT 12
    `).catch(() => [])
  ).map((r) => ({
    category: r.category,
    label: r.category.replace(/_/g, " "),
    count: Number(r.count) || 0,
  }));

  const questionAttemptStats = await queryOne<{
    questions_attempted: string;
    avg_pass_rate: string | null;
  }>(`
    SELECT COUNT(DISTINCT pa.question_id)::text AS questions_attempted,
           ROUND(
             AVG(
               CASE WHEN pa.is_correct THEN 1.0 ELSE 0.0 END
             ) FILTER (WHERE pa.is_correct IS NOT NULL) * 100
           , 1)::text AS avg_pass_rate
    FROM practice_attempts pa
  `).catch(() => null);

  // 4–5. Weak / Strong Skills (practice accuracy)
  const skillRows = await skillAccuracyRows();
  const skills = skillRows
    .map((r) => {
      const attempts = Number(r.attempts) || 0;
      const correct = Number(r.correct) || 0;
      return {
        skill: r.category,
        label: r.category.replace(/_/g, " "),
        attempts,
        accuracy: attempts > 0 ? correct / attempts : 0,
      };
    })
    .sort((a, b) => a.accuracy - b.accuracy);

  const weakSkills = skills.filter((s) => s.accuracy < 0.55).slice(0, 10);
  const strongSkills = [...skills]
    .filter((s) => s.accuracy >= 0.7)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 10);

  // Fallback: pool skill vs drive avg score when no practice data
  let weakFallback: typeof weakSkills = [];
  let strongFallback: typeof strongSkills = [];
  if (weakSkills.length === 0 && strongSkills.length === 0) {
    const bySkill = await query<{
      topic: string;
      avg_score: string;
      samples: string;
    }>(`
      SELECT COALESCE(NULLIF(TRIM(dpq.skill), ''), 'Unspecified') AS topic,
             ROUND(AVG(ds.score), 1)::text AS avg_score,
             COUNT(*)::text AS samples
      FROM drive_students ds
      JOIN drive_pool_questions dpq ON dpq.drive_id = ds.drive_id
      WHERE ds.status = 'completed' AND ds.score IS NOT NULL
      GROUP BY 1
      HAVING COUNT(*) >= 2
      ORDER BY AVG(ds.score) ASC
    `).catch(() => []);

    weakFallback = bySkill
      .filter((r) => Number(r.avg_score) < 60)
      .slice(0, 10)
      .map((r) => ({
        skill: r.topic,
        label: r.topic,
        attempts: Number(r.samples) || 0,
        accuracy: Math.min(1, (Number(r.avg_score) || 0) / 100),
      }));
    strongFallback = [...bySkill]
      .filter((r) => Number(r.avg_score) >= 70)
      .sort((a, b) => Number(b.avg_score) - Number(a.avg_score))
      .slice(0, 10)
      .map((r) => ({
        skill: r.topic,
        label: r.topic,
        attempts: Number(r.samples) || 0,
        accuracy: Math.min(1, (Number(r.avg_score) || 0) / 100),
      }));
  }

  // 6. Placement Readiness (+ 14-day trend)
  let placementReadiness: {
    average: number | null;
    journeys: number;
    buckets: Array<{ bucket: string; count: number; avg_readiness: number }>;
    by_domain: Array<{ domain: string; label: string; avg_readiness: number; count: number }>;
    trend: Array<{ day: string; label: string; avg_readiness: number }>;
  } = { average: null, journeys: 0, buckets: [], by_domain: [], trend: [] };

  try {
    const avg = await queryOne<{ avg: string | null; n: string }>(`
      SELECT ROUND(AVG(placement_readiness))::text AS avg,
             COUNT(*)::text AS n
      FROM student_journeys
      WHERE status IN ('in_progress','completed','paused')
    `);
    const buckets = (
      await query<{ bucket: string; count: string; avg_readiness: string }>(`
        SELECT
          CASE
            WHEN placement_readiness < 40 THEN '0-39'
            WHEN placement_readiness < 60 THEN '40-59'
            WHEN placement_readiness < 80 THEN '60-79'
            ELSE '80-100'
          END AS bucket,
          COUNT(*)::text AS count,
          ROUND(AVG(placement_readiness))::text AS avg_readiness
        FROM student_journeys
        WHERE status IN ('in_progress','completed','paused')
        GROUP BY 1
        ORDER BY 1
      `)
    ).map((r) => ({
      bucket: r.bucket,
      count: Number(r.count) || 0,
      avg_readiness: Number(r.avg_readiness) || 0,
    }));
    const byDomain = (
      await query<{ domain: string; avg_readiness: string; count: string }>(`
        SELECT COALESCE(lp.domain, 'unspecified') AS domain,
               ROUND(AVG(sj.placement_readiness))::text AS avg_readiness,
               COUNT(*)::text AS count
        FROM student_journeys sj
        JOIN learning_paths lp ON lp.id = sj.template_id
        WHERE sj.status IN ('in_progress','completed','paused')
        GROUP BY 1
        ORDER BY AVG(sj.placement_readiness) DESC NULLS LAST
        LIMIT 10
      `)
    ).map((r) => ({
      domain: r.domain,
      label: r.domain.replace(/_/g, " "),
      avg_readiness: Number(r.avg_readiness) || 0,
      count: Number(r.count) || 0,
    }));
    // Cumulative readiness trend: avg of journeys as of each day (updated_at <= day)
    const trend = (
      await query<{ day: string; label: string; avg_readiness: string | null }>(`
        SELECT
          to_char(d::date, 'YYYY-MM-DD') AS day,
          to_char(d::date, 'Mon DD') AS label,
          (
            SELECT ROUND(AVG(sj.placement_readiness))::text
            FROM student_journeys sj
            WHERE sj.status IN ('in_progress','completed','paused')
              AND sj.updated_at::date <= d::date
          ) AS avg_readiness
        FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
        ORDER BY d
      `)
    ).map((r) => ({
      day: r.day,
      label: r.label,
      avg_readiness: r.avg_readiness != null ? Number(r.avg_readiness) : 0,
    }));
    placementReadiness = {
      average: avg?.avg != null ? Number(avg.avg) : null,
      journeys: Number(avg?.n) || 0,
      buckets,
      by_domain: byDomain,
      trend,
    };
  } catch {
    /* journey tables may be absent */
  }

  // 7. Question Quality
  const qualitySummary = await queryOne<{
    published: string;
    missing_explanation: string;
    missing_hint: string;
    no_embedding: string;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE is_active AND status = 'published')::text AS published,
      COUNT(*) FILTER (WHERE is_active AND status = 'published' AND explanation IS NULL)::text AS missing_explanation,
      COUNT(*) FILTER (WHERE is_active AND status = 'published' AND hint IS NULL)::text AS missing_hint,
      COUNT(*) FILTER (WHERE is_active AND status = 'published' AND search_embedding IS NULL)::text AS no_embedding
    FROM question_bank
  `).catch(() => null);

  const qualityFlags = (
    await query<{
      id: string;
      question_text: string;
      category: string;
      attempts: string;
      correct: string;
    }>(`
      SELECT qb.id, LEFT(qb.question_text, 120) AS question_text,
             qb.category::text AS category,
             COUNT(*)::text AS attempts,
             COUNT(*) FILTER (WHERE pa.is_correct)::text AS correct
      FROM practice_attempts pa
      JOIN question_bank qb ON qb.id = pa.question_id
      WHERE pa.is_correct IS NOT NULL
      GROUP BY qb.id, qb.question_text, qb.category
      HAVING COUNT(*) >= 5
         AND COUNT(*) FILTER (WHERE pa.is_correct)::float / COUNT(*) < 0.15
      ORDER BY COUNT(*) FILTER (WHERE pa.is_correct)::float / COUNT(*) ASC
      LIMIT 15
    `).catch(() => [])
  ).map((r) => {
    const attempts = Number(r.attempts) || 0;
    const correct = Number(r.correct) || 0;
    return {
      id: r.id,
      question_text: r.question_text,
      category: r.category,
      pass_rate: attempts > 0 ? correct / attempts : 0,
      attempts,
      reasons: [
        `Very low pass rate (${Math.round((correct / Math.max(attempts, 1)) * 100)}% of ${attempts})`,
      ],
    };
  });

  const missingMeta = (
    await query<{ id: string; question_text: string; category: string }>(`
      SELECT id, LEFT(question_text, 100) AS question_text, category::text AS category
      FROM question_bank
      WHERE is_active = TRUE AND status = 'published'
        AND (explanation IS NULL OR hint IS NULL)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT 12
    `).catch(() => [])
  ).map((r) => ({
    id: r.id,
    question_text: r.question_text,
    category: r.category,
    reasons: ["Missing explanation and/or hint"],
  }));

  // 8. AI Usage
  let aiUsage: {
    total_events: number;
    by_feature: Array<{ feature: string; count: number }>;
    last_14_days: Array<{ day: string; label: string; count: number }>;
  } = { total_events: 0, by_feature: [], last_14_days: [] };

  try {
    const total = await queryOne<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM ai_usage_events`
    );
    const byFeature = (
      await query<{ feature: string; count: string }>(`
        SELECT COALESCE(feature, 'unknown') AS feature, COUNT(*)::text AS count
        FROM ai_usage_events
        GROUP BY feature
        ORDER BY COUNT(*) DESC
        LIMIT 12
      `)
    ).map((r) => ({
      feature: r.feature,
      count: Number(r.count) || 0,
    }));
    const last14 = (
      await query<{ day: string; label: string; count: string }>(`
        SELECT
          to_char(d::date, 'YYYY-MM-DD') AS day,
          to_char(d::date, 'Mon DD') AS label,
          COALESCE((
            SELECT COUNT(*)::text FROM ai_usage_events e
            WHERE e.created_at::date = d::date
          ), '0') AS count
        FROM generate_series(CURRENT_DATE - 13, CURRENT_DATE, '1 day'::interval) d
        ORDER BY d
      `)
    ).map((r) => ({
      day: r.day,
      label: r.label,
      count: Number(r.count) || 0,
    }));
    aiUsage = {
      total_events: Number(total?.n) || 0,
      by_feature: byFeature,
      last_14_days: last14,
    };
  } catch {
    /* ai_usage_events may be absent */
  }

  const published = Number(qualitySummary?.published) || 0;
  const activeQuestions = questionByType.reduce((s, r) => s + r.count, 0);

  return {
    generatedAt: new Date().toISOString(),
    overview: {
      // Prefer started; fall back to completed so KPI isn't zero when started_at is null
      attempts: Math.max(started, completed, Number(attemptsSummary?.total) || 0),
      completion_rate: completionRate,
      average_score: avgOverall?.avg != null ? Number(avgOverall.avg) : null,
      pass_rate: passRatePercent,
      questions_active: activeQuestions,
      weak_skills_count: (weakSkills.length ? weakSkills : weakFallback).length,
      strong_skills_count: (strongSkills.length ? strongSkills : strongFallback).length,
      placement_readiness_avg: placementReadiness.average,
    },
    reports: {
      assessment_attempts: {
        id: "assessment_attempts",
        title: "Assessment Attempts",
        summary: {
          total: Number(attemptsSummary?.total) || 0,
          started,
          completed,
          in_progress: Number(attemptsSummary?.in_progress) || 0,
        },
        by_type: attemptsByType,
        daily: attemptsDaily,
      },
      completion: {
        id: "completion",
        title: "Completion",
        summary: {
          started,
          completed,
          rate_percent: completionRate,
        },
        by_type: completionByType,
      },
      average_score: {
        id: "average_score",
        title: "Average Score",
        summary: {
          average: avgOverall?.avg != null ? Number(avgOverall.avg) : null,
          scored_attempts: Number(avgOverall?.n) || 0,
        },
        by_type: averageScoreByType,
        daily: averageScoreDaily,
      },
      pass_rate: {
        id: "pass_rate",
        title: "Pass Rate",
        summary: {
          completed: passCompleted,
          passed: passPassed,
          rate_percent: passRatePercent,
          cutoff_default: PASS_DEFAULT,
        },
        by_type: passByType,
      },
      question_statistics: {
        id: "question_statistics",
        title: "Question Statistics",
        summary: {
          active: activeQuestions,
          published,
          questions_with_attempts: Number(questionAttemptStats?.questions_attempted) || 0,
          avg_practice_pass_rate:
            questionAttemptStats?.avg_pass_rate != null
              ? Number(questionAttemptStats.avg_pass_rate)
              : null,
          missing_explanation: Number(qualitySummary?.missing_explanation) || 0,
          missing_hint: Number(qualitySummary?.missing_hint) || 0,
          flagged_low_pass: qualityFlags.length,
        },
        by_type: questionByType,
        by_difficulty: questionByDifficulty,
        by_category: questionByCategory,
        flags: [...qualityFlags, ...missingMeta].slice(0, 20),
      },
      weak_skills: {
        id: "weak_skills",
        title: "Weak Skills",
        items: weakSkills.length ? weakSkills : weakFallback,
        source: weakSkills.length ? "practice_attempts" : "drive_pool_skill",
      },
      strong_skills: {
        id: "strong_skills",
        title: "Strong Skills",
        items: strongSkills.length ? strongSkills : strongFallback,
        source: strongSkills.length ? "practice_attempts" : "drive_pool_skill",
      },
      placement_readiness: {
        id: "placement_readiness",
        title: "Placement Readiness",
        ...placementReadiness,
      },
      /** @deprecated use question_statistics — kept for older clients */
      question_quality: {
        id: "question_quality",
        title: "Question Quality",
        summary: {
          published,
          missing_explanation: Number(qualitySummary?.missing_explanation) || 0,
          missing_hint: Number(qualitySummary?.missing_hint) || 0,
          missing_embedding: Number(qualitySummary?.no_embedding) || 0,
          flagged_low_pass: qualityFlags.length,
        },
        flags: [...qualityFlags, ...missingMeta].slice(0, 20),
      },
      ai_usage: {
        id: "ai_usage",
        title: "AI Usage",
        ...aiUsage,
      },
    },
  };
}
