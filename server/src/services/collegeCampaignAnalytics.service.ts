/**
 * Phase 2 Module 08 — Analytics & Reports (reads evaluation + attempt data).
 * Separate from attempt workspace and evaluation scoring engines.
 */
import * as XLSX from "xlsx";
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureEvaluationSchema } from "./collegeCampaignEvaluation.service.js";
import { buildSimpleReportPdf } from "../utils/simpleReportPdf.js";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function assertCampaign(collegeId: string, campaignId: string) {
  const row = await queryOne<{
    id: string;
    name: string;
    campaign_code: string;
    start_at: string;
    end_at: string;
    duration_minutes: number | null;
    max_attempts: number;
    assessment_name: string;
    passing_marks: number;
    total_marks: number;
  }>(
    `SELECT c.id, c.name, c.campaign_code, c.start_at::text, c.end_at::text,
            c.duration_minutes, c.max_attempts,
            a.name AS assessment_name,
            a.passing_marks::float AS passing_marks,
            a.total_marks::float AS total_marks
     FROM college_assessment_campaigns c
     JOIN college_assessments a ON a.id = c.assessment_id
     WHERE c.id = $1 AND c.college_id = $2 AND c.deleted_at IS NULL`,
    [campaignId, collegeId]
  );
  if (!row) throw new AppError("Campaign not found.", 404);
  return row;
}

export async function getCampaignAnalytics(collegeId: string, campaignId: string) {
  await ensureEvaluationSchema();
  const campaign = await assertCampaign(collegeId, campaignId);

  const attemptStats = await queryOne<{
    assigned: string;
    started: string;
    submitted: string;
    expired: string;
    in_progress: string;
    avg_minutes: string | null;
    median_minutes: string | null;
    min_minutes: string | null;
    max_minutes: string | null;
  }>(
    `SELECT
       (SELECT COUNT(*)::text FROM college_campaign_students WHERE campaign_id = $1) AS assigned,
       COUNT(*) FILTER (WHERE started_at IS NOT NULL)::text AS started,
       COUNT(*) FILTER (WHERE status = 'submitted')::text AS submitted,
       COUNT(*) FILTER (WHERE status = 'expired')::text AS expired,
       COUNT(*) FILTER (WHERE status = 'in_progress')::text AS in_progress,
       ROUND(AVG(EXTRACT(EPOCH FROM (submitted_at - started_at)) / 60.0)
         FILTER (WHERE submitted_at IS NOT NULL AND started_at IS NOT NULL))::text AS avg_minutes,
       (
         SELECT ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
           ORDER BY EXTRACT(EPOCH FROM (a2.submitted_at - a2.started_at)) / 60.0
         ))::text
         FROM college_campaign_attempts a2
         WHERE a2.campaign_id = $1
           AND a2.submitted_at IS NOT NULL AND a2.started_at IS NOT NULL
       ) AS median_minutes,
       ROUND(MIN(EXTRACT(EPOCH FROM (submitted_at - started_at)) / 60.0)
         FILTER (WHERE submitted_at IS NOT NULL AND started_at IS NOT NULL))::text AS min_minutes,
       ROUND(MAX(EXTRACT(EPOCH FROM (submitted_at - started_at)) / 60.0)
         FILTER (WHERE submitted_at IS NOT NULL AND started_at IS NOT NULL))::text AS max_minutes
     FROM college_campaign_attempts
     WHERE campaign_id = $1`,
    [campaignId]
  );

  const evalSummary = await queryOne<{
    evaluated: string;
    published: string;
    passed: string;
    failed: string;
    avg_score: string | null;
    avg_pct: string | null;
    needs_manual: string;
  }>(
    `SELECT
       COUNT(*)::text AS evaluated,
       COUNT(*) FILTER (WHERE status = 'published')::text AS published,
       COUNT(*) FILTER (WHERE passed IS TRUE)::text AS passed,
       COUNT(*) FILTER (WHERE passed IS FALSE)::text AS failed,
       ROUND(AVG(obtained_marks)::numeric, 2)::text AS avg_score,
       ROUND(AVG(percentage)::numeric, 2)::text AS avg_pct,
       COUNT(*) FILTER (WHERE needs_manual_review)::text AS needs_manual
     FROM college_campaign_evaluations
     WHERE campaign_id = $1`,
    [campaignId]
  );

  const assigned = Number(attemptStats?.assigned || 0);
  const submitted =
    Number(attemptStats?.submitted || 0) + Number(attemptStats?.expired || 0);
  const evaluated = Number(evalSummary?.evaluated || 0);
  const passed = Number(evalSummary?.passed || 0);
  const failed = Number(evalSummary?.failed || 0);
  const passDenom = passed + failed;
  const pass_percentage = passDenom > 0 ? round2((passed / passDenom) * 100) : 0;
  const attempt_rate = assigned > 0 ? round2((submitted / assigned) * 100) : 0;

  const students = await query<{
    user_id: string;
    student_name: string;
    student_email: string;
    department: string | null;
    attempt_number: number;
    attempt_status: string;
    obtained_marks: number | null;
    total_marks: number | null;
    percentage: number | null;
    passed: boolean | null;
    eval_status: string | null;
    duration_minutes: number | null;
    submitted_at: string | null;
  }>(
    `SELECT u.id AS user_id, u.name AS student_name, u.email AS student_email,
            COALESCE(NULLIF(TRIM(sd.specialization), ''), 'Unspecified') AS department,
            att.attempt_number, att.status AS attempt_status,
            e.obtained_marks::float AS obtained_marks,
            e.total_marks::float AS total_marks,
            e.percentage::float AS percentage,
            e.passed, e.status AS eval_status,
            CASE WHEN att.submitted_at IS NOT NULL AND att.started_at IS NOT NULL
              THEN ROUND(EXTRACT(EPOCH FROM (att.submitted_at - att.started_at)) / 60.0)::int
              ELSE NULL END AS duration_minutes,
            att.submitted_at::text
     FROM college_campaign_attempts att
     JOIN users u ON u.id = att.user_id
     LEFT JOIN student_details sd ON sd.user_id = u.id
     LEFT JOIN college_campaign_evaluations e ON e.attempt_id = att.id
     WHERE att.campaign_id = $1
       AND att.status IN ('submitted', 'expired', 'in_progress')
     ORDER BY e.percentage DESC NULLS LAST, u.name ASC`,
    [campaignId]
  );

  const departments = await query<{
    department: string;
    students: string;
    avg_percentage: string | null;
    passed: string;
    failed: string;
  }>(
    `SELECT
       COALESCE(NULLIF(TRIM(sd.specialization), ''), 'Unspecified') AS department,
       COUNT(DISTINCT e.user_id)::text AS students,
       ROUND(AVG(e.percentage)::numeric, 2)::text AS avg_percentage,
       COUNT(*) FILTER (WHERE e.passed IS TRUE)::text AS passed,
       COUNT(*) FILTER (WHERE e.passed IS FALSE)::text AS failed
     FROM college_campaign_evaluations e
     LEFT JOIN student_details sd ON sd.user_id = e.user_id
     WHERE e.campaign_id = $1
     GROUP BY 1
     ORDER BY AVG(e.percentage) DESC NULLS LAST`,
    [campaignId]
  );

  const questions = await query<{
    question_id: string;
    title: string;
    question_type: string;
    difficulty: string;
    marks_possible: number;
    attempts: string;
    correct: string;
    incorrect: string;
    pending: string;
    avg_marks: string | null;
    accuracy_pct: string | null;
  }>(
    `SELECT qr.question_id, q.title, q.question_type, q.difficulty,
            AVG(qr.marks_possible)::float AS marks_possible,
            COUNT(*)::text AS attempts,
            COUNT(*) FILTER (WHERE qr.is_correct IS TRUE)::text AS correct,
            COUNT(*) FILTER (WHERE qr.is_correct IS FALSE)::text AS incorrect,
            COUNT(*) FILTER (WHERE qr.evaluation_status = 'pending_manual')::text AS pending,
            ROUND(AVG(qr.marks_awarded)::numeric, 2)::text AS avg_marks,
            ROUND(
              (100.0 * COUNT(*) FILTER (WHERE qr.is_correct IS TRUE)
                / NULLIF(COUNT(*) FILTER (WHERE qr.is_correct IS NOT NULL), 0)
              )::numeric, 2
            )::text AS accuracy_pct
     FROM college_campaign_question_results qr
     JOIN college_campaign_evaluations e ON e.id = qr.evaluation_id
     JOIN college_questions q ON q.id = qr.question_id
     WHERE e.campaign_id = $1
     GROUP BY qr.question_id, q.title, q.question_type, q.difficulty
     ORDER BY accuracy_pct ASC NULLS LAST, q.title ASC`,
    [campaignId]
  );

  const difficulty = await query<{
    difficulty: string;
    questions: string;
    attempts: string;
    accuracy_pct: string | null;
    avg_marks: string | null;
  }>(
    `SELECT COALESCE(q.difficulty, 'unknown') AS difficulty,
            COUNT(DISTINCT qr.question_id)::text AS questions,
            COUNT(*)::text AS attempts,
            ROUND(
              (100.0 * COUNT(*) FILTER (WHERE qr.is_correct IS TRUE)
                / NULLIF(COUNT(*) FILTER (WHERE qr.is_correct IS NOT NULL), 0)
              )::numeric, 2
            )::text AS accuracy_pct,
            ROUND(AVG(qr.marks_awarded)::numeric, 2)::text AS avg_marks
     FROM college_campaign_question_results qr
     JOIN college_campaign_evaluations e ON e.id = qr.evaluation_id
     JOIN college_questions q ON q.id = qr.question_id
     WHERE e.campaign_id = $1
     GROUP BY 1
     ORDER BY
       CASE COALESCE(q.difficulty, 'unknown')
         WHEN 'easy' THEN 1 WHEN 'medium' THEN 2 WHEN 'hard' THEN 3 ELSE 4 END`,
    [campaignId]
  );

  const timeBuckets = await query<{
    bucket: string;
    count: string;
  }>(
    `SELECT bucket, COUNT(*)::text AS count FROM (
       SELECT CASE
         WHEN mins < 10 THEN '0-10 min'
         WHEN mins < 20 THEN '10-20 min'
         WHEN mins < 30 THEN '20-30 min'
         WHEN mins < 45 THEN '30-45 min'
         WHEN mins < 60 THEN '45-60 min'
         ELSE '60+ min'
       END AS bucket,
       CASE
         WHEN mins < 10 THEN 1
         WHEN mins < 20 THEN 2
         WHEN mins < 30 THEN 3
         WHEN mins < 45 THEN 4
         WHEN mins < 60 THEN 5
         ELSE 6
       END AS ord
       FROM (
         SELECT EXTRACT(EPOCH FROM (submitted_at - started_at)) / 60.0 AS mins
         FROM college_campaign_attempts
         WHERE campaign_id = $1
           AND submitted_at IS NOT NULL AND started_at IS NOT NULL
       ) t
     ) b
     GROUP BY bucket, ord
     ORDER BY ord`,
    [campaignId]
  );

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      campaign_code: campaign.campaign_code,
      assessment_name: campaign.assessment_name,
      passing_marks: campaign.passing_marks,
      total_marks: campaign.total_marks,
      duration_minutes: campaign.duration_minutes,
      max_attempts: campaign.max_attempts,
      window_start: campaign.start_at,
      window_end: campaign.end_at,
    },
    assessment_summary: {
      assigned,
      started: Number(attemptStats?.started || 0),
      submitted,
      evaluated,
      published: Number(evalSummary?.published || 0),
      needs_manual_review: Number(evalSummary?.needs_manual || 0),
      avg_score: Number(evalSummary?.avg_score || 0),
      avg_percentage: Number(evalSummary?.avg_pct || 0),
      pass_percentage,
      attempt_rate,
      passed,
      failed,
    },
    attempt_statistics: {
      assigned,
      started: Number(attemptStats?.started || 0),
      in_progress: Number(attemptStats?.in_progress || 0),
      submitted: Number(attemptStats?.submitted || 0),
      expired: Number(attemptStats?.expired || 0),
      completion_rate: attempt_rate,
    },
    time_analysis: {
      avg_minutes: Number(attemptStats?.avg_minutes || 0),
      median_minutes: Number(attemptStats?.median_minutes || 0),
      min_minutes: Number(attemptStats?.min_minutes || 0),
      max_minutes: Number(attemptStats?.max_minutes || 0),
      configured_duration_minutes: campaign.duration_minutes,
      buckets: timeBuckets.map((b) => ({
        bucket: b.bucket,
        count: Number(b.count),
      })),
    },
    student_performance: students.map((s) => ({
      user_id: s.user_id,
      name: s.student_name,
      email: s.student_email,
      department: s.department || "Unspecified",
      attempt_number: s.attempt_number,
      attempt_status: s.attempt_status,
      obtained_marks: s.obtained_marks,
      total_marks: s.total_marks,
      percentage: s.percentage,
      passed: s.passed,
      evaluation_status: s.eval_status,
      duration_minutes: s.duration_minutes,
      submitted_at: s.submitted_at,
    })),
    department_performance: departments.map((d) => {
      const p = Number(d.passed);
      const f = Number(d.failed);
      const den = p + f;
      return {
        department: d.department,
        students: Number(d.students),
        avg_percentage: Number(d.avg_percentage || 0),
        passed: p,
        failed: f,
        pass_percentage: den > 0 ? round2((p / den) * 100) : 0,
      };
    }),
    question_analysis: questions.map((q) => ({
      question_id: q.question_id,
      title: q.title,
      question_type: q.question_type,
      difficulty: q.difficulty,
      marks_possible: Number(q.marks_possible || 0),
      attempts: Number(q.attempts),
      correct: Number(q.correct),
      incorrect: Number(q.incorrect),
      pending: Number(q.pending),
      avg_marks: Number(q.avg_marks || 0),
      accuracy_pct: Number(q.accuracy_pct || 0),
    })),
    difficulty_analysis: difficulty.map((d) => ({
      difficulty: d.difficulty,
      questions: Number(d.questions),
      attempts: Number(d.attempts),
      accuracy_pct: Number(d.accuracy_pct || 0),
      avg_marks: Number(d.avg_marks || 0),
    })),
  };
}

export type CampaignAnalytics = Awaited<ReturnType<typeof getCampaignAnalytics>>;

export async function exportCampaignAnalytics(
  collegeId: string,
  campaignId: string,
  format: "xlsx" | "pdf"
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const report = await getCampaignAnalytics(collegeId, campaignId);
  const code = report.campaign.campaign_code || "campaign";

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet([
        {
          Campaign: report.campaign.name,
          Code: report.campaign.campaign_code,
          Assessment: report.campaign.assessment_name,
          Assigned: report.assessment_summary.assigned,
          Submitted: report.assessment_summary.submitted,
          Evaluated: report.assessment_summary.evaluated,
          Pass_Percentage: report.assessment_summary.pass_percentage,
          Avg_Percentage: report.assessment_summary.avg_percentage,
          Avg_Score: report.assessment_summary.avg_score,
        },
      ]),
      "Summary"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.student_performance.map((s) => ({
          Name: s.name,
          Email: s.email,
          Department: s.department,
          Attempt: s.attempt_number,
          Status: s.attempt_status,
          Score: s.obtained_marks,
          Total: s.total_marks,
          Percentage: s.percentage,
          Passed: s.passed,
          Duration_Minutes: s.duration_minutes,
          Submitted_At: s.submitted_at,
        }))
      ),
      "Students"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.department_performance.map((d) => ({
          Department: d.department,
          Students: d.students,
          Avg_Percentage: d.avg_percentage,
          Passed: d.passed,
          Failed: d.failed,
          Pass_Percentage: d.pass_percentage,
        }))
      ),
      "Departments"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.question_analysis.map((q) => ({
          Title: q.title,
          Type: q.question_type,
          Difficulty: q.difficulty,
          Attempts: q.attempts,
          Correct: q.correct,
          Incorrect: q.incorrect,
          Accuracy_Pct: q.accuracy_pct,
          Avg_Marks: q.avg_marks,
        }))
      ),
      "Questions"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.difficulty_analysis.map((d) => ({
          Difficulty: d.difficulty,
          Questions: d.questions,
          Attempts: d.attempts,
          Accuracy_Pct: d.accuracy_pct,
          Avg_Marks: d.avg_marks,
        }))
      ),
      "Difficulty"
    );

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.time_analysis.buckets.map((b) => ({
          Bucket: b.bucket,
          Count: b.count,
        }))
      ),
      "Time"
    );

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return {
      buffer,
      filename: `${code}-analytics.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  // PDF summary report
  const lines = [
    `Campaign: ${report.campaign.name} (${report.campaign.campaign_code})`,
    `Assessment: ${report.campaign.assessment_name}`,
    "",
    "— Assessment Summary —",
    `Assigned: ${report.assessment_summary.assigned}`,
    `Submitted: ${report.assessment_summary.submitted}`,
    `Evaluated: ${report.assessment_summary.evaluated}`,
    `Pass %: ${report.assessment_summary.pass_percentage}%`,
    `Avg %: ${report.assessment_summary.avg_percentage}%`,
    `Avg score: ${report.assessment_summary.avg_score}`,
    `Passed / Failed: ${report.assessment_summary.passed} / ${report.assessment_summary.failed}`,
    "",
    "— Attempt Statistics —",
    `Started: ${report.attempt_statistics.started}`,
    `In progress: ${report.attempt_statistics.in_progress}`,
    `Expired: ${report.attempt_statistics.expired}`,
    `Completion rate: ${report.attempt_statistics.completion_rate}%`,
    "",
    "— Time Analysis —",
    `Avg / Median minutes: ${report.time_analysis.avg_minutes} / ${report.time_analysis.median_minutes}`,
    `Min / Max minutes: ${report.time_analysis.min_minutes} / ${report.time_analysis.max_minutes}`,
    "",
    "— Department Performance —",
    ...report.department_performance.slice(0, 12).map(
      (d) =>
        `${d.department}: avg ${d.avg_percentage}% · pass ${d.pass_percentage}% (${d.students} students)`
    ),
    "",
    "— Difficulty Analysis —",
    ...report.difficulty_analysis.map(
      (d) =>
        `${d.difficulty}: accuracy ${d.accuracy_pct}% · ${d.questions} questions`
    ),
    "",
    "— Top / Bottom Questions (by accuracy) —",
    ...[...report.question_analysis]
      .sort((a, b) => a.accuracy_pct - b.accuracy_pct)
      .slice(0, 8)
      .map((q) => `${q.accuracy_pct}% · ${q.title.slice(0, 60)}`),
  ];

  const buffer = buildSimpleReportPdf({
    title: "Assessment Analytics Report",
    subtitle: report.campaign.name,
    lines,
  });

  return {
    buffer,
    filename: `${code}-analytics.pdf`,
    contentType: "application/pdf",
  };
}
