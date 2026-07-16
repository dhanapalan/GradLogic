/**
 * Phase 2 Module 06 — Student Assessment Workspace.
 * 06.1 My Assessments · 06.2 Instructions (+ start validation).
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureCampaignSchema } from "./collegeAssessmentCampaign.service.js";
import {
  DERIVED_STATUS_SQL,
  isUuid,
} from "./studentAssessmentWorkspace.rules.js";

export const MY_ASSESSMENT_STATUSES = [
  "upcoming",
  "available",
  "in_progress",
  "submitted",
  "expired",
] as const;
export type MyAssessmentStatus = (typeof MY_ASSESSMENT_STATUSES)[number];

export const ASSESSMENT_TYPES = [
  "practice_test",
  "mock_test",
  "placement_test",
] as const;

export interface MyAssessmentRow {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  total_questions: number;
  duration_minutes: number | null;
  passing_marks: number;
  max_attempts: number;
  attempts_used: number;
  available_from: string;
  available_until: string;
  instructions: string | null;
  status: MyAssessmentStatus;
  started_at: string | null;
  completed_at: string | null;
  can_start: boolean;
  can_resume: boolean;
  action: "view_details" | "start" | "resume" | "view_submission";
  /** Human-readable block reason when Start is not allowed */
  start_blocked_reason?: string | null;
}

export interface AssessmentInstructions extends MyAssessmentRow {
  assessment_code: string;
  total_marks: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  show_result_immediately: boolean;
  negative_marking: boolean;
}

function computeStatus(row: {
  start_at: Date;
  end_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  attempts_used: number;
  max_attempts: number;
}): MyAssessmentStatus {
  const now = new Date();
  // Window + active attempt first; terminal "submitted" only when attempts exhausted.
  // completed_at alone must not block retakes when max_attempts still allows more.
  if (now > row.end_at) return "expired";
  if (now < row.start_at) return "upcoming";
  if (row.started_at && !row.completed_at) return "in_progress";
  if (row.attempts_used >= row.max_attempts) return "submitted";
  return "available";
}

function actionFor(status: MyAssessmentStatus): MyAssessmentRow["action"] {
  if (status === "available") return "start";
  if (status === "in_progress") return "resume";
  if (status === "submitted") return "view_submission";
  return "view_details";
}

function startBlockedReason(status: MyAssessmentStatus, attemptsUsed: number, maxAttempts: number): string | null {
  if (status === "available" || status === "in_progress") return null;
  if (status === "upcoming") return "This assessment is not available yet. Check the start date/time.";
  if (status === "expired") return "The campaign window has ended. This assessment cannot be started.";
  if (status === "submitted") {
    return "You have used all allowed attempts for this assessment.";
  }
  return "This assessment is not available to start.";
}

function mapRow(r: {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  total_questions: number;
  duration_minutes: number | null;
  passing_marks?: number;
  max_attempts: number;
  attempts_used: number;
  start_at: string;
  end_at: string;
  instructions: string | null;
  started_at: string | null;
  completed_at: string | null;
  allow_resume?: boolean;
  derived_status?: string;
}): MyAssessmentRow {
  const max_attempts = Number(r.max_attempts || 1);
  const attempts_used = Number(r.attempts_used || 0);
  const allow_resume = r.allow_resume !== false;
  const status =
    r.derived_status &&
    (MY_ASSESSMENT_STATUSES as readonly string[]).includes(r.derived_status)
      ? (r.derived_status as MyAssessmentStatus)
      : computeStatus({
          start_at: new Date(r.start_at),
          end_at: new Date(r.end_at),
          started_at: r.started_at ? new Date(r.started_at) : null,
          completed_at: r.completed_at ? new Date(r.completed_at) : null,
          attempts_used,
          max_attempts,
        });
  return {
    campaign_id: r.campaign_id,
    campaign_code: r.campaign_code,
    campaign_name: r.campaign_name,
    assessment_id: r.assessment_id,
    assessment_name: r.assessment_name,
    assessment_type: r.assessment_type,
    total_questions: Number(r.total_questions || 0),
    duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : null,
    passing_marks: Number(r.passing_marks || 0),
    max_attempts,
    attempts_used,
    available_from: r.start_at,
    available_until: r.end_at,
    instructions: r.instructions,
    status,
    started_at: r.started_at,
    completed_at: r.completed_at,
    can_start: status === "available",
    can_resume: status === "in_progress" && allow_resume,
    action:
      status === "in_progress" && !allow_resume ? "view_details" : actionFor(status),
    start_blocked_reason:
      status === "in_progress" && !allow_resume
        ? "Resume is not allowed for this campaign."
        : startBlockedReason(status, attempts_used, max_attempts),
  };
}

const BASE_SELECT = `
  SELECT
    c.id AS campaign_id,
    c.campaign_code,
    c.name AS campaign_name,
    a.id AS assessment_id,
    a.assessment_code,
    a.name AS assessment_name,
    a.assessment_type,
    a.total_questions,
    a.total_marks::float AS total_marks,
    a.passing_marks::float AS passing_marks,
    COALESCE(c.duration_minutes, a.duration_minutes) AS duration_minutes,
    c.max_attempts,
    cs.attempts_used,
    c.start_at::text AS start_at,
    c.end_at::text AS end_at,
    COALESCE(c.instructions, a.instructions) AS instructions,
    c.shuffle_questions,
    c.shuffle_options,
    c.allow_resume,
    c.show_result_immediately,
    c.negative_marking,
    cs.started_at::text AS started_at,
    cs.completed_at::text AS completed_at
  FROM college_campaign_students cs
  JOIN college_assessment_campaigns c ON c.id = cs.campaign_id
  JOIN college_assessments a ON a.id = c.assessment_id
  WHERE cs.user_id = $1
    AND c.status = 'published'
    AND c.deleted_at IS NULL
    AND c.is_active = TRUE
    AND a.deleted_at IS NULL
`;

type RawAssignedRow = {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  assessment_id: string;
  assessment_code: string;
  assessment_name: string;
  assessment_type: string;
  total_questions: number;
  total_marks: number;
  passing_marks: number;
  duration_minutes: number | null;
  max_attempts: number;
  attempts_used: number;
  start_at: string;
  end_at: string;
  instructions: string | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  show_result_immediately: boolean;
  negative_marking: boolean;
  started_at: string | null;
  completed_at: string | null;
  derived_status?: string;
};

async function loadAssignedRaw(studentId: string, campaignId: string): Promise<RawAssignedRow> {
  if (!isUuid(campaignId)) {
    throw new AppError("Invalid campaign id.", 400);
  }
  await ensureCampaignSchema();
  const row = await queryOne<RawAssignedRow>(
    `${BASE_SELECT.replace(
      "cs.completed_at::text AS completed_at",
      `cs.completed_at::text AS completed_at,
    (${DERIVED_STATUS_SQL.trim()}) AS derived_status`
    )}
     AND c.id = $2`,
    [studentId, campaignId]
  );
  if (!row) throw new AppError("Assessment not found or not assigned to you.", 404);
  return row;
}

function toInstructions(row: RawAssignedRow): AssessmentInstructions {
  const base = mapRow(row);
  return {
    ...base,
    assessment_code: row.assessment_code,
    total_marks: Number(row.total_marks || 0),
    shuffle_questions: !!row.shuffle_questions,
    shuffle_options: !!row.shuffle_options,
    allow_resume: row.allow_resume !== false,
    show_result_immediately: !!row.show_result_immediately,
    negative_marking: !!row.negative_marking,
  };
}


export async function listMyAssessments(
  studentId: string,
  filters: {
    search?: string;
    status?: string;
    assessment_type?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }
) {
  await ensureCampaignSchema();
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(100, Math.max(1, filters.limit || 20));
  const offset = (page - 1) * limit;
  const params: unknown[] = [studentId];
  let i = 2;
  let where = "";

  if (filters.search?.trim()) {
    where += ` AND (a.name ILIKE $${i} OR c.name ILIKE $${i} OR c.campaign_code ILIKE $${i})`;
    params.push(`%${filters.search.trim()}%`);
    i++;
  }
  if (filters.assessment_type?.trim()) {
    const t = filters.assessment_type.trim().toLowerCase();
    if ((ASSESSMENT_TYPES as readonly string[]).includes(t)) {
      where += ` AND a.assessment_type = $${i++}`;
      params.push(t);
    }
  }
  if (filters.date_from?.trim()) {
    where += ` AND c.start_at >= $${i++}::timestamptz`;
    params.push(filters.date_from.trim());
  }
  if (filters.date_to?.trim()) {
    where += ` AND c.start_at <= $${i++}::timestamptz`;
    params.push(filters.date_to.trim());
  }

  const statusFilter = filters.status?.trim().toLowerCase();
  const statusClause =
    statusFilter && (MY_ASSESSMENT_STATUSES as readonly string[]).includes(statusFilter)
      ? ` AND derived_status = $${i++}`
      : "";
  if (statusClause) params.push(statusFilter);

  const fromSql = `
    SELECT
      c.id AS campaign_id,
      c.campaign_code,
      c.name AS campaign_name,
      a.id AS assessment_id,
      a.assessment_code,
      a.name AS assessment_name,
      a.assessment_type,
      a.total_questions,
      a.total_marks::float AS total_marks,
      a.passing_marks::float AS passing_marks,
      COALESCE(c.duration_minutes, a.duration_minutes) AS duration_minutes,
      c.max_attempts,
      cs.attempts_used,
      c.start_at::text AS start_at,
      c.end_at::text AS end_at,
      COALESCE(c.instructions, a.instructions) AS instructions,
      c.shuffle_questions,
      c.shuffle_options,
      c.allow_resume,
      c.show_result_immediately,
      c.negative_marking,
      cs.started_at::text AS started_at,
      cs.completed_at::text AS completed_at,
      (${DERIVED_STATUS_SQL.trim()}) AS derived_status
    FROM college_campaign_students cs
    JOIN college_assessment_campaigns c ON c.id = cs.campaign_id
    JOIN college_assessments a ON a.id = c.assessment_id
    WHERE cs.user_id = $1
      AND c.status = 'published'
      AND c.deleted_at IS NULL
      AND c.is_active = TRUE
      AND a.deleted_at IS NULL
      ${where}
  `;

  const countRow = await queryOne<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM (${fromSql}) listed WHERE TRUE ${statusClause.replace("derived_status", "listed.derived_status")}`,
    params
  );

  const total = Number(countRow?.total || 0);
  const listParams = [...params, limit, offset];
  const limIdx = i;
  const offIdx = i + 1;

  const rows = await query<RawAssignedRow>(
    `SELECT * FROM (${fromSql}) listed
     WHERE TRUE ${statusClause.replace("derived_status", "listed.derived_status")}
     ORDER BY listed.start_at DESC
     LIMIT $${limIdx} OFFSET $${offIdx}`,
    listParams
  );

  return {
    data: rows.map(mapRow),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit) || 1) },
  };
}

export async function getMyAssessment(studentId: string, campaignId: string) {
  const row = await loadAssignedRaw(studentId, campaignId);
  return mapRow(row);
}

export async function getInstructions(studentId: string, campaignId: string) {
  const row = await loadAssignedRaw(studentId, campaignId);
  return toInstructions(row);
}

/**
 * Validate availability / window / attempts and open (or resume) an attempt workspace.
 */
export async function startAssessment(studentId: string, campaignId: string) {
  const raw = await loadAssignedRaw(studentId, campaignId);
  const instructions = toInstructions(raw);

  const now = new Date();
  const windowStart = new Date(instructions.available_from);
  const windowEnd = new Date(instructions.available_until);

  if (instructions.attempts_used >= instructions.max_attempts) {
    throw new AppError("You have used all allowed attempts for this assessment.", 400);
  }
  if (now < windowStart) {
    throw new AppError(
      "This assessment is not available yet. The campaign window has not started.",
      400
    );
  }
  if (now > windowEnd) {
    throw new AppError(
      "The campaign window has ended. This assessment cannot be started.",
      400
    );
  }

  if (instructions.status === "in_progress" && !instructions.allow_resume) {
    throw new AppError("Resume is not allowed for this campaign.", 400);
  }

  if (
    instructions.status !== "available" &&
    instructions.status !== "in_progress"
  ) {
    throw new AppError(
      instructions.start_blocked_reason || "This assessment cannot be started.",
      400
    );
  }

  // Lazy import avoids circular dependency at module load
  const { ensureAttempt } = await import("./studentCampaignAttempt.service.js");
  const { attempt_id, resumed } = await ensureAttempt(studentId, campaignId);
  const updated = await getInstructions(studentId, campaignId);
  return {
    ...updated,
    attempt_id,
    started: true,
    resumed,
    message: resumed
      ? "Assessment resumed. Continue your attempt."
      : "Assessment started. Good luck.",
  };
}

export function metaCatalog() {
  return {
    statuses: MY_ASSESSMENT_STATUSES.map((s) => ({
      value: s,
      label: s
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" "),
    })),
    assessment_types: [
      { value: "practice_test", label: "Practice Test" },
      { value: "mock_test", label: "Mock Test" },
      { value: "placement_test", label: "Placement Test" },
    ],
  };
}
