/**
 * Phase 2 Module 08 — College-wide Assessment Analytics & Reports.
 * Published assessments only; campaigns include archived for history.
 * Faculty (instructor) may be department-scoped. No placement / AI insights.
 */
import * as XLSX from "xlsx";
import { query, queryOne } from "../config/database.js";
import { writeAuditLog } from "./audit.service.js";
import { buildSimpleReportPdf } from "../utils/simpleReportPdf.js";
import { ensureEvaluationSchema } from "./collegeCampaignEvaluation.service.js";

export type AnalyticsReportType =
  | "assessment"
  | "student"
  | "department"
  | "campaign"
  | "summary";

export interface AnalyticsFilters {
  search?: string;
  academic_year?: string;
  department?: string;
  assessment_id?: string;
  campaign_id?: string;
  result?: "pass" | "fail" | "";
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort?: string;
}

export interface AnalyticsActor {
  id: string;
  role: string;
  ip?: string;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function sanitize(v?: string | null) {
  const s = (v || "").trim();
  return s || null;
}

async function resolveForcedDepartment(userId: string, role: string): Promise<string | null> {
  const r = role.toLowerCase();
  if (
    ["college_admin", "college", "placement_cell", "super_admin", "hr", "college_staff"].includes(r)
  ) {
    return null;
  }
  if (r === "instructor") {
    const row = await queryOne<{ department: string | null }>(
      `SELECT department FROM users WHERE id = $1`,
      [userId]
    );
    return sanitize(row?.department);
  }
  return null;
}

type Scope = {
  campFilter: string;
  /** Params referenced by campFilter only ($1…$n). */
  campParams: unknown[];
  /** campParams + department (+ optional date/result). */
  params: unknown[];
  deptIdx: number;
  fromIdx: number;
  toIdx: number;
  resultIdx: number;
  dept: string | null;
  forced: string | null;
  assessmentId: string | null;
  campaignId: string | null;
  year: string | null;
  result: "pass" | "fail" | null;
  dateFrom: string | null;
  dateTo: string | null;
  search: string | null;
};

function buildScope(
  collegeId: string,
  forced: string | null,
  raw: AnalyticsFilters,
  opts?: { includeSearchOnAssessment?: boolean; includeDateResult?: boolean }
): Scope {
  const assessmentId = sanitize(raw.assessment_id);
  const campaignId = sanitize(raw.campaign_id);
  const year = sanitize(raw.academic_year);
  const dateFrom = sanitize(raw.date_from);
  const dateTo = sanitize(raw.date_to);
  const result = raw.result === "pass" || raw.result === "fail" ? raw.result : null;
  const search = sanitize(raw.search);
  const dept = forced || sanitize(raw.department);

  const params: unknown[] = [collegeId];
  let i = 2;
  let campFilter = `
    c.college_id = $1 AND c.deleted_at IS NULL
    AND c.status IN ('published','closed','archived')
    AND a.deleted_at IS NULL AND a.status = 'published'
  `;
  if (assessmentId) {
    campFilter += ` AND a.id = $${i++}`;
    params.push(assessmentId);
  }
  if (campaignId) {
    campFilter += ` AND c.id = $${i++}`;
    params.push(campaignId);
  }
  if (year) {
    campFilter += ` AND EXTRACT(YEAR FROM c.start_at)::text = $${i++}`;
    params.push(year);
  }
  if (opts?.includeSearchOnAssessment !== false && search) {
    campFilter += ` AND (a.name ILIKE $${i} OR c.name ILIKE $${i})`;
    params.push(`%${search}%`);
    i++;
  }

  const campParams = [...params];

  const deptIdx = i++;
  params.push(dept ? `%${dept}%` : null);
  let fromIdx = 0;
  let toIdx = 0;
  let resultIdx = 0;
  if (opts?.includeDateResult !== false) {
    fromIdx = i++;
    params.push(dateFrom);
    toIdx = i++;
    params.push(dateTo);
    resultIdx = i++;
    params.push(result);
  }

  return {
    campFilter,
    campParams,
    params,
    deptIdx,
    fromIdx,
    toIdx,
    resultIdx,
    dept,
    forced,
    assessmentId,
    campaignId,
    year,
    result,
    dateFrom,
    dateTo,
    search,
  };
}

function deptClause(deptIdx: number) {
  return `($${deptIdx}::text IS NULL OR COALESCE(NULLIF(TRIM(sd.specialization),''),'Unspecified') ILIKE $${deptIdx})`;
}

function dateClause(fromIdx: number, toIdx: number) {
  return `($${fromIdx}::timestamptz IS NULL OR att.submitted_at >= $${fromIdx}::timestamptz)
    AND ($${toIdx}::timestamptz IS NULL OR att.submitted_at <= $${toIdx}::timestamptz)`;
}

function resultClause(resultIdx: number) {
  return `($${resultIdx}::text IS NULL
    OR ($${resultIdx} = 'pass' AND e.passed IS TRUE)
    OR ($${resultIdx} = 'fail' AND e.passed IS FALSE))`;
}

export async function getMeta(collegeId: string, actor: AnalyticsActor) {
  await ensureEvaluationSchema();
  const forced = await resolveForcedDepartment(actor.id, actor.role);

  const assessments = await query<{ id: string; name: string }>(
    `SELECT id, name FROM college_assessments
     WHERE college_id = $1 AND deleted_at IS NULL AND status = 'published'
     ORDER BY name ASC LIMIT 200`,
    [collegeId]
  );

  const campaigns = await query<{ id: string; name: string; status: string }>(
    `SELECT id, name, status FROM college_assessment_campaigns
     WHERE college_id = $1 AND deleted_at IS NULL
       AND status IN ('published', 'closed', 'archived')
     ORDER BY start_at DESC LIMIT 200`,
    [collegeId]
  );

  let deptSql = `
    SELECT DISTINCT COALESCE(NULLIF(TRIM(sd.specialization), ''), 'Unspecified') AS value
    FROM student_details sd
    JOIN users u ON u.id = sd.user_id
    WHERE u.college_id = $1 AND LOWER(u.role::text) = 'student'
  `;
  const deptParams: unknown[] = [collegeId];
  if (forced) {
    deptSql += ` AND COALESCE(NULLIF(TRIM(sd.specialization), ''), 'Unspecified') ILIKE $2`;
    deptParams.push(`%${forced}%`);
  }
  deptSql += ` ORDER BY 1 LIMIT 80`;
  const departments = await query<{ value: string }>(deptSql, deptParams).catch(() => []);

  const years = await query<{ value: string }>(
    `SELECT DISTINCT EXTRACT(YEAR FROM start_at)::text AS value
     FROM college_assessment_campaigns
     WHERE college_id = $1 AND deleted_at IS NULL
     ORDER BY 1 DESC LIMIT 20`,
    [collegeId]
  ).catch(() => []);

  return {
    assessments,
    campaigns,
    departments: departments.map((d) => d.value).filter(Boolean),
    academic_years: years.map((y) => y.value).filter(Boolean),
    results: [
      { value: "pass", label: "Pass" },
      { value: "fail", label: "Fail" },
    ],
    forced_department: forced,
    can_export: true,
  };
}

export async function getDashboard(
  collegeId: string,
  actor: AnalyticsActor,
  raw: AnalyticsFilters
) {
  await ensureEvaluationSchema();
  const forced = await resolveForcedDepartment(actor.id, actor.role);
  const scope = buildScope(collegeId, forced, raw);
  const { campFilter, params, deptIdx, fromIdx, toIdx, resultIdx } = scope;
  const d = deptClause(deptIdx);
  const dt = dateClause(fromIdx, toIdx);
  const rc = resultClause(resultIdx);

  const summary = await queryOne<{
    total_assessments: string;
    published_assessments: string;
    active_campaigns: string;
    total_attempts: string;
    completed_attempts: string;
    pending_attempts: string;
    assigned: string;
    avg_score: string | null;
    passed: string;
    failed: string;
  }>(
    `WITH scoped AS (
       SELECT c.id AS campaign_id, a.id AS assessment_id, c.start_at, c.end_at, c.status
       FROM college_assessment_campaigns c
       JOIN college_assessments a ON a.id = c.assessment_id
       WHERE ${campFilter}
     )
     SELECT
       (SELECT COUNT(*)::text FROM college_assessments x
         WHERE x.college_id = $1 AND x.deleted_at IS NULL) AS total_assessments,
       (SELECT COUNT(*)::text FROM college_assessments x
         WHERE x.college_id = $1 AND x.deleted_at IS NULL AND x.status = 'published') AS published_assessments,
       (SELECT COUNT(*)::text FROM scoped s
         WHERE s.status = 'published' AND NOW() BETWEEN s.start_at AND s.end_at) AS active_campaigns,
       (SELECT COUNT(*)::text FROM college_campaign_attempts att
         JOIN scoped s ON s.campaign_id = att.campaign_id
         JOIN users u ON u.id = att.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d}) AS total_attempts,
       (SELECT COUNT(*)::text FROM college_campaign_attempts att
         JOIN scoped s ON s.campaign_id = att.campaign_id
         JOIN users u ON u.id = att.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d} AND att.status IN ('submitted','expired')) AS completed_attempts,
       (SELECT COUNT(*)::text FROM college_campaign_attempts att
         JOIN scoped s ON s.campaign_id = att.campaign_id
         JOIN users u ON u.id = att.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d} AND att.status = 'in_progress') AS pending_attempts,
       (SELECT COUNT(*)::text FROM college_campaign_students cs
         JOIN scoped s ON s.campaign_id = cs.campaign_id
         JOIN users u ON u.id = cs.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d}) AS assigned,
       (SELECT ROUND(AVG(e.percentage)::numeric, 2)::text
         FROM college_campaign_evaluations e
         JOIN college_campaign_attempts att ON att.id = e.attempt_id
         JOIN scoped s ON s.campaign_id = att.campaign_id
         JOIN users u ON u.id = att.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d} AND att.status IN ('submitted','expired')
           AND ${dt} AND ${rc}) AS avg_score,
       (SELECT COUNT(*)::text
         FROM college_campaign_evaluations e
         JOIN college_campaign_attempts att ON att.id = e.attempt_id
         JOIN scoped s ON s.campaign_id = att.campaign_id
         JOIN users u ON u.id = att.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d} AND att.status IN ('submitted','expired')
           AND ${dt} AND e.passed IS TRUE AND ${rc}) AS passed,
       (SELECT COUNT(*)::text
         FROM college_campaign_evaluations e
         JOIN college_campaign_attempts att ON att.id = e.attempt_id
         JOIN scoped s ON s.campaign_id = att.campaign_id
         JOIN users u ON u.id = att.user_id
         LEFT JOIN student_details sd ON sd.user_id = u.id
         WHERE ${d} AND att.status IN ('submitted','expired')
           AND ${dt} AND e.passed IS FALSE AND ${rc}) AS failed`,
    params
  );

  const assigned = Number(summary?.assigned || 0);
  const completed = Number(summary?.completed_attempts || 0);
  const pending = Math.max(0, assigned - completed);
  const attempted = completed;
  const passed = Number(summary?.passed || 0);
  const failed = Number(summary?.failed || 0);
  const passDenom = passed + failed;

  const deptAvg = await query<{ department: string; avg_score: string | null }>(
    `WITH scoped AS (
       SELECT c.id AS campaign_id
       FROM college_assessment_campaigns c
       JOIN college_assessments a ON a.id = c.assessment_id
       WHERE ${campFilter}
     )
     SELECT COALESCE(NULLIF(TRIM(sd.specialization),''),'Unspecified') AS department,
            ROUND(AVG(e.percentage)::numeric, 2)::text AS avg_score
     FROM college_campaign_evaluations e
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     JOIN scoped s ON s.campaign_id = att.campaign_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE att.status IN ('submitted','expired')
       AND ${d} AND ${dt} AND ${rc}
     GROUP BY 1
     ORDER BY AVG(e.percentage) DESC NULLS LAST
     LIMIT 12`,
    params
  );

  const trend = await query<{ period: string; avg_score: string | null }>(
    `WITH scoped AS (
       SELECT c.id AS campaign_id
       FROM college_assessment_campaigns c
       JOIN college_assessments a ON a.id = c.assessment_id
       WHERE ${campFilter}
     )
     SELECT TO_CHAR(DATE_TRUNC('week', att.submitted_at), 'YYYY-MM-DD') AS period,
            ROUND(AVG(e.percentage)::numeric, 2)::text AS avg_score
     FROM college_campaign_evaluations e
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     JOIN scoped s ON s.campaign_id = att.campaign_id
     JOIN users u ON u.id = e.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     WHERE att.status IN ('submitted','expired') AND att.submitted_at IS NOT NULL
       AND ${d} AND ${dt} AND ${rc}
     GROUP BY 1
     ORDER BY 1 ASC
     LIMIT 26`,
    params
  );

  return {
    filters_applied: {
      department: scope.dept,
      forced_department: scope.forced,
      assessment_id: scope.assessmentId,
      campaign_id: scope.campaignId,
      academic_year: scope.year,
      result: scope.result,
      date_from: scope.dateFrom,
      date_to: scope.dateTo,
      search: scope.search,
    },
    summary: {
      total_assessments: Number(summary?.total_assessments || 0),
      published_assessments: Number(summary?.published_assessments || 0),
      active_campaigns: Number(summary?.active_campaigns || 0),
      total_attempts: Number(summary?.total_attempts || 0),
      completed_attempts: completed,
      pending_attempts: Number(summary?.pending_attempts || 0),
      average_score: Number(summary?.avg_score || 0),
      overall_pass_percentage: passDenom > 0 ? round2((passed / passDenom) * 100) : 0,
    },
    charts: {
      completion: [
        { label: "Assigned", value: assigned },
        { label: "Attempted", value: attempted },
        { label: "Pending", value: pending },
      ],
      result_distribution: [
        { label: "Pass", value: passed },
        { label: "Fail", value: failed },
      ],
      department_average_score: deptAvg.map((row) => ({
        label: row.department,
        value: Number(row.avg_score || 0),
      })),
      average_score_trend: trend.map((t) => ({
        label: t.period,
        value: Number(t.avg_score || 0),
      })),
    },
  };
}

export async function getAssessmentPerformance(
  collegeId: string,
  actor: AnalyticsActor,
  raw: AnalyticsFilters
) {
  await ensureEvaluationSchema();
  const forced = await resolveForcedDepartment(actor.id, actor.role);
  const scope = buildScope(collegeId, forced, raw, { includeDateResult: false });
  const { campFilter, campParams, params, deptIdx } = scope;
  const page = Math.max(1, Number(raw.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(raw.limit) || 20));
  const offset = (page - 1) * limit;

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM college_assessment_campaigns c
     JOIN college_assessments a ON a.id = c.assessment_id
     WHERE ${campFilter}`,
    campParams
  );

  const limIdx = params.length + 1;
  const offIdx = params.length + 2;
  const rows = await query<{
    assessment_name: string;
    campaign_name: string;
    campaign_status: string;
    campaign_id: string;
    assessment_id: string;
    assigned: string;
    attempted: string;
    avg_score: string | null;
    passed: string;
    failed: string;
  }>(
    `SELECT a.name AS assessment_name, c.name AS campaign_name, c.status AS campaign_status,
            c.id AS campaign_id, a.id AS assessment_id,
            (SELECT COUNT(*)::text FROM college_campaign_students cs
              JOIN users u ON u.id = cs.user_id
              LEFT JOIN student_details sd ON sd.user_id = u.id
              WHERE cs.campaign_id = c.id AND ${deptClause(deptIdx)}
            ) AS assigned,
            (SELECT COUNT(*)::text FROM college_campaign_attempts att
              JOIN users u ON u.id = att.user_id
              LEFT JOIN student_details sd ON sd.user_id = u.id
              WHERE att.campaign_id = c.id AND att.status IN ('submitted','expired')
                AND ${deptClause(deptIdx)}
            ) AS attempted,
            (SELECT ROUND(AVG(e.percentage)::numeric, 2)::text
              FROM college_campaign_evaluations e
              JOIN college_campaign_attempts att ON att.id = e.attempt_id
              JOIN users u ON u.id = e.user_id
              LEFT JOIN student_details sd ON sd.user_id = u.id
              WHERE e.campaign_id = c.id AND att.status IN ('submitted','expired')
                AND ${deptClause(deptIdx)}
            ) AS avg_score,
            (SELECT COUNT(*)::text FROM college_campaign_evaluations e
              JOIN users u ON u.id = e.user_id
              LEFT JOIN student_details sd ON sd.user_id = u.id
              WHERE e.campaign_id = c.id AND e.passed IS TRUE
                AND ${deptClause(deptIdx)}
            ) AS passed,
            (SELECT COUNT(*)::text FROM college_campaign_evaluations e
              JOIN users u ON u.id = e.user_id
              LEFT JOIN student_details sd ON sd.user_id = u.id
              WHERE e.campaign_id = c.id AND e.passed IS FALSE
                AND ${deptClause(deptIdx)}
            ) AS failed
     FROM college_assessment_campaigns c
     JOIN college_assessments a ON a.id = c.assessment_id
     WHERE ${campFilter}
     ORDER BY c.start_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    [...params, limit, offset]
  );

  const data = rows.map((r) => {
    const assigned = Number(r.assigned);
    const attempted = Number(r.attempted);
    const p = Number(r.passed);
    const f = Number(r.failed);
    const den = p + f;
    return {
      assessment_name: r.assessment_name,
      campaign: r.campaign_name,
      campaign_id: r.campaign_id,
      assessment_id: r.assessment_id,
      total_assigned: assigned,
      total_attempted: attempted,
      completion_pct: assigned > 0 ? round2((attempted / assigned) * 100) : 0,
      average_score: Number(r.avg_score || 0),
      pass_pct: den > 0 ? round2((p / den) * 100) : 0,
      status: r.campaign_status,
    };
  });

  return {
    data,
    pagination: {
      total: Number(countRow?.total || 0),
      page,
      limit,
      pages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit) || 1),
    },
  };
}

export async function getStudentPerformance(
  collegeId: string,
  actor: AnalyticsActor,
  raw: AnalyticsFilters
) {
  await ensureEvaluationSchema();
  const forced = await resolveForcedDepartment(actor.id, actor.role);
  const dept = forced || sanitize(raw.department);
  const assessmentId = sanitize(raw.assessment_id);
  const campaignId = sanitize(raw.campaign_id);
  const year = sanitize(raw.academic_year);
  const search = sanitize(raw.search);
  const result = raw.result === "pass" || raw.result === "fail" ? raw.result : null;
  const dateFrom = sanitize(raw.date_from);
  const dateTo = sanitize(raw.date_to);
  const page = Math.max(1, Number(raw.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(raw.limit) || 20));
  const offset = (page - 1) * limit;

  const params: unknown[] = [collegeId];
  let i = 2;
  let where = `
    c.college_id = $1 AND c.deleted_at IS NULL
    AND c.status IN ('published','closed','archived')
    AND a.deleted_at IS NULL AND a.status = 'published'
    AND att.status IN ('submitted','expired')
  `;
  if (assessmentId) {
    where += ` AND a.id = $${i++}`;
    params.push(assessmentId);
  }
  if (campaignId) {
    where += ` AND c.id = $${i++}`;
    params.push(campaignId);
  }
  if (year) {
    where += ` AND EXTRACT(YEAR FROM c.start_at)::text = $${i++}`;
    params.push(year);
  }
  if (search) {
    where += ` AND (u.name ILIKE $${i} OR a.name ILIKE $${i})`;
    params.push(`%${search}%`);
    i++;
  }
  if (dept) {
    where += ` AND COALESCE(NULLIF(TRIM(sd.specialization),''),'Unspecified') ILIKE $${i++}`;
    params.push(`%${dept}%`);
  }
  if (result === "pass") where += ` AND e.passed IS TRUE`;
  if (result === "fail") where += ` AND e.passed IS FALSE`;
  if (dateFrom) {
    where += ` AND att.submitted_at >= $${i++}::timestamptz`;
    params.push(dateFrom);
  }
  if (dateTo) {
    where += ` AND att.submitted_at <= $${i++}::timestamptz`;
    params.push(dateTo);
  }

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total
     FROM college_campaign_attempts att
     JOIN college_assessment_campaigns c ON c.id = att.campaign_id
     JOIN college_assessments a ON a.id = c.assessment_id
     JOIN users u ON u.id = att.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN college_campaign_evaluations e ON e.attempt_id = att.id
     WHERE ${where}`,
    params
  );

  const rows = await query<{
    student_name: string;
    department: string;
    assessment_name: string;
    obtained_marks: number | null;
    percentage: number | null;
    passed: boolean | null;
    attempt_number: number;
    submitted_at: string | null;
  }>(
    `SELECT u.name AS student_name,
            COALESCE(NULLIF(TRIM(sd.specialization),''),'Unspecified') AS department,
            a.name AS assessment_name,
            e.obtained_marks::float AS obtained_marks,
            e.percentage::float AS percentage,
            e.passed,
            att.attempt_number,
            att.submitted_at::text
     FROM college_campaign_attempts att
     JOIN college_assessment_campaigns c ON c.id = att.campaign_id
     JOIN college_assessments a ON a.id = c.assessment_id
     JOIN users u ON u.id = att.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN college_campaign_evaluations e ON e.attempt_id = att.id
     WHERE ${where}
     ORDER BY att.submitted_at DESC NULLS LAST
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  return {
    data: rows.map((r) => ({
      student_name: r.student_name,
      department: r.department,
      assessment: r.assessment_name,
      score: r.obtained_marks,
      percentage: r.percentage,
      result: r.passed === true ? "Pass" : r.passed === false ? "Fail" : "—",
      attempt_number: r.attempt_number,
      submitted_on: r.submitted_at,
    })),
    pagination: {
      total: Number(countRow?.total || 0),
      page,
      limit,
      pages: Math.max(1, Math.ceil(Number(countRow?.total || 0) / limit) || 1),
    },
  };
}

export async function getDepartmentPerformance(
  collegeId: string,
  actor: AnalyticsActor,
  raw: AnalyticsFilters
) {
  await ensureEvaluationSchema();
  const forced = await resolveForcedDepartment(actor.id, actor.role);
  const scope = buildScope(collegeId, forced, raw, {
    includeSearchOnAssessment: true,
    includeDateResult: false,
  });
  const { campFilter, params, deptIdx } = scope;

  const rows = await query<{
    department: string;
    assigned: string;
    attempted: string;
    avg_score: string | null;
    passed: string;
    failed: string;
  }>(
    `WITH scoped AS (
       SELECT c.id AS campaign_id FROM college_assessment_campaigns c
       JOIN college_assessments a ON a.id = c.assessment_id
       WHERE ${campFilter}
     ),
     base AS (
       SELECT COALESCE(NULLIF(TRIM(sd.specialization),''),'Unspecified') AS department,
              cs.user_id, cs.campaign_id
       FROM college_campaign_students cs
       JOIN scoped s ON s.campaign_id = cs.campaign_id
       JOIN users u ON u.id = cs.user_id
       LEFT JOIN student_details sd ON sd.user_id = u.id
       WHERE ${deptClause(deptIdx)}
     )
     SELECT b.department,
            COUNT(DISTINCT b.user_id)::text AS assigned,
            COUNT(DISTINCT att.user_id) FILTER (WHERE att.status IN ('submitted','expired'))::text AS attempted,
            ROUND(AVG(e.percentage)::numeric, 2)::text AS avg_score,
            COUNT(*) FILTER (WHERE e.passed IS TRUE)::text AS passed,
            COUNT(*) FILTER (WHERE e.passed IS FALSE)::text AS failed
     FROM base b
     LEFT JOIN college_campaign_attempts att
       ON att.campaign_id = b.campaign_id AND att.user_id = b.user_id
     LEFT JOIN college_campaign_evaluations e ON e.attempt_id = att.id
     GROUP BY b.department
     ORDER BY AVG(e.percentage) DESC NULLS LAST`,
    params
  );

  return {
    data: rows.map((r) => {
      const assigned = Number(r.assigned);
      const attempted = Number(r.attempted);
      const p = Number(r.passed);
      const f = Number(r.failed);
      const den = p + f;
      return {
        department: r.department,
        students_assigned: assigned,
        students_attempted: attempted,
        average_score: Number(r.avg_score || 0),
        pass_pct: den > 0 ? round2((p / den) * 100) : 0,
        completion_pct: assigned > 0 ? round2((attempted / assigned) * 100) : 0,
      };
    }),
  };
}

export async function exportAnalytics(
  collegeId: string,
  actor: AnalyticsActor,
  raw: AnalyticsFilters & { format?: string; report?: string }
) {
  const format = raw.format === "pdf" ? "pdf" : "xlsx";
  const report = (raw.report || "summary") as AnalyticsReportType;

  await ensureEvaluationSchema();

  // Load only sheets required for the selected report (keeps export fast).
  const needAssessments =
    report === "summary" || report === "assessment" || report === "campaign";
  const needStudents = report === "summary" || report === "student";
  const needDepartments = report === "summary" || report === "department" || format === "pdf";

  const dash = await getDashboard(collegeId, actor, raw);
  const assessments = needAssessments
    ? await getAssessmentPerformance(collegeId, actor, { ...raw, page: 1, limit: 500 })
    : { data: [] as Awaited<ReturnType<typeof getAssessmentPerformance>>["data"] };
  const students = needStudents
    ? await getStudentPerformance(collegeId, actor, { ...raw, page: 1, limit: 1000 })
    : { data: [] as Awaited<ReturnType<typeof getStudentPerformance>>["data"] };
  const departments = needDepartments
    ? await getDepartmentPerformance(collegeId, actor, raw)
    : { data: [] as Awaited<ReturnType<typeof getDepartmentPerformance>>["data"] };

  let result: { buffer: Buffer; filename: string; contentType: string };

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([dash.summary]), "Summary");
    if (needAssessments) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(assessments.data),
        "Assessments"
      );
    }
    if (needStudents) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(students.data), "Students");
    }
    if (needDepartments) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(departments.data),
        "Departments"
      );
    }
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    result = {
      buffer,
      filename: `assessment-${report}-analytics.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  } else {
    const lines = [
      "Assessment Analytics Report",
      `Report: ${report}`,
      "",
      "— Summary —",
      `Total assessments: ${dash.summary.total_assessments}`,
      `Published: ${dash.summary.published_assessments}`,
      `Active campaigns: ${dash.summary.active_campaigns}`,
      `Completed attempts: ${dash.summary.completed_attempts}`,
      `Average score: ${dash.summary.average_score}%`,
      `Pass %: ${dash.summary.overall_pass_percentage}%`,
      "",
      "— Department (top) —",
      ...departments.data
        .slice(0, 10)
        .map(
          (d) =>
            `${d.department}: avg ${d.average_score}% · pass ${d.pass_pct}% · completion ${d.completion_pct}%`
        ),
      "",
      "— Assessment performance (top) —",
      ...assessments.data
        .slice(0, 10)
        .map(
          (a) =>
            `${a.assessment_name} / ${a.campaign}: attempted ${a.total_attempted}/${a.total_assigned} · pass ${a.pass_pct}%`
        ),
    ];

    result = {
      buffer: buildSimpleReportPdf({
        title: "Assessment Analytics Report",
        subtitle: report,
        lines,
      }),
      filename: `assessment-${report}-analytics.pdf`,
      contentType: "application/pdf",
    };
  }

  void writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_ANALYTICS_EXPORT",
    target_type: "college_assessment_analytics",
    target_id: collegeId,
    reason: `Exported ${report} as ${format}`,
    metadata: { report, format, filters: dash.filters_applied },
    ip_address: actor.ip,
  }).catch(() => {});

  return result;
}
