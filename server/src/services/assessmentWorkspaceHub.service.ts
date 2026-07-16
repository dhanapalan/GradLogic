/**
 * Module 06 — Assessment Workspace facade (attempt-scoped contract).
 * Thin adapters over studentAssessmentWorkspace + studentCampaignAttempt + integrity.
 * No scoring, navigation rules, or evaluation logic here.
 */
import { queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import * as workspace from "./studentAssessmentWorkspace.service.js";
import * as attempt from "./studentCampaignAttempt.service.js";
import * as integrity from "./collegeCampaignIntegrity.service.js";

async function resolveAttempt(studentId: string, attemptId: string) {
  const row = await queryOne<{
    id: string;
    campaign_id: string;
    status: string;
  }>(
    `SELECT id, campaign_id, status
     FROM college_campaign_attempts
     WHERE id = $1 AND user_id = $2`,
    [attemptId, studentId]
  );
  if (!row) throw new AppError("Attempt not found or not assigned to you.", 404);
  return row;
}

/** POST /assessment-workspace/launch — body: { campaign_id } */
export async function launch(studentId: string, campaignId: string) {
  if (!campaignId?.trim()) throw new AppError("campaign_id is required.", 400);
  const data = await workspace.startAssessment(studentId, campaignId.trim());
  return {
    attempt_id: data.attempt_id,
    campaign_id: campaignId.trim(),
    assessment_id: data.assessment_id,
    started: data.started,
    resumed: data.resumed,
    message: data.message,
    workspace_href: `/app/student-portal/my-assessments/${campaignId.trim()}/attempt`,
    session: {
      attempt_id: data.attempt_id,
      campaign_id: campaignId.trim(),
    },
  };
}

/** POST /assessment-workspace/:attemptId/resume */
export async function resume(studentId: string, attemptId: string) {
  const row = await resolveAttempt(studentId, attemptId);
  if (row.status !== "in_progress") {
    throw new AppError("No in-progress attempt to resume.", 400);
  }
  const data = await workspace.startAssessment(studentId, row.campaign_id);
  return {
    attempt_id: data.attempt_id || attemptId,
    campaign_id: row.campaign_id,
    resumed: true,
    message: data.message || "Assessment resumed",
    workspace_href: `/app/student-portal/my-assessments/${row.campaign_id}/attempt`,
  };
}

/** GET /assessment-workspace/:attemptId */
export async function getWorkspace(studentId: string, attemptId: string) {
  const row = await resolveAttempt(studentId, attemptId);
  const data = await attempt.getAttemptWorkspace(studentId, row.campaign_id);
  if (data.attempt.id !== attemptId) {
    throw new AppError("Attempt session mismatch. Please relaunch the assessment.", 409);
  }
  return data;
}

/** GET /assessment-workspace/:attemptId/questions */
export async function getQuestions(studentId: string, attemptId: string) {
  const data = await getWorkspace(studentId, attemptId);
  return {
    attempt_id: data.attempt.id,
    campaign_id: data.attempt.campaign_id,
    questions: data.questions,
    palette: data.palette,
    current_index: data.attempt.current_index,
  };
}

/** PUT|POST /assessment-workspace/:attemptId/response */
export async function saveResponse(
  studentId: string,
  attemptId: string,
  body: Record<string, unknown>
) {
  const row = await resolveAttempt(studentId, attemptId);
  return attempt.saveAttempt(studentId, row.campaign_id, body || {});
}

/** POST /assessment-workspace/:attemptId/autosave */
export async function autosave(
  studentId: string,
  attemptId: string,
  body: Record<string, unknown>
) {
  return saveResponse(studentId, attemptId, body);
}

/** POST /assessment-workspace/:attemptId/heartbeat — timer presence sync */
export async function heartbeat(studentId: string, attemptId: string) {
  const row = await resolveAttempt(studentId, attemptId);
  const sync = await attempt.syncAttemptTimer(studentId, row.campaign_id);
  return {
    ...sync,
    attempt_id: attemptId,
    heartbeat_at: new Date().toISOString(),
  };
}

/** POST /assessment-workspace/:attemptId/telemetry — integrity telemetry only */
export async function telemetry(
  studentId: string,
  attemptId: string,
  body: { event_type?: string; metadata?: Record<string, unknown> }
) {
  const row = await resolveAttempt(studentId, attemptId);
  if (!body?.event_type) throw new AppError("event_type is required.", 400);
  return integrity.logStudentEvent(
    studentId,
    row.campaign_id,
    body.event_type,
    body.metadata || {}
  );
}

/** POST /assessment-workspace/:attemptId/submit */
export async function submit(studentId: string, attemptId: string) {
  const row = await resolveAttempt(studentId, attemptId);
  if (row.status !== "in_progress") {
    const completion = await attempt.getSubmissionCompletion(studentId, row.campaign_id);
    return {
      ...completion,
      message: "Attempt already submitted. No further edits are allowed.",
    };
  }
  return attempt.submitAttempt(studentId, row.campaign_id);
}

/** GET /assessment-workspace/:attemptId/summary */
export async function getSummary(studentId: string, attemptId: string) {
  const row = await resolveAttempt(studentId, attemptId);
  return attempt.getSubmissionSummary(studentId, row.campaign_id);
}
