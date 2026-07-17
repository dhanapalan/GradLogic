/**
 * Phase 2 Module 06.3–06.5 — Attempt workspace + server timer / auto-save / submit.
 *
 * Contracts:
 * - `auto_save_interval_seconds` (response): client should autosave at this cadence (default 30).
 * - `timer_warning_seconds` (campaign override, default 300): warn when remaining ≤ this value.
 * - Timer authority is always `server_deadline` (client-sent remaining is ignored).
 */
import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureCampaignSchema } from "./collegeAssessmentCampaign.service.js";
import { getInstructions } from "./studentAssessmentWorkspace.service.js";
import { writeAuditLog } from "./audit.service.js";
import {
  isUuid,
  remainingSecondsMs,
  sanitizeSelectedAnswers,
  shouldCompleteAssignment,
} from "./studentAssessmentWorkspace.rules.js";

/** Default warning threshold (seconds remaining) when campaign has no override. */
export const DEFAULT_TIMER_WARNING_SECONDS = 300;
/** Client auto-save cadence expected by Module 06.4. */
export const AUTO_SAVE_INTERVAL_SECONDS = 30;

function assertCampaignUuid(campaignId: string) {
  if (!isUuid(campaignId)) {
    throw new AppError("Invalid campaign id.", 400);
  }
}

export type AttemptStatus = "in_progress" | "submitted" | "expired";
export type QuestionNavStatus = "not_visited" | "visited" | "answered" | "marked_for_review";

export interface AttemptAnswerState {
  selected: string[];
  visited: boolean;
  marked_for_review: boolean;
  status: QuestionNavStatus;
}

export interface AttemptQuestion {
  id: string;
  display_order: number;
  marks: number;
  title: string;
  description: string | null;
  question_type: string;
  category: string;
  difficulty?: string | null;
  section?: string | null;
  options: Array<{ label: string; text: string }>;
  status: QuestionNavStatus;
  selected: string[];
  marked_for_review: boolean;
}

let schemaReady = false;

export async function ensureAttemptSchema(): Promise<void> {
  if (schemaReady) return;
  await ensureCampaignSchema();
  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_attempts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      assessment_id UUID NOT NULL REFERENCES college_assessments(id),
      attempt_number INT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
      question_order JSONB NOT NULL DEFAULT '[]'::jsonb,
      option_orders JSONB NOT NULL DEFAULT '{}'::jsonb,
      current_index INT NOT NULL DEFAULT 0,
      time_remaining_seconds INT NOT NULL,
      server_deadline TIMESTAMPTZ NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      score NUMERIC(8,2)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_attempt_answers (
      attempt_id UUID NOT NULL REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES college_questions(id),
      selected JSONB NOT NULL DEFAULT '[]'::jsonb,
      visited BOOLEAN NOT NULL DEFAULT FALSE,
      marked_for_review BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (attempt_id, question_id)
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_campaign_attempts_unique
      ON college_campaign_attempts (campaign_id, user_id, attempt_number)
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_campaign_attempts_user
      ON college_campaign_attempts (user_id, status)
  `).catch(() => {});
  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_campaign_attempts_campaign
      ON college_campaign_attempts (campaign_id, user_id)
  `).catch(() => {});
  await query(`
    DO $$ BEGIN
      ALTER TABLE college_campaign_attempts
        ADD CONSTRAINT college_campaign_attempts_status_check
        CHECK (status IN ('in_progress', 'submitted', 'expired'));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
  `).catch(() => {});
  await query(`
    ALTER TABLE college_assessment_campaigns
      ADD COLUMN IF NOT EXISTS timer_warning_seconds INT NOT NULL DEFAULT ${DEFAULT_TIMER_WARNING_SECONDS}
  `).catch(() => {});
  schemaReady = true;
}

async function getTimerWarningSeconds(campaignId: string): Promise<number> {
  const row = await queryOne<{ timer_warning_seconds: number }>(
    `SELECT COALESCE(timer_warning_seconds, $2)::int AS timer_warning_seconds
     FROM college_assessment_campaigns WHERE id = $1`,
    [campaignId, DEFAULT_TIMER_WARNING_SECONDS]
  );
  const n = Number(row?.timer_warning_seconds);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TIMER_WARNING_SECONDS;
  return Math.min(3600, Math.floor(n));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function navStatus(a: { selected: string[]; visited: boolean; marked_for_review: boolean }): QuestionNavStatus {
  if (a.marked_for_review) return "marked_for_review";
  if (a.selected?.length) return "answered";
  if (a.visited) return "visited";
  return "not_visited";
}

function parseOrder(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseOptionOrders(raw: unknown): Record<string, string[]> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string[]>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, string[]>;
  return {};
}

function parseSelected(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : raw ? [raw] : [];
    } catch {
      return raw ? [raw] : [];
    }
  }
  return [];
}

async function loadAssessmentQuestions(assessmentId: string) {
  return query<{
    question_id: string;
    display_order: number;
    marks: number;
    title: string;
    description: string | null;
    question_type: string;
    category: string;
    difficulty: string | null;
  }>(
    `SELECT aq.question_id, aq.display_order, aq.marks::float AS marks,
            q.title, q.description, q.question_type, q.category,
            q.difficulty
     FROM college_assessment_questions aq
     JOIN college_questions q ON q.id = aq.question_id
     WHERE aq.assessment_id = $1
       AND q.deleted_at IS NULL
       AND q.status = 'active'
     ORDER BY aq.display_order ASC, q.created_at ASC`,
    [assessmentId]
  );
}

async function loadOptions(questionIds: string[]) {
  if (!questionIds.length) return new Map<string, Array<{ label: string; text: string; is_correct: boolean }>>();
  const rows = await query<{
    question_id: string;
    option_label: string;
    option_text: string;
    is_correct: boolean;
    display_order: number;
  }>(
    `SELECT question_id, option_label, option_text, is_correct, display_order
     FROM college_question_options
     WHERE question_id = ANY($1::uuid[])
     ORDER BY display_order ASC, option_label ASC`,
    [questionIds]
  );
  const map = new Map<string, Array<{ label: string; text: string; is_correct: boolean }>>();
  for (const r of rows) {
    const list = map.get(r.question_id) || [];
    list.push({
      label: r.option_label,
      text: r.option_text,
      is_correct: !!r.is_correct,
    });
    map.set(r.question_id, list);
  }
  return map;
}

type AttemptRow = {
  id: string;
  campaign_id: string;
  user_id: string;
  assessment_id: string;
  attempt_number: number;
  status: AttemptStatus;
  question_order: unknown;
  option_orders: unknown;
  current_index: number;
  time_remaining_seconds: number;
  server_deadline: string;
  started_at: string;
  last_saved_at: string;
  submitted_at: string | null;
  score: number | null;
};

async function getActiveAttempt(studentId: string, campaignId: string) {
  return queryOne<AttemptRow>(
    `SELECT id, campaign_id, user_id, assessment_id, attempt_number, status,
            question_order, option_orders, current_index, time_remaining_seconds,
            server_deadline::text, started_at::text, last_saved_at::text,
            submitted_at::text, score::float AS score
     FROM college_campaign_attempts
     WHERE campaign_id = $1 AND user_id = $2 AND status = 'in_progress'
     ORDER BY attempt_number DESC
     LIMIT 1`,
    [campaignId, studentId]
  );
}

async function getAttemptById(attemptId: string, studentId: string) {
  return queryOne<AttemptRow>(
    `SELECT id, campaign_id, user_id, assessment_id, attempt_number, status,
            question_order, option_orders, current_index, time_remaining_seconds,
            server_deadline::text, started_at::text, last_saved_at::text,
            submitted_at::text, score::float AS score
     FROM college_campaign_attempts
     WHERE id = $1 AND user_id = $2`,
    [attemptId, studentId]
  );
}

function remainingSeconds(deadlineIso: string, campaignEndIso: string): number {
  return remainingSecondsMs(deadlineIso, campaignEndIso);
}

async function expireIfNeeded(
  attempt: AttemptRow,
  campaignEndIso: string,
  maxAttempts: number
): Promise<AttemptRow> {
  const left = remainingSeconds(attempt.server_deadline, campaignEndIso);
  if (attempt.status !== "in_progress") return attempt;
  if (left > 0 && new Date() <= new Date(campaignEndIso)) return attempt;

  await query(
    `UPDATE college_campaign_attempts
     SET status = 'expired', submitted_at = COALESCE(submitted_at, NOW()),
         time_remaining_seconds = 0, last_saved_at = NOW()
     WHERE id = $1 AND status = 'in_progress'`,
    [attempt.id]
  );

  // Multi-attempt: only mark assignment complete when attempts are exhausted
  const exhausted = shouldCompleteAssignment(attempt.attempt_number, maxAttempts);
  await query(
    `UPDATE college_campaign_students
     SET attempts_used = GREATEST(attempts_used, $3),
         started_at = CASE WHEN $4 THEN started_at ELSE NULL END,
         completed_at = CASE
           WHEN $4 THEN COALESCE(completed_at, NOW())
           ELSE NULL
         END
     WHERE campaign_id = $1 AND user_id = $2`,
    [attempt.campaign_id, attempt.user_id, attempt.attempt_number, exhausted]
  );

  // Fire Module 07 evaluation out-of-band (do not block expire path)
  setImmediate(() => {
    import("./collegeCampaignEvaluation.service.js")
      .then((m) => m.evaluateAttemptById(attempt.id))
      .catch(() => {});
  });

  const updated = await getAttemptById(attempt.id, attempt.user_id);
  if (!updated) throw new AppError("Attempt not found.", 404);
  return updated;
}

/**
 * Resume policy:
 * - ensureAttempt resume: hard block when allow_resume=false
 * - GET/sync/save: allow continuous session; block idle re-entry via /attempt URL
 */
const RESUME_IDLE_MS = 5 * 60 * 1000;

function assertHardResumeBlocked(allowResume: boolean) {
  if (!allowResume) {
    throw new AppError("Resume is not allowed for this campaign.", 400);
  }
}

function assertSessionResumeAllowed(allowResume: boolean, attempt: AttemptRow) {
  if (allowResume) return;
  const last = new Date(attempt.last_saved_at || attempt.started_at).getTime();
  if (!Number.isFinite(last) || Date.now() - last > RESUME_IDLE_MS) {
    throw new AppError(
      "Resume is not allowed for this campaign. Your previous session has expired.",
      400
    );
  }
}

async function loadAnswerMap(attemptId: string) {
  const rows = await query<{
    question_id: string;
    selected: unknown;
    visited: boolean;
    marked_for_review: boolean;
  }>(
    `SELECT question_id, selected, visited, marked_for_review
     FROM college_campaign_attempt_answers
     WHERE attempt_id = $1`,
    [attemptId]
  );
  const map = new Map<string, AttemptAnswerState>();
  for (const r of rows) {
    const selected = parseSelected(r.selected);
    const state = {
      selected,
      visited: !!r.visited,
      marked_for_review: !!r.marked_for_review,
      status: navStatus({
        selected,
        visited: !!r.visited,
        marked_for_review: !!r.marked_for_review,
      }),
    };
    map.set(r.question_id, state);
  }
  return map;
}

async function buildQuestionsPayload(attempt: AttemptRow): Promise<AttemptQuestion[]> {
  const order = parseOrder(attempt.question_order);
  const optionOrders = parseOptionOrders(attempt.option_orders);
  const meta = await loadAssessmentQuestions(attempt.assessment_id);
  const byId = new Map(meta.map((q) => [q.question_id, q]));
  const optionsMap = await loadOptions(order);
  const answers = await loadAnswerMap(attempt.id);

  return order
    .map((qid, idx) => {
      const q = byId.get(qid);
      if (!q) return null;
      const allOpts = optionsMap.get(qid) || [];
      const orderLabels = optionOrders[qid];
      let opts = allOpts.map((o) => ({ label: o.label, text: o.text }));
      if (orderLabels?.length) {
        const byLabel = new Map(opts.map((o) => [o.label, o]));
        opts = orderLabels.map((l) => byLabel.get(l)).filter(Boolean) as Array<{
          label: string;
          text: string;
        }>;
        for (const o of allOpts) {
          if (!orderLabels.includes(o.label)) opts.push({ label: o.label, text: o.text });
        }
      }
      const ans = answers.get(qid) || {
        selected: [],
        visited: false,
        marked_for_review: false,
        status: "not_visited" as QuestionNavStatus,
      };
      return {
        id: qid,
        display_order: idx,
        marks: Number(q.marks),
        title: q.title,
        description: q.description,
        question_type: q.question_type,
        category: q.category,
        difficulty: q.difficulty || null,
        section: q.category || null,
        options: opts,
        status: ans.status,
        selected: ans.selected,
        marked_for_review: ans.marked_for_review,
      } satisfies AttemptQuestion;
    })
    .filter(Boolean) as AttemptQuestion[];
}

async function assertCampaignAccess(studentId: string, campaignId: string) {
  const instructions = await getInstructions(studentId, campaignId);
  const now = new Date();
  if (now > new Date(instructions.available_until)) {
    throw new AppError("The campaign window has ended. Access is no longer allowed.", 403);
  }
  return instructions;
}

/** Create or resume in-progress attempt after start validation. */
export async function ensureAttempt(studentId: string, campaignId: string) {
  assertCampaignUuid(campaignId);
  await ensureAttemptSchema();
  const instructions = await assertCampaignAccess(studentId, campaignId);

  let active = await getActiveAttempt(studentId, campaignId);
  if (active) {
    active = await expireIfNeeded(
      active,
      instructions.available_until,
      instructions.max_attempts
    );
    if (active.status === "in_progress") {
      assertHardResumeBlocked(instructions.allow_resume);
      return { attempt_id: active.id, resumed: true };
    }
  }

  const countRow = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM college_campaign_attempts
     WHERE campaign_id = $1 AND user_id = $2`,
    [campaignId, studentId]
  );
  const existingAttempts = Number(countRow?.n) || 0;
  const nextNum = existingAttempts + 1;
  if (nextNum > instructions.max_attempts || instructions.attempts_used >= instructions.max_attempts) {
    throw new AppError("You have used all allowed attempts for this assessment.", 400);
  }

  const questions = await loadAssessmentQuestions(instructions.assessment_id);
  if (!questions.length) {
    throw new AppError("This assessment has no active questions.", 400);
  }

  let order = questions.map((q) => q.question_id);
  if (instructions.shuffle_questions) shuffleInPlace(order);

  const optionsMap = await loadOptions(order);
  const optionOrders: Record<string, string[]> = {};
  for (const qid of order) {
    const labels = (optionsMap.get(qid) || []).map((o) => o.label);
    optionOrders[qid] = instructions.shuffle_options ? shuffleInPlace([...labels]) : labels;
  }

  const durationMin = instructions.duration_minutes || 60;
  const durationDeadline = new Date(Date.now() + durationMin * 60 * 1000);
  const campaignEnd = new Date(instructions.available_until);
  const serverDeadline = durationDeadline < campaignEnd ? durationDeadline : campaignEnd;
  const timeRemaining = Math.max(1, Math.floor((serverDeadline.getTime() - Date.now()) / 1000));

  const attemptId = uuidv4();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO college_campaign_attempts
         (id, campaign_id, user_id, assessment_id, attempt_number, status,
          question_order, option_orders, current_index, time_remaining_seconds, server_deadline)
       VALUES ($1,$2,$3,$4,$5,'in_progress',$6::jsonb,$7::jsonb,0,$8,$9)`,
      [
        attemptId,
        campaignId,
        studentId,
        instructions.assessment_id,
        nextNum,
        JSON.stringify(order),
        JSON.stringify(optionOrders),
        timeRemaining,
        serverDeadline.toISOString(),
      ]
    );
    for (const qid of order) {
      await client.query(
        `INSERT INTO college_campaign_attempt_answers (attempt_id, question_id)
         VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [attemptId, qid]
      );
    }
    await client.query(
      `UPDATE college_campaign_students
       SET started_at = COALESCE(started_at, NOW()),
           attempts_used = GREATEST(attempts_used, $3),
           completed_at = NULL
       WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, studentId, nextNum]
    );
    await client.query("COMMIT");
  } catch (e: unknown) {
    await client.query("ROLLBACK");
    const code = (e as { code?: string })?.code;
    if (code === "23505") {
      const again = await getActiveAttempt(studentId, campaignId);
      if (again?.status === "in_progress") {
        assertHardResumeBlocked(instructions.allow_resume);
        return { attempt_id: again.id, resumed: true };
      }
      throw new AppError("An attempt is already in progress. Please resume.", 409);
    }
    throw e;
  } finally {
    client.release();
  }

  await writeAuditLog({
    actor_id: studentId,
    actor_role: "student",
    action: "CAMPAIGN_ATTEMPT_STARTED",
    target_type: "college_campaign_attempt",
    target_id: attemptId,
    reason: `Attempt #${nextNum} started`,
    metadata: { campaign_id: campaignId, attempt_number: nextNum },
  }).catch(() => {});

  return { attempt_id: attemptId, resumed: false };
}

async function loadIntegrityIfEnabled(studentId: string, campaignId: string) {
  const flag = await queryOne<{ proctoring_enabled: boolean }>(
    `SELECT COALESCE(proctoring_enabled, FALSE) AS proctoring_enabled
     FROM college_assessment_campaigns WHERE id = $1`,
    [campaignId]
  ).catch(() => null);
  if (!flag?.proctoring_enabled) return null;
  try {
    const { getStudentIntegrityContext } = await import(
      "./collegeCampaignIntegrity.service.js"
    );
    return await getStudentIntegrityContext(studentId, campaignId);
  } catch {
    return null;
  }
}

export async function getAttemptWorkspace(studentId: string, campaignId: string) {
  assertCampaignUuid(campaignId);
  await ensureAttemptSchema();
  const instructions = await getInstructions(studentId, campaignId);

  let active = await getActiveAttempt(studentId, campaignId);
  if (!active) {
    throw new AppError("No active attempt. Start the assessment from the instructions page.", 404);
  }
  active = await expireIfNeeded(
    active,
    instructions.available_until,
    instructions.max_attempts
  );
  if (active.status !== "in_progress") {
    throw new AppError("This attempt is no longer active.", 400);
  }
  assertSessionResumeAllowed(instructions.allow_resume, active);
  if (new Date() > new Date(instructions.available_until)) {
    throw new AppError("The campaign window has ended. Access is no longer allowed.", 403);
  }

  const questions = await buildQuestionsPayload(active);
  const server_now = new Date().toISOString();
  const time_remaining_seconds = remainingSeconds(
    active.server_deadline,
    instructions.available_until
  );
  const timer_warning_seconds = await getTimerWarningSeconds(campaignId);

  // Persist authoritative remaining (server clock); do not bump last_saved_at on read-only get
  await query(
    `UPDATE college_campaign_attempts
     SET time_remaining_seconds = $1
     WHERE id = $2`,
    [time_remaining_seconds, active.id]
  );

  const palette = questions.map((q, i) => ({
    index: i,
    question_id: q.id,
    status: q.status,
  }));

  const integrity = await loadIntegrityIfEnabled(studentId, campaignId);

  return {
    attempt: {
      id: active.id,
      campaign_id: active.campaign_id,
      assessment_id: active.assessment_id,
      assessment_name: instructions.assessment_name,
      campaign_name: instructions.campaign_name,
      attempt_number: active.attempt_number,
      status: active.status,
      current_index: Math.min(active.current_index, Math.max(0, questions.length - 1)),
      time_remaining_seconds,
      server_deadline: active.server_deadline,
      server_now,
      timer_warning_seconds,
      auto_save_interval_seconds: AUTO_SAVE_INTERVAL_SECONDS,
      last_saved_at: active.last_saved_at,
      total_questions: questions.length,
      duration_minutes: instructions.duration_minutes,
      available_until: instructions.available_until,
    },
    questions,
    palette,
    integrity,
  };
}

/** Lightweight server-clock sync for the client countdown (Module 06.4). */
export async function syncAttemptTimer(studentId: string, campaignId: string) {
  assertCampaignUuid(campaignId);
  await ensureAttemptSchema();
  const instructions = await getInstructions(studentId, campaignId);
  let active = await getActiveAttempt(studentId, campaignId);
  if (!active) throw new AppError("No active attempt.", 404);
  active = await expireIfNeeded(
    active,
    instructions.available_until,
    instructions.max_attempts
  );
  if (active.status !== "in_progress") {
    throw new AppError("This attempt is no longer active.", 400);
  }
  assertSessionResumeAllowed(instructions.allow_resume, active);
  if (new Date() > new Date(instructions.available_until)) {
    throw new AppError("The campaign window has ended. Access is no longer allowed.", 403);
  }

  const server_now = new Date().toISOString();
  const time_remaining_seconds = remainingSeconds(
    active.server_deadline,
    instructions.available_until
  );
  await query(
    `UPDATE college_campaign_attempts
     SET time_remaining_seconds = $1, last_saved_at = NOW()
     WHERE id = $2`,
    [time_remaining_seconds, active.id]
  );

  return {
    attempt_id: active.id,
    server_now,
    server_deadline: active.server_deadline,
    available_until: instructions.available_until,
    time_remaining_seconds,
    timer_warning_seconds: await getTimerWarningSeconds(campaignId),
    current_index: active.current_index,
    last_saved_at: active.last_saved_at,
    expired: time_remaining_seconds <= 0,
  };
}

export interface SaveAttemptBody {
  current_index?: number;
  time_remaining_seconds?: number;
  question_id?: string;
  selected?: string[] | null;
  marked_for_review?: boolean;
  visit?: boolean;
  clear_response?: boolean;
}

export interface SaveAttemptAck {
  saved: true;
  attempt: {
    id: string;
    campaign_id: string;
    current_index: number;
    time_remaining_seconds: number;
    server_deadline: string;
    server_now: string;
    last_saved_at: string;
    status: AttemptStatus;
    auto_save_interval_seconds: number;
    timer_warning_seconds: number;
  };
  question: {
    question_id: string;
    selected: string[];
    marked_for_review: boolean;
    status: QuestionNavStatus;
    visited: boolean;
  } | null;
}

export async function saveAttempt(
  studentId: string,
  campaignId: string,
  body: SaveAttemptBody
): Promise<SaveAttemptAck | Awaited<ReturnType<typeof submitAttempt>>> {
  assertCampaignUuid(campaignId);
  await ensureAttemptSchema();
  const instructions = await getInstructions(studentId, campaignId);
  if (new Date() > new Date(instructions.available_until)) {
    throw new AppError("The campaign window has ended. Access is no longer allowed.", 403);
  }

  let active = await getActiveAttempt(studentId, campaignId);
  if (!active) throw new AppError("No active attempt.", 404);
  active = await expireIfNeeded(
    active,
    instructions.available_until,
    instructions.max_attempts
  );
  if (active.status !== "in_progress") {
    throw new AppError("This attempt can no longer be updated.", 400);
  }
  assertSessionResumeAllowed(instructions.allow_resume, active);

  const order = parseOrder(active.question_order);
  const optionOrders = parseOptionOrders(active.option_orders);
  let currentIndex =
    body.current_index != null
      ? Math.max(0, Math.min(order.length - 1, Math.floor(Number(body.current_index))))
      : active.current_index;

  // Authoritative remaining always from server deadline (ignore client clock)
  const timeLeft = remainingSeconds(active.server_deadline, instructions.available_until);

  let questionAck: SaveAttemptAck["question"] = null;

  if (body.question_id) {
    if (!isUuid(body.question_id) || !order.includes(body.question_id)) {
      throw new AppError("Question is not part of this attempt.", 400);
    }

    const qMeta = await queryOne<{ question_type: string }>(
      `SELECT question_type FROM college_questions WHERE id = $1`,
      [body.question_id]
    );
    const allowedLabels =
      optionOrders[body.question_id] ||
      (await loadOptions([body.question_id])).get(body.question_id)?.map((o) => o.label) ||
      [];

    let selected = parseSelected(body.selected);
    if (body.clear_response) selected = [];
    else if (body.selected !== undefined) {
      selected = sanitizeSelectedAnswers({
        questionType: qMeta?.question_type || "",
        selected,
        allowedLabels,
      });
    }

    const marked =
      body.marked_for_review != null ? !!body.marked_for_review : undefined;
    const visit = body.visit !== false;

    const existing = await queryOne<{
      selected: unknown;
      visited: boolean;
      marked_for_review: boolean;
    }>(
      `SELECT selected, visited, marked_for_review
       FROM college_campaign_attempt_answers
       WHERE attempt_id = $1 AND question_id = $2`,
      [active.id, body.question_id]
    );

    const nextSelected =
      body.selected !== undefined || body.clear_response
        ? selected
        : parseSelected(existing?.selected);
    const nextMarked =
      marked !== undefined ? marked : !!existing?.marked_for_review;
    const nextVisited = visit || !!existing?.visited || nextSelected.length > 0;

    await query(
      `INSERT INTO college_campaign_attempt_answers
         (attempt_id, question_id, selected, visited, marked_for_review, updated_at)
       VALUES ($1,$2,$3::jsonb,$4,$5,NOW())
       ON CONFLICT (attempt_id, question_id) DO UPDATE SET
         selected = EXCLUDED.selected,
         visited = EXCLUDED.visited OR college_campaign_attempt_answers.visited,
         marked_for_review = EXCLUDED.marked_for_review,
         updated_at = NOW()`,
      [
        active.id,
        body.question_id,
        JSON.stringify(nextSelected),
        nextVisited,
        nextMarked,
      ]
    );

    questionAck = {
      question_id: body.question_id,
      selected: nextSelected,
      marked_for_review: nextMarked,
      visited: nextVisited,
      status: navStatus({
        selected: nextSelected,
        visited: nextVisited,
        marked_for_review: nextMarked,
      }),
    };
  } else if (body.visit && order[currentIndex]) {
    await query(
      `UPDATE college_campaign_attempt_answers
       SET visited = TRUE, updated_at = NOW()
       WHERE attempt_id = $1 AND question_id = $2`,
      [active.id, order[currentIndex]]
    );
  }

  const savedRow = await queryOne<{ last_saved_at: string }>(
    `UPDATE college_campaign_attempts
     SET current_index = $1, time_remaining_seconds = $2, last_saved_at = NOW()
     WHERE id = $3
     RETURNING last_saved_at::text`,
    [currentIndex, timeLeft, active.id]
  );

  if (timeLeft <= 0) {
    return submitAttempt(studentId, campaignId, { auto: true });
  }

  const server_now = new Date().toISOString();
  return {
    saved: true,
    attempt: {
      id: active.id,
      campaign_id: campaignId,
      current_index: currentIndex,
      time_remaining_seconds: timeLeft,
      server_deadline: active.server_deadline,
      server_now,
      last_saved_at: savedRow?.last_saved_at || server_now,
      status: "in_progress",
      auto_save_interval_seconds: AUTO_SAVE_INTERVAL_SECONDS,
      timer_warning_seconds: await getTimerWarningSeconds(campaignId),
    },
    question: questionAck,
  };
}

function summarizeQuestions(questions: AttemptQuestion[]) {
  let answered = 0;
  let unanswered = 0;
  let marked_for_review = 0;
  for (const q of questions) {
    if (q.marked_for_review) marked_for_review += 1;
    if (q.selected.length > 0) answered += 1;
    else unanswered += 1;
  }
  return {
    total_questions: questions.length,
    answered_questions: answered,
    unanswered_questions: unanswered,
    marked_for_review,
  };
}

/** Pre-submit summary for the active in-progress attempt (Module 06.5). */
export async function getSubmissionSummary(studentId: string, campaignId: string) {
  assertCampaignUuid(campaignId);
  await ensureAttemptSchema();
  const instructions = await getInstructions(studentId, campaignId);
  let active = await getActiveAttempt(studentId, campaignId);
  if (!active) {
    throw new AppError("No active attempt to submit. Return to the assessment first.", 404);
  }
  active = await expireIfNeeded(
    active,
    instructions.available_until,
    instructions.max_attempts
  );
  if (active.status !== "in_progress") {
    throw new AppError("This attempt has already been submitted.", 400);
  }
  assertSessionResumeAllowed(instructions.allow_resume, active);

  const questions = await buildQuestionsPayload(active);
  const counts = summarizeQuestions(questions);

  return {
    campaign_id: campaignId,
    attempt_id: active.id,
    assessment_name: instructions.assessment_name,
    campaign_name: instructions.campaign_name,
    attempt_number: active.attempt_number,
    ...counts,
    is_final: true,
    warning:
      "Submission is final. You will not be able to edit answers after you submit.",
  };
}

async function getLatestClosedAttempt(studentId: string, campaignId: string) {
  return queryOne<AttemptRow>(
    `SELECT id, campaign_id, user_id, assessment_id, attempt_number, status,
            question_order, option_orders, current_index, time_remaining_seconds,
            server_deadline::text, started_at::text, last_saved_at::text,
            submitted_at::text, score::float AS score
     FROM college_campaign_attempts
     WHERE campaign_id = $1 AND user_id = $2
       AND status IN ('submitted', 'expired')
     ORDER BY COALESCE(submitted_at, started_at) DESC, attempt_number DESC
     LIMIT 1`,
    [campaignId, studentId]
  );
}

/** Completion screen data — no scores (Module 06.5). */
export async function getSubmissionCompletion(studentId: string, campaignId: string) {
  await ensureAttemptSchema();
  const instructions = await getInstructions(studentId, campaignId);
  const closed = await getLatestClosedAttempt(studentId, campaignId);
  if (!closed || !closed.submitted_at) {
    throw new AppError("No submitted assessment found for this campaign.", 404);
  }

  return {
    campaign_id: campaignId,
    attempt_id: closed.id,
    assessment_name: instructions.assessment_name,
    campaign_name: instructions.campaign_name,
    attempt_number: closed.attempt_number,
    status: closed.status,
    submitted_at: closed.submitted_at,
    auto_submitted: closed.status === "expired",
    message:
      closed.status === "expired"
        ? "Time expired. Your assessment was submitted automatically."
        : "Assessment submitted successfully.",
  };
}

export async function submitAttempt(
  studentId: string,
  campaignId: string,
  opts?: { auto?: boolean }
) {
  assertCampaignUuid(campaignId);
  await ensureAttemptSchema();
  const instructions = await getInstructions(studentId, campaignId);
  let active = await getActiveAttempt(studentId, campaignId);
  if (!active) throw new AppError("No active attempt.", 404);

  if (active.status !== "in_progress") {
    const completion = await getSubmissionCompletion(studentId, campaignId);
    return {
      ...completion,
      message: "Attempt already submitted. No further edits are allowed.",
    };
  }

  // Submission only — evaluation is Module 07 (async, out of band)
  const questions = await buildQuestionsPayload(active);

  const timedOut =
    remainingSeconds(active.server_deadline, instructions.available_until) <= 0 ||
    new Date() > new Date(instructions.available_until);
  const status: AttemptStatus = opts?.auto && timedOut ? "expired" : "submitted";
  const exhausted = shouldCompleteAssignment(
    active.attempt_number,
    instructions.max_attempts
  );

  const client = await pool.connect();
  let submittedAt: string;
  try {
    await client.query("BEGIN");
    const submitted = await client.query<{ submitted_at: string }>(
      `UPDATE college_campaign_attempts
       SET status = $1, score = NULL, submitted_at = NOW(),
           time_remaining_seconds = 0, last_saved_at = NOW()
       WHERE id = $2 AND status = 'in_progress'
       RETURNING submitted_at::text`,
      [status, active.id]
    );
    if (!submitted.rows[0]) {
      await client.query("ROLLBACK");
      throw new AppError("Submission failed. The attempt may already be closed.", 409);
    }
    submittedAt = submitted.rows[0].submitted_at;
    await client.query(
      `UPDATE college_campaign_students
       SET attempts_used = GREATEST(attempts_used, $3),
           started_at = CASE WHEN $4 THEN started_at ELSE NULL END,
           completed_at = CASE WHEN $4 THEN NOW() ELSE NULL END
       WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, studentId, active.attempt_number, exhausted]
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  // Module 07 — do not await on the student request path
  const attemptId = active.id;
  setImmediate(() => {
    import("./collegeCampaignEvaluation.service.js")
      .then((m) => m.evaluateAttemptById(attemptId))
      .catch(() => {});
  });

  await writeAuditLog({
    actor_id: studentId,
    actor_role: "student",
    action: opts?.auto ? "CAMPAIGN_ATTEMPT_AUTO_SUBMITTED" : "CAMPAIGN_ATTEMPT_SUBMITTED",
    target_type: "college_campaign_attempt",
    target_id: attemptId,
    reason: status === "expired" ? "Timer/window expired" : "Student submitted",
    metadata: {
      campaign_id: campaignId,
      attempt_number: active.attempt_number,
      status,
    },
  }).catch(() => {});

  return {
    campaign_id: campaignId,
    attempt_id: active.id,
    assessment_name: instructions.assessment_name,
    campaign_name: instructions.campaign_name,
    attempt_number: active.attempt_number,
    status,
    submitted_at: submittedAt,
    auto_submitted: status === "expired",
    ...summarizeQuestions(questions),
    message: opts?.auto
      ? "Time expired. Assessment submitted automatically."
      : "Assessment submitted successfully.",
  };
}
