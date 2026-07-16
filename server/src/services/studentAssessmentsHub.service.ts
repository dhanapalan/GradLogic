/**
 * Student Portal Module 05 — My Assessments facade.
 * Thin adapters over studentAssessmentWorkspace + evaluation/calendar.
 * No scheduling, scoring, or campaign configuration logic.
 */
import { query } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import * as workspace from "./studentAssessmentWorkspace.service.js";
import * as evaluation from "./collegeCampaignEvaluation.service.js";
import * as dashboard from "./studentDashboard.service.js";
import * as notificationService from "./notification.service.js";

const BASE = "/app/student-portal/my-assessments";

export type HubFilters = {
  search?: string;
  assessment_type?: string;
  subject?: string;
  campaign?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  sort?: string;
};

function enrich(row: workspace.MyAssessmentRow) {
  const attemptsRemaining = Math.max(0, (row.max_attempts || 0) - (row.attempts_used || 0));
  return {
    ...row,
    subject: row.assessment_type?.replace(/_/g, " ") || null,
    attempts_remaining: attemptsRemaining,
    launch_href: `${BASE}/${row.campaign_id}/instructions`,
    resume_href: `${BASE}/${row.campaign_id}/attempt`,
    result_href: `${BASE}/${row.campaign_id}/result`,
    details_href: `${BASE}/${row.campaign_id}`,
    display_status:
      row.status === "available"
        ? "live"
        : row.status === "submitted"
          ? "completed"
          : row.status === "expired"
            ? "missed"
            : row.status,
  };
}

async function listByStatus(
  studentId: string,
  status: string | undefined,
  filters: HubFilters,
  extra?: { assessment_type?: string }
) {
  const result = await workspace.listMyAssessments(studentId, {
    search: filters.search || filters.campaign || filters.subject,
    status,
    assessment_type: extra?.assessment_type || filters.assessment_type,
    date_from: filters.date_from,
    date_to: filters.date_to,
    page: filters.page,
    limit: filters.limit,
  });
  let data = result.data.map(enrich);
  data = sortRows(data, filters.sort);
  return { data, pagination: result.pagination };
}

function sortRows<T extends ReturnType<typeof enrich>>(rows: T[], sort?: string) {
  const s = (sort || "upcoming_first").toLowerCase();
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (s) {
      case "recently_completed":
        return String(b.completed_at || "").localeCompare(String(a.completed_at || ""));
      case "due_soon":
        return String(a.available_until || "").localeCompare(String(b.available_until || ""));
      case "alphabetical":
        return a.assessment_name.localeCompare(b.assessment_name);
      case "highest_score": {
        const ap = Number((a as { percentage?: number | null }).percentage) || -1;
        const bp = Number((b as { percentage?: number | null }).percentage) || -1;
        return bp - ap;
      }
      case "upcoming_first":
      default:
        return String(a.available_from || "").localeCompare(String(b.available_from || ""));
    }
  });
  return copy;
}

/** GET /assessments/dashboard */
export async function getDashboard(studentId: string) {
  const [all, upcoming, live, inProgress, completed, missed, practice, results] =
    await Promise.all([
      workspace.listMyAssessments(studentId, { limit: 100, page: 1 }),
      workspace.listMyAssessments(studentId, { status: "upcoming", limit: 100, page: 1 }),
      workspace.listMyAssessments(studentId, { status: "available", limit: 100, page: 1 }),
      workspace.listMyAssessments(studentId, { status: "in_progress", limit: 100, page: 1 }),
      workspace.listMyAssessments(studentId, { status: "submitted", limit: 100, page: 1 }),
      workspace.listMyAssessments(studentId, { status: "expired", limit: 100, page: 1 }),
      workspace.listMyAssessments(studentId, {
        assessment_type: "practice_test",
        limit: 100,
        page: 1,
      }),
      dashboard.getRecentResults(studentId, 50).catch(() => []),
    ]);

  const scores = results.map((r) => Number(r.percentage) || 0).filter((n) => n >= 0);
  const avg =
    scores.length > 0 ? Math.round(scores.reduce((s, n) => s + n, 0) / scores.length) : null;

  const pendingResults = completed.data.filter((c) => {
    // submitted but no published result in recent list
    return !results.some((r) => r.campaign_id === c.campaign_id);
  }).length;

  return {
    summary: {
      total_assigned: all.pagination.total,
      upcoming: upcoming.pagination.total,
      active: live.pagination.total + inProgress.pagination.total,
      live: live.pagination.total,
      in_progress: inProgress.pagination.total,
      completed: completed.pagination.total,
      missed: missed.pagination.total,
      practice: practice.pagination.total,
      average_score: avg,
      pending_results: pendingResults,
    },
    upcoming_preview: upcoming.data.slice(0, 5).map(enrich),
    live_preview: live.data.slice(0, 5).map(enrich),
    in_progress_preview: inProgress.data.slice(0, 5).map(enrich),
  };
}

export async function listAssigned(studentId: string, filters: HubFilters) {
  return listByStatus(studentId, undefined, filters);
}

export async function listUpcoming(studentId: string, filters: HubFilters) {
  return listByStatus(studentId, "upcoming", filters);
}

export async function listLive(studentId: string, filters: HubFilters) {
  return listByStatus(studentId, "available", filters);
}

async function loadInProgressAttemptMeta(studentId: string, campaignIds: string[]) {
  if (!campaignIds.length) return new Map<string, {
    time_remaining_seconds: number;
    questions_attempted: number;
    progress_percent: number;
    last_activity: string;
    auto_save_status: string;
  }>();
  const rows = await query<{
    campaign_id: string;
    time_remaining_seconds: number;
    last_saved_at: string;
    questions_attempted: string;
    total_questions: number;
  }>(
    `SELECT att.campaign_id,
            att.time_remaining_seconds,
            att.last_saved_at::text,
            COUNT(ans.question_id) FILTER (
              WHERE jsonb_array_length(COALESCE(ans.selected, '[]'::jsonb)) > 0
            )::text AS questions_attempted,
            a.total_questions
     FROM college_campaign_attempts att
     JOIN college_assessment_campaigns c ON c.id = att.campaign_id
     JOIN college_assessments a ON a.id = c.assessment_id
     LEFT JOIN college_campaign_attempt_answers ans ON ans.attempt_id = att.id
     WHERE att.user_id = $1
       AND att.status = 'in_progress'
       AND att.campaign_id = ANY($2::uuid[])
     GROUP BY att.campaign_id, att.time_remaining_seconds, att.last_saved_at, a.total_questions`,
    [studentId, campaignIds]
  ).catch(() => []);

  const map = new Map<string, {
    time_remaining_seconds: number;
    questions_attempted: number;
    progress_percent: number;
    last_activity: string;
    auto_save_status: string;
  }>();
  for (const r of rows) {
    const attempted = Number(r.questions_attempted) || 0;
    const total = Math.max(1, Number(r.total_questions) || 1);
    const savedMs = Date.now() - new Date(r.last_saved_at).getTime();
    map.set(r.campaign_id, {
      time_remaining_seconds: Number(r.time_remaining_seconds) || 0,
      questions_attempted: attempted,
      progress_percent: Math.min(100, Math.round((attempted / total) * 100)),
      last_activity: r.last_saved_at,
      auto_save_status: savedMs <= 60_000 ? "Saved" : "Pending sync",
    });
  }
  return map;
}

export async function listInProgress(studentId: string, filters: HubFilters) {
  const listed = await listByStatus(studentId, "in_progress", filters);
  const meta = await loadInProgressAttemptMeta(
    studentId,
    listed.data.map((r) => r.campaign_id)
  );
  return {
    ...listed,
    data: listed.data.map((row) => ({
      ...row,
      ...meta.get(row.campaign_id),
    })),
  };
}

export async function listCompleted(studentId: string, filters: HubFilters) {
  const listed = await listByStatus(studentId, "submitted", filters);
  const results = await dashboard.getRecentResults(studentId, 100).catch(() => []);
  const byCampaign = new Map(results.map((r) => [r.campaign_id, r]));
  const merged = listed.data.map((row) => {
    const r = byCampaign.get(row.campaign_id);
    return {
      ...row,
      score: r?.score ?? null,
      total_marks: r?.total_marks ?? null,
      percentage: r?.percentage ?? null,
      passed: r?.passed ?? null,
      rank: r?.rank ?? null,
      result_published: Boolean(r),
    };
  });
  return {
    ...listed,
    data: sortRows(merged, filters.sort),
  };
}

export async function listMissed(studentId: string, filters: HubFilters) {
  const listed = await listByStatus(studentId, "expired", filters);
  return {
    ...listed,
    data: listed.data.map((row) => ({
      ...row,
      reason: row.start_blocked_reason || "Assessment window ended without a completed attempt.",
    })),
  };
}

export async function listPractice(studentId: string, filters: HubFilters) {
  return listByStatus(studentId, undefined, filters, { assessment_type: "practice_test" });
}

/** Detail = workspace row + instructions fields. Path id is campaign assignment id. */
export async function getAssessment(studentId: string, campaignId: string) {
  const [row, instructions] = await Promise.all([
    workspace.getMyAssessment(studentId, campaignId),
    workspace.getInstructions(studentId, campaignId).catch(() => null),
  ]);
  return {
    ...enrich(row),
    ...(instructions || {}),
    description: instructions?.instructions || row.instructions,
    rules: {
      negative_marking: instructions?.negative_marking ?? false,
      shuffle_questions: instructions?.shuffle_questions ?? false,
      shuffle_options: instructions?.shuffle_options ?? false,
      allow_resume: instructions?.allow_resume ?? true,
      show_result_immediately: instructions?.show_result_immediately ?? false,
    },
    eligibility: {
      can_start: row.can_start,
      can_resume: row.can_resume,
      message: row.start_blocked_reason || null,
    },
  };
}

export async function listAttempts(studentId: string, campaignId: string) {
  // Ensure student is assigned
  await workspace.getMyAssessment(studentId, campaignId);

  const rows = await query<{
    id: string;
    attempt_number: number;
    status: string;
    started_at: string | null;
    submitted_at: string | null;
    time_spent_seconds: number | null;
    submission_type: string | null;
  }>(
    `SELECT id, attempt_number, status,
            started_at::text, submitted_at::text,
            CASE WHEN started_at IS NULL THEN NULL
                 ELSE EXTRACT(EPOCH FROM (COALESCE(submitted_at, NOW()) - started_at))::int
            END AS time_spent_seconds,
            CASE
              WHEN status = 'auto_submitted' THEN 'auto'
              WHEN status IN ('submitted', 'completed') THEN 'manual'
              ELSE status
            END AS submission_type
     FROM college_campaign_attempts
     WHERE campaign_id = $1 AND user_id = $2
     ORDER BY attempt_number ASC`,
    [campaignId, studentId]
  ).catch(() => []);

  let published: { obtained_marks?: number; percentage?: number } | null = null;
  try {
    published = (await evaluation.getStudentResult(studentId, campaignId)) as {
      obtained_marks?: number;
      percentage?: number;
    };
  } catch {
    published = null;
  }

  return rows.map((r) => ({
    attempt_id: r.id,
    attempt_number: r.attempt_number,
    start_time: r.started_at,
    end_time: r.submitted_at,
    duration_seconds: r.time_spent_seconds,
    status: r.status,
    submission_type: r.submission_type,
    score:
      published && /submit|complete/i.test(r.status) ? published.obtained_marks ?? null : null,
    percentage:
      published && /submit|complete/i.test(r.status) ? published.percentage ?? null : null,
  }));
}

/** POST launch — delegates to workspace start (validates eligibility). */
export async function launchAssessment(studentId: string, campaignId: string) {
  const data = await workspace.startAssessment(studentId, campaignId);
  return {
    ...data,
    campaign_id: campaignId,
    assessment_id: data.assessment_id,
    attempt_id: data.attempt_id,
    workspace_href: `${BASE}/${campaignId}/attempt`,
    instructions_href: `${BASE}/${campaignId}/instructions`,
  };
}

/** POST resume — same backend entry; rejects if nothing to resume. */
export async function resumeAssessment(studentId: string, campaignId: string) {
  const row = await workspace.getMyAssessment(studentId, campaignId);
  if (!row.can_resume && row.status !== "in_progress") {
    throw new AppError(row.start_blocked_reason || "No in-progress attempt to resume.", 400);
  }
  return launchAssessment(studentId, campaignId);
}

/** GET /calendar/assessments */
export async function getAssessmentCalendar(studentId: string, days = 60) {
  const events = await dashboard.getCalendarEvents(studentId, days);
  return events
    .filter((e) => e.type === "assessment")
    .map((e) => ({
      ...e,
      href: e.href || BASE,
    }));
}

/** GET /notifications/assessments — filter generic notifications when possible. */
export async function getAssessmentNotifications(studentId: string, limit = 20) {
  const notes = await notificationService.getUserNotifications(studentId, false, Math.min(limit * 3, 60));
  const filtered = notes.filter((n) => {
    const t = `${n.title || ""} ${n.message || ""} ${n.type || ""}`.toLowerCase();
    return /assess|exam|test|campaign|result|missed/.test(t);
  });
  return filtered.slice(0, limit).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    type: n.type,
    is_read: n.is_read,
    created_at: n.created_at,
    href: BASE,
  }));
}
