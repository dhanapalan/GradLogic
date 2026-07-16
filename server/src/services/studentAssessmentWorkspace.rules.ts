/**
 * Pure helpers for Student Assessment Workspace (Module 06).
 * Kept separate for unit tests without DB.
 */

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

export const SHORT_ANSWER_MAX_CHARS = 5000;

/** SQL CASE expressing derived My Assessments status (mirrors computeStatus). */
export const DERIVED_STATUS_SQL = `
  CASE
    WHEN NOW() > c.end_at THEN 'expired'
    WHEN NOW() < c.start_at THEN 'upcoming'
    WHEN cs.started_at IS NOT NULL AND cs.completed_at IS NULL THEN 'in_progress'
    WHEN cs.attempts_used >= c.max_attempts THEN 'submitted'
    ELSE 'available'
  END
`;

/**
 * Whether assignment row should mark completed_at after an attempt ends.
 * Exhausted = this attempt number reached max_attempts.
 */
export function shouldCompleteAssignment(
  attemptNumber: number,
  maxAttempts: number
): boolean {
  return attemptNumber >= Math.max(1, maxAttempts);
}

/**
 * Validate selected labels for objective questions; length-limit short answers.
 */
export function sanitizeSelectedAnswers(opts: {
  questionType: string;
  selected: string[];
  allowedLabels: string[];
}): string[] {
  const type = (opts.questionType || "").toLowerCase();
  const selected = opts.selected.map((s) => String(s));

  if (type === "short_answer" || type === "essay" || type === "descriptive") {
    return selected
      .map((s) => s.slice(0, SHORT_ANSWER_MAX_CHARS))
      .filter((s) => s.length > 0)
      .slice(0, 1);
  }

  const allowed = new Set(opts.allowedLabels.map(String));
  const filtered = selected.filter((s) => allowed.has(s));

  if (type === "true_false" || type === "single_choice" || type === "mcq") {
    return filtered.slice(0, 1);
  }
  // multi_select / multi_choice / default
  return [...new Set(filtered)];
}

export function remainingSecondsMs(
  deadlineIso: string,
  campaignEndIso: string,
  nowMs = Date.now()
): number {
  const deadline = new Date(deadlineIso).getTime();
  const campaignEnd = new Date(campaignEndIso).getTime();
  const end = Math.min(deadline, campaignEnd);
  return Math.max(0, Math.floor((end - nowMs) / 1000));
}
