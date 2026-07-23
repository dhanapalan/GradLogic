/**
 * College/department evaluation rollups — aggregates published campaign
 * results and (optionally) an AI-generated outcomes summary. Extends the
 * existing per-attempt AI coaching pattern (assessmentEvaluation.service.ts)
 * to a department/college level view instead of a single student.
 */
import { query, queryOne } from "../config/database.js";
import { logger } from "../config/logger.js";

export interface DepartmentBreakdown {
  department: string;
  attempts: number;
  avg_percentage: number;
  pass_rate: number;
}

export interface RollupResult {
  scope: { college_id: string; department: string | null };
  summary: {
    total_attempts: number;
    avg_percentage: number;
    pass_rate: number;
    at_risk_count: number; // students averaging < 40%
  };
  by_department: DepartmentBreakdown[];
  at_risk_students: Array<{ user_id: string; name: string; avg_percentage: number }>;
  ai_summary: string | null;
}

async function computeRollup(collegeId: string, department: string | null) {
  const deptFilter = department ? `AND sd.specialization = $2` : "";
  const params = department ? [collegeId, department] : [collegeId];

  const overall = await queryOne<{
    total_attempts: string;
    avg_percentage: string | null;
    pass_rate: string | null;
  }>(
    `SELECT
        COUNT(*)::text AS total_attempts,
        AVG(e.percentage)::text AS avg_percentage,
        (COUNT(*) FILTER (WHERE e.passed)::float / NULLIF(COUNT(*), 0) * 100)::text AS pass_rate
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE c.college_id = $1
       AND e.status = 'published'
       ${deptFilter}`,
    params
  );

  const byDepartment = await query<{
    department: string | null;
    attempts: string;
    avg_percentage: string | null;
    pass_rate: string | null;
  }>(
    `SELECT
        COALESCE(NULLIF(TRIM(sd.specialization), ''), 'Unassigned') AS department,
        COUNT(*)::text AS attempts,
        AVG(e.percentage)::text AS avg_percentage,
        (COUNT(*) FILTER (WHERE e.passed)::float / NULLIF(COUNT(*), 0) * 100)::text AS pass_rate
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE c.college_id = $1
       AND e.status = 'published'
       ${deptFilter}
     GROUP BY 1
     ORDER BY 1`,
    params
  );

  const atRisk = await query<{ user_id: string; name: string; avg_percentage: string }>(
    `SELECT
        u.id AS user_id,
        u.name,
        AVG(e.percentage)::text AS avg_percentage
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE c.college_id = $1
       AND e.status = 'published'
       ${deptFilter}
     GROUP BY u.id, u.name
     HAVING AVG(e.percentage) < 40
     ORDER BY AVG(e.percentage) ASC
     LIMIT 20`,
    params
  );

  return {
    total_attempts: Number(overall?.total_attempts || 0),
    avg_percentage: Math.round((Number(overall?.avg_percentage) || 0) * 10) / 10,
    pass_rate: Math.round((Number(overall?.pass_rate) || 0) * 10) / 10,
    by_department: byDepartment.map((d) => ({
      department: d.department || "Unassigned",
      attempts: Number(d.attempts),
      avg_percentage: Math.round((Number(d.avg_percentage) || 0) * 10) / 10,
      pass_rate: Math.round((Number(d.pass_rate) || 0) * 10) / 10,
    })),
    at_risk_students: atRisk.map((s) => ({
      user_id: s.user_id,
      name: s.name,
      avg_percentage: Math.round((Number(s.avg_percentage) || 0) * 10) / 10,
    })),
  };
}

async function generateAiSummary(
  scope: string,
  stats: Awaited<ReturnType<typeof computeRollup>>
): Promise<string | null> {
  if (!stats.total_attempts) return null;
  try {
    const { generate } = await import("./ai.service.js");
    const prompt = [
      `Scope: ${scope}`,
      `Total published attempts: ${stats.total_attempts}`,
      `Average score: ${stats.avg_percentage}%`,
      `Pass rate: ${stats.pass_rate}%`,
      `Department breakdown: ${stats.by_department
        .map((d) => `${d.department} (${d.attempts} attempts, ${d.avg_percentage}% avg, ${d.pass_rate}% pass)`)
        .join("; ") || "none"}`,
      `At-risk students (avg < 40%): ${stats.at_risk_students.length}`,
      "Write a 3-4 sentence summary for a college administrator covering overall outcomes, which department(s) need attention, and one concrete improvement suggestion.",
      "Plain prose, no bullet points, no preamble.",
    ].join("\n");

    const result = await generate(prompt, {
      system: "You are TalentSecure AI Insights — concise, specific, and actionable for education administrators.",
      maxTokens: 400,
      riskLevel: "practice",
    });
    return result.text.trim() || null;
  } catch (err) {
    logger.error("[EvaluationRollup] AI summary generation failed", err);
    return null;
  }
}

export async function getCollegeEvaluationRollup(
  collegeId: string,
  department: string | null
): Promise<RollupResult> {
  const stats = await computeRollup(collegeId, department);
  const scopeLabel = department ? `Department: ${department}` : "Entire college";
  const ai_summary = await generateAiSummary(scopeLabel, stats);

  return {
    scope: { college_id: collegeId, department },
    summary: {
      total_attempts: stats.total_attempts,
      avg_percentage: stats.avg_percentage,
      pass_rate: stats.pass_rate,
      at_risk_count: stats.at_risk_students.length,
    },
    by_department: stats.by_department,
    at_risk_students: stats.at_risk_students,
    ai_summary,
  };
}
