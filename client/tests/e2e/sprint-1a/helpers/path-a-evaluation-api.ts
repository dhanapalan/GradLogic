/**
 * Path A Evaluation Helpers — Faculty grading, publishing, integrity.
 * Supplements path-a-api.ts with Gate 11 (Results Loop) operations.
 * All methods assume authenticated context (token provided).
 */
import type { APIRequestContext } from "@playwright/test";
import { API_URL } from "../config/env";

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Trigger auto-grading for submitted attempts in a campaign.
 * - Auto-grades MCQ/TF questions
 * - Flags short-answer questions for manual review
 * - Updates evaluation.status = 'evaluated'
 */
export async function triggerEvaluation(
  request: APIRequestContext,
  token: string,
  campaignId: string
): Promise<{ evaluated: number; pending_manual: number; error?: string }> {
  const res = await request.post(
    `${API_URL}/campus/campaigns/${campaignId}/results/evaluate`,
    { headers: auth(token) }
  );
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      evaluated: 0,
      pending_manual: 0,
      error: `Evaluate failed: ${res.status()} ${JSON.stringify(body)}`,
    };
  }

  return {
    evaluated: body.data?.evaluated ?? 0,
    pending_manual: body.data?.pending_manual ?? 0,
  };
}

/**
 * Publish (release) evaluated results to students.
 * - Sets evaluation.status = 'published'
 * - Stamps evaluation.published_at + evaluation.published_by
 * - Students can now see results via GET /results
 */
export async function publishResults(
  request: APIRequestContext,
  token: string,
  campaignId: string
): Promise<{ published: number; published_at?: string; error?: string }> {
  const res = await request.post(
    `${API_URL}/campus/campaigns/${campaignId}/results/publish`,
    { headers: auth(token) }
  );
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      published: 0,
      error: `Publish failed: ${res.status()} ${JSON.stringify(body)}`,
    };
  }

  return {
    published: body.data?.published ?? 0,
    published_at: body.data?.published_at,
  };
}

/**
 * Manually grade a short-answer question.
 * - Called per question during faculty review
 * - Sets question_results.marks_awarded + manual_feedback
 * - Sets evaluation_status = 'manually_scored'
 */
export async function gradeShortAnswerQuestion(
  request: APIRequestContext,
  token: string,
  campaignId: string,
  evaluationId: string,
  questionId: string,
  marksAwarded: number,
  feedback: string
): Promise<{ success: boolean; error?: string }> {
  const res = await request.put(
    `${API_URL}/campus/campaigns/${campaignId}/results/${evaluationId}/questions/${questionId}`,
    {
      headers: auth(token),
      data: {
        marks_awarded: marksAwarded,
        manual_feedback: feedback,
        evaluation_status: "manually_scored",
      },
    }
  );
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      success: false,
      error: `Grade short-answer failed: ${res.status()} ${JSON.stringify(body)}`,
    };
  }

  return { success: true };
}

/**
 * List integrity incidents for a campaign.
 * - Filters to risk_level > 'low' only (medium/high/critical)
 * - Each incident has: attempt_id, student_id, integrity_score, risk_level, event_count
 */
export async function getIntegrityIncidents(
  request: APIRequestContext,
  token: string,
  campaignId: string
): Promise<
  Array<{
    incident_id: string;
    attempt_id: string;
    student_id?: string;
    integrity_score: number;
    risk_level: "low" | "medium" | "high" | "critical";
    event_count: number;
    status: "open" | "reviewed" | "dismissed";
  }>
> {
  const res = await request.get(
    `${API_URL}/campus/campaigns/${campaignId}/integrity`,
    { headers: auth(token) }
  );
  const body = (await res.json().catch(() => ({ data: [] }))) as any;

  if (!res.ok()) {
    console.warn(`Get incidents failed: ${res.status()}`);
    return [];
  }

  return (body.data?.incidents || []) as any[];
}

/**
 * Get integrity events for a specific attempt (timeline).
 * - Returns chronological list of proctoring events
 * - Each event has: event_type, risk_delta, timestamp, metadata
 */
export async function getIntegrityTimelineForAttempt(
  request: APIRequestContext,
  token: string,
  campaignId: string,
  attemptId: string
): Promise<
  Array<{
    event_id: string;
    event_type: string;
    risk_delta: number;
    timestamp: string;
    metadata?: Record<string, any>;
  }>
> {
  const res = await request.get(
    `${API_URL}/campus/campaigns/${campaignId}/integrity/attempts/${attemptId}`,
    { headers: auth(token) }
  );
  const body = (await res.json().catch(() => ({ data: [] }))) as any;

  if (!res.ok()) {
    console.warn(`Get timeline failed: ${res.status()}`);
    return [];
  }

  return (body.data?.events || []) as any[];
}

/**
 * Mark an integrity incident as reviewed + add notes.
 * - Sets incident.status = 'reviewed'
 * - Stamps incident.reviewed_at + incident.reviewed_by
 * - Stores college admin's review notes
 */
export async function reviewIntegrityIncident(
  request: APIRequestContext,
  token: string,
  campaignId: string,
  incidentId: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const res = await request.patch(
    `${API_URL}/campus/campaigns/${campaignId}/integrity/incidents/${incidentId}`,
    {
      headers: auth(token),
      data: {
        status: "reviewed",
        notes,
      },
    }
  );
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      success: false,
      error: `Review incident failed: ${res.status()} ${JSON.stringify(body)}`,
    };
  }

  return { success: true };
}

/**
 * Dismiss an integrity incident (remove from flagged list).
 * - Sets incident.status = 'dismissed'
 * - Incident still exists in DB but hidden from "flagged" list
 */
export async function dismissIntegrityIncident(
  request: APIRequestContext,
  token: string,
  campaignId: string,
  incidentId: string
): Promise<{ success: boolean; error?: string }> {
  const res = await request.patch(
    `${API_URL}/campus/campaigns/${campaignId}/integrity/incidents/${incidentId}`,
    {
      headers: auth(token),
      data: {
        status: "dismissed",
      },
    }
  );
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      success: false,
      error: `Dismiss incident failed: ${res.status()} ${JSON.stringify(body)}`,
    };
  }

  return { success: true };
}

/**
 * Update integrity detection settings for a campaign.
 * - Toggles which proctoring checks are active
 * - New settings apply to attempts submitted AFTER the update
 * - Does NOT retroactively re-score existing incidents
 */
export async function updateIntegritySettings(
  request: APIRequestContext,
  token: string,
  campaignId: string,
  settings: {
    detect_tab_switch?: boolean;
    detect_window_blur?: boolean;
    detect_copy_paste?: boolean;
    detect_multi_monitor?: boolean;
    require_camera?: boolean;
    require_microphone?: boolean;
    tab_switch_limit?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  const res = await request.patch(
    `${API_URL}/campus/campaigns/${campaignId}/integrity/settings`,
    {
      headers: auth(token),
      data: settings,
    }
  );
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      success: false,
      error: `Update settings failed: ${res.status()} ${JSON.stringify(body)}`,
    };
  }

  return { success: true };
}

/**
 * Get student-visible published results for a specific attempt.
 * - Only includes attempts with evaluation.status = 'published'
 * - Returns score, percentage, pass/fail, per-question marks + feedback
 */
export async function getStudentResultForAttempt(
  request: APIRequestContext,
  token: string,
  attemptId: string
): Promise<{
  attemptId: string;
  score: number;
  percentage: number;
  passed: boolean;
  published_at?: string;
  questions: Array<{
    question_id: string;
    question_text: string;
    question_type: string;
    marks_possible: number;
    marks_awarded: number;
    is_correct?: boolean;
    selected?: any;
    feedback?: string;
  }>;
  error?: string;
}> {
  const res = await request.get(`${API_URL}/student/results/${attemptId}`, {
    headers: auth(token),
  });
  const body = (await res.json().catch(() => ({}))) as any;

  if (!res.ok()) {
    return {
      attemptId,
      score: 0,
      percentage: 0,
      passed: false,
      questions: [],
      error: `Get student result failed: ${res.status()}`,
    };
  }

  return body.data || body;
}

/**
 * List all attempts for a student in a campaign (results history).
 * - Only shows published attempts
 * - Used by student portal /results page
 */
export async function getStudentResultsHistory(
  request: APIRequestContext,
  token: string,
  campaignId?: string
): Promise<
  Array<{
    attemptId: string;
    campaignId?: string;
    score: number;
    percentage: number;
    passed: boolean;
    submitted_at: string;
    published_at?: string;
  }>
> {
  const query = campaignId ? `?campaignId=${campaignId}` : "";
  const res = await request.get(`${API_URL}/student/results${query}`, {
    headers: auth(token),
  });
  const body = (await res.json().catch(() => ({ data: [] }))) as any;

  if (!res.ok()) {
    console.warn(`Get student history failed: ${res.status()}`);
    return [];
  }

  return (body.data || []) as any[];
}
