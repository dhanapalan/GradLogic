/**
 * Phase 2 Module 07 — Evaluation & Results (separate from attempt workspace).
 *
 * Responsibilities: MCQ/TF auto-score, short-answer pending/manual (AI-ready),
 * negative marking, pass/fail, publish, student/faculty result reads.
 */
import { v4 as uuidv4 } from "uuid";
import { pool, query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { ensureAttemptSchema } from "./studentCampaignAttempt.service.js";
import { writeAuditLog } from "./audit.service.js";

export type EvaluationStatus =
  | "pending"
  | "evaluated"
  | "needs_manual_review"
  | "published";

export type QuestionEvalStatus =
  | "auto_correct"
  | "auto_incorrect"
  | "pending_manual"
  | "manually_scored"
  | "skipped";

let schemaReady = false;

export async function ensureEvaluationSchema(): Promise<void> {
  if (schemaReady) return;
  await ensureAttemptSchema();
  await query(`
    ALTER TABLE college_assessment_campaigns
      ADD COLUMN IF NOT EXISTS negative_mark_value NUMERIC(8,2) NOT NULL DEFAULT 1
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_evaluations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      attempt_id UUID NOT NULL UNIQUE REFERENCES college_campaign_attempts(id) ON DELETE CASCADE,
      campaign_id UUID NOT NULL REFERENCES college_assessment_campaigns(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id),
      assessment_id UUID NOT NULL REFERENCES college_assessments(id),
      status VARCHAR(30) NOT NULL DEFAULT 'pending',
      total_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
      obtained_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
      negative_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
      percentage NUMERIC(8,2) NOT NULL DEFAULT 0,
      passing_marks NUMERIC(10,2) NOT NULL DEFAULT 0,
      passed BOOLEAN,
      needs_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
      evaluated_at TIMESTAMPTZ,
      evaluated_by UUID REFERENCES users(id),
      published_at TIMESTAMPTZ,
      published_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS college_campaign_question_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      evaluation_id UUID NOT NULL REFERENCES college_campaign_evaluations(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES college_questions(id),
      question_type VARCHAR(50) NOT NULL,
      marks_possible NUMERIC(8,2) NOT NULL DEFAULT 0,
      marks_awarded NUMERIC(8,2) NOT NULL DEFAULT 0,
      is_correct BOOLEAN,
      selected JSONB NOT NULL DEFAULT '[]'::jsonb,
      correct_labels JSONB NOT NULL DEFAULT '[]'::jsonb,
      evaluation_status VARCHAR(30) NOT NULL DEFAULT 'pending_manual',
      manual_feedback TEXT,
      reviewed_by UUID REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT college_campaign_question_results_unique UNIQUE (evaluation_id, question_id)
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_college_campaign_evaluations_campaign
      ON college_campaign_evaluations (campaign_id, status)
  `).catch(() => {});
  schemaReady = true;
}

function parseJsonArray(raw: unknown): string[] {
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

function parseOrder(raw: unknown): string[] {
  return parseJsonArray(raw);
}

type AttemptCtx = {
  id: string;
  campaign_id: string;
  user_id: string;
  assessment_id: string;
  attempt_number: number;
  status: string;
  question_order: unknown;
  submitted_at: string | null;
};

type CampaignCtx = {
  negative_marking: boolean;
  negative_mark_value: number;
  show_result_immediately: boolean;
  name: string;
  campaign_code: string;
};

type AssessmentCtx = {
  name: string;
  passing_marks: number;
  total_marks: number;
};

async function loadAttempt(attemptId: string): Promise<AttemptCtx> {
  const row = await queryOne<AttemptCtx>(
    `SELECT id, campaign_id, user_id, assessment_id, attempt_number, status,
            question_order, submitted_at::text
     FROM college_campaign_attempts WHERE id = $1`,
    [attemptId]
  );
  if (!row) throw new AppError("Attempt not found.", 404);
  if (row.status !== "submitted" && row.status !== "expired") {
    throw new AppError("Only submitted attempts can be evaluated.", 400);
  }
  return row;
}

async function loadCampaign(campaignId: string): Promise<CampaignCtx> {
  const row = await queryOne<CampaignCtx>(
    `SELECT name, campaign_code, negative_marking,
            COALESCE(negative_mark_value, 1)::float AS negative_mark_value,
            show_result_immediately
     FROM college_assessment_campaigns
     WHERE id = $1 AND deleted_at IS NULL`,
    [campaignId]
  );
  if (!row) throw new AppError("Campaign not found.", 404);
  return row;
}

async function loadAssessment(assessmentId: string): Promise<AssessmentCtx> {
  const row = await queryOne<AssessmentCtx>(
    `SELECT name, passing_marks::float AS passing_marks, total_marks::float AS total_marks
     FROM college_assessments WHERE id = $1 AND deleted_at IS NULL`,
    [assessmentId]
  );
  if (!row) throw new AppError("Assessment not found.", 404);
  return row;
}

function gradeObjective(params: {
  questionType: string;
  selected: string[];
  correctLabels: string[];
  marksPossible: number;
  negativeMarking: boolean;
  negativeMarkValue: number;
}): {
  marks_awarded: number;
  negative: number;
  is_correct: boolean | null;
  evaluation_status: QuestionEvalStatus;
} {
  const { questionType, selected, correctLabels, marksPossible, negativeMarking, negativeMarkValue } =
    params;

  if (questionType === "short_answer") {
    return {
      marks_awarded: 0,
      negative: 0,
      is_correct: null,
      evaluation_status: "pending_manual",
    };
  }

  const correct = new Set(correctLabels);
  const sel = new Set(selected);
  if (!correct.size) {
    return {
      marks_awarded: 0,
      negative: 0,
      is_correct: null,
      evaluation_status: "skipped",
    };
  }

  let ok = false;
  if (questionType === "mcq_multiple") {
    ok = sel.size === correct.size && [...correct].every((c) => sel.has(c));
  } else {
    // mcq_single, true_false
    ok = sel.size === 1 && correct.has([...sel][0]);
  }

  if (ok) {
    return {
      marks_awarded: marksPossible,
      negative: 0,
      is_correct: true,
      evaluation_status: "auto_correct",
    };
  }

  if (sel.size === 0) {
    return {
      marks_awarded: 0,
      negative: 0,
      is_correct: false,
      evaluation_status: "auto_incorrect",
    };
  }

  const penalty = negativeMarking
    ? Math.min(marksPossible, Math.max(0, Number(negativeMarkValue) || 0))
    : 0;
  return {
    marks_awarded: -penalty,
    negative: penalty,
    is_correct: false,
    evaluation_status: "auto_incorrect",
  };
}

/** Evaluate a single submitted attempt. Idempotent re-run preserves published status until republish. */
export async function evaluateAttemptById(
  attemptId: string,
  actor?: { id: string; role: string; ip?: string }
) {
  await ensureEvaluationSchema();
  const attempt = await loadAttempt(attemptId);
  const campaign = await loadCampaign(attempt.campaign_id);
  const assessment = await loadAssessment(attempt.assessment_id);
  const order = parseOrder(attempt.question_order);

  const meta = await query<{
    question_id: string;
    marks: number;
    question_type: string;
    title: string;
  }>(
    `SELECT aq.question_id, aq.marks::float AS marks, q.question_type, q.title
     FROM college_assessment_questions aq
     JOIN college_questions q ON q.id = aq.question_id
     WHERE aq.assessment_id = $1`,
    [attempt.assessment_id]
  );
  const byId = new Map(meta.map((m) => [m.question_id, m]));

  const options = await query<{
    question_id: string;
    option_label: string;
    is_correct: boolean;
  }>(
    `SELECT question_id, option_label, is_correct
     FROM college_question_options
     WHERE question_id = ANY($1::uuid[])`,
    [order.length ? order : ["00000000-0000-0000-0000-000000000000"]]
  );
  const optMap = new Map<string, string[]>();
  for (const o of options) {
    if (!o.is_correct) continue;
    const list = optMap.get(o.question_id) || [];
    list.push(o.option_label);
    optMap.set(o.question_id, list);
  }

  const answerRows = await query<{ question_id: string; selected: unknown }>(
    `SELECT question_id, selected FROM college_campaign_attempt_answers WHERE attempt_id = $1`,
    [attemptId]
  );
  const ansMap = new Map(answerRows.map((a) => [a.question_id, parseJsonArray(a.selected)]));

  // Preserve prior manual scores if re-evaluating
  const existingEval = await queryOne<{ id: string; status: EvaluationStatus }>(
    `SELECT id, status FROM college_campaign_evaluations WHERE attempt_id = $1`,
    [attemptId]
  );
  const priorManual = new Map<
    string,
    { marks_awarded: number; evaluation_status: string; manual_feedback: string | null; is_correct: boolean | null }
  >();
  if (existingEval) {
    const prior = await query<{
      question_id: string;
      marks_awarded: number;
      evaluation_status: string;
      manual_feedback: string | null;
      is_correct: boolean | null;
    }>(
      `SELECT question_id, marks_awarded::float AS marks_awarded, evaluation_status,
              manual_feedback, is_correct
       FROM college_campaign_question_results
       WHERE evaluation_id = $1 AND evaluation_status = 'manually_scored'`,
      [existingEval.id]
    );
    for (const p of prior) priorManual.set(p.question_id, p);
  }

  let totalMarks = 0;
  let obtained = 0;
  let negativeTotal = 0;
  let needsManual = false;
  const rows: Array<{
    question_id: string;
    question_type: string;
    marks_possible: number;
    marks_awarded: number;
    is_correct: boolean | null;
    selected: string[];
    correct_labels: string[];
    evaluation_status: QuestionEvalStatus;
    manual_feedback: string | null;
  }> = [];

  for (const qid of order) {
    const q = byId.get(qid);
    if (!q) continue;
    const marksPossible = Number(q.marks) || 0;
    totalMarks += marksPossible;
    const selected = ansMap.get(qid) || [];
    const correctLabels = optMap.get(qid) || [];

    const manual = priorManual.get(qid);
    if (manual && q.question_type === "short_answer") {
      obtained += Number(manual.marks_awarded) || 0;
      rows.push({
        question_id: qid,
        question_type: q.question_type,
        marks_possible: marksPossible,
        marks_awarded: Number(manual.marks_awarded) || 0,
        is_correct: manual.is_correct,
        selected,
        correct_labels: correctLabels,
        evaluation_status: "manually_scored",
        manual_feedback: manual.manual_feedback,
      });
      continue;
    }

    const graded = gradeObjective({
      questionType: q.question_type,
      selected,
      correctLabels,
      marksPossible,
      negativeMarking: !!campaign.negative_marking,
      negativeMarkValue: Number(campaign.negative_mark_value) || 1,
    });

    if (graded.evaluation_status === "pending_manual") needsManual = true;
    obtained += graded.marks_awarded;
    negativeTotal += graded.negative;
    rows.push({
      question_id: qid,
      question_type: q.question_type,
      marks_possible: marksPossible,
      marks_awarded: graded.marks_awarded,
      is_correct: graded.is_correct,
      selected,
      correct_labels: correctLabels,
      evaluation_status: graded.evaluation_status,
      manual_feedback: null,
    });
  }

  // Floor at 0 for final obtained after negatives (marks_awarded may be negative per Q)
  const netObtained = Math.max(0, obtained);
  const percentage =
    totalMarks > 0 ? Math.round((netObtained / totalMarks) * 10000) / 100 : 0;
  const passing = Number(assessment.passing_marks) || 0;
  const passed = netObtained >= passing;
  const status: EvaluationStatus = needsManual
    ? "needs_manual_review"
    : existingEval?.status === "published"
      ? "published"
      : "evaluated";

  const evaluationId = existingEval?.id || uuidv4();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO college_campaign_evaluations
         (id, attempt_id, campaign_id, user_id, assessment_id, status,
          total_marks, obtained_marks, negative_marks, percentage, passing_marks, passed,
          needs_manual_review, evaluated_at, evaluated_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14,NOW())
       ON CONFLICT (attempt_id) DO UPDATE SET
         status = CASE
           WHEN college_campaign_evaluations.status = 'published' THEN 'published'
           ELSE EXCLUDED.status
         END,
         total_marks = EXCLUDED.total_marks,
         obtained_marks = EXCLUDED.obtained_marks,
         negative_marks = EXCLUDED.negative_marks,
         percentage = EXCLUDED.percentage,
         passing_marks = EXCLUDED.passing_marks,
         passed = EXCLUDED.passed,
         needs_manual_review = EXCLUDED.needs_manual_review,
         evaluated_at = NOW(),
         evaluated_by = EXCLUDED.evaluated_by,
         updated_at = NOW()`,
      [
        evaluationId,
        attemptId,
        attempt.campaign_id,
        attempt.user_id,
        attempt.assessment_id,
        status === "published" ? "published" : status,
        totalMarks,
        netObtained,
        negativeTotal,
        percentage,
        passing,
        passed,
        needsManual,
        actor?.id ?? null,
      ]
    );

    await client.query(`DELETE FROM college_campaign_question_results WHERE evaluation_id = $1`, [
      evaluationId,
    ]);
    for (const r of rows) {
      await client.query(
        `INSERT INTO college_campaign_question_results
           (evaluation_id, question_id, question_type, marks_possible, marks_awarded,
            is_correct, selected, correct_labels, evaluation_status, manual_feedback, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,NOW())`,
        [
          evaluationId,
          r.question_id,
          r.question_type,
          r.marks_possible,
          r.marks_awarded,
          r.is_correct,
          JSON.stringify(r.selected),
          JSON.stringify(r.correct_labels),
          r.evaluation_status,
          r.manual_feedback,
        ]
      );
    }

    // Mirror summary score on attempt for legacy dashboards (evaluation remains source of truth)
    await client.query(
      `UPDATE college_campaign_attempts SET score = $1 WHERE id = $2`,
      [netObtained, attemptId]
    );

    // Auto-publish when campaign requests immediate results and no manual review pending
    if (campaign.show_result_immediately && !needsManual && status !== "published") {
      await client.query(
        `UPDATE college_campaign_evaluations
         SET status = 'published', published_at = COALESCE(published_at, NOW()), updated_at = NOW()
         WHERE id = $1`,
        [evaluationId]
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  if (actor) {
    await writeAuditLog({
      actor_id: actor.id,
      actor_role: actor.role,
      action: "ASSESSMENT_UPDATED",
      target_type: "campaign_evaluation",
      target_id: evaluationId,
      reason: `Evaluated attempt ${attemptId}`,
      metadata: { obtained: netObtained, total: totalMarks, passed, needsManual },
      ip_address: actor.ip,
    }).catch(() => {});
  }

  return getEvaluationById(evaluationId, { includeCorrect: true });
}

export async function evaluateCampaignAttempts(
  collegeId: string,
  campaignId: string,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureEvaluationSchema();
  const camp = await queryOne<{ id: string }>(
    `SELECT id FROM college_assessment_campaigns
     WHERE id = $1 AND college_id = $2 AND deleted_at IS NULL`,
    [campaignId, collegeId]
  );
  if (!camp) throw new AppError("Campaign not found.", 404);

  const attempts = await query<{ id: string }>(
    `SELECT id FROM college_campaign_attempts
     WHERE campaign_id = $1 AND status IN ('submitted', 'expired')`,
    [campaignId]
  );

  let evaluated = 0;
  for (const a of attempts) {
    await evaluateAttemptById(a.id, actor);
    evaluated += 1;
  }
  return { campaign_id: campaignId, evaluated };
}

export async function publishCampaignResults(
  collegeId: string,
  campaignId: string,
  actor: { id: string; role: string; ip?: string }
) {
  await ensureEvaluationSchema();
  const camp = await queryOne<{ id: string }>(
    `SELECT id FROM college_assessment_campaigns
     WHERE id = $1 AND college_id = $2 AND deleted_at IS NULL`,
    [campaignId, collegeId]
  );
  if (!camp) throw new AppError("Campaign not found.", 404);

  await query(
    `UPDATE college_campaign_evaluations
     SET status = 'published',
         published_at = COALESCE(published_at, NOW()),
         published_by = $2,
         updated_at = NOW()
     WHERE campaign_id = $1
       AND status IN ('evaluated', 'needs_manual_review')`,
    [campaignId, actor.id]
  );

  const count = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM college_campaign_evaluations
     WHERE campaign_id = $1 AND status = 'published'`,
    [campaignId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "ASSESSMENT_PUBLISHED",
    target_type: "campaign_results",
    target_id: campaignId,
    reason: `Published campaign results (${count?.n || 0})`,
    ip_address: actor.ip,
  }).catch(() => {});

  return { campaign_id: campaignId, published: Number(count?.n || 0) };
}

export async function scoreShortAnswer(
  collegeId: string,
  campaignId: string,
  evaluationId: string,
  questionId: string,
  body: { marks_awarded: number; is_correct?: boolean; feedback?: string | null },
  actor: { id: string; role: string; ip?: string }
) {
  await ensureEvaluationSchema();
  const ev = await queryOne<{
    id: string;
    campaign_id: string;
    attempt_id: string;
    status: EvaluationStatus;
  }>(
    `SELECT e.id, e.campaign_id, e.attempt_id, e.status
     FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     WHERE e.id = $1 AND e.campaign_id = $2 AND c.college_id = $3`,
    [evaluationId, campaignId, collegeId]
  );
  if (!ev) throw new AppError("Evaluation not found.", 404);

  const qr = await queryOne<{ marks_possible: number; question_type: string }>(
    `SELECT marks_possible::float AS marks_possible, question_type
     FROM college_campaign_question_results
     WHERE evaluation_id = $1 AND question_id = $2`,
    [evaluationId, questionId]
  );
  if (!qr) throw new AppError("Question result not found.", 404);
  if (qr.question_type !== "short_answer") {
    throw new AppError("Only short-answer questions can be manually scored.", 400);
  }

  const awarded = Math.max(0, Math.min(Number(qr.marks_possible), Number(body.marks_awarded)));
  await query(
    `UPDATE college_campaign_question_results
     SET marks_awarded = $1,
         is_correct = $2,
         evaluation_status = 'manually_scored',
         manual_feedback = $3,
         reviewed_by = $4,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE evaluation_id = $5 AND question_id = $6`,
    [
      awarded,
      body.is_correct != null ? !!body.is_correct : awarded > 0,
      body.feedback?.trim() || null,
      actor.id,
      evaluationId,
      questionId,
    ]
  );

  // Recompute totals (AI-ready path can plug in later by setting marks the same way)
  return evaluateAttemptById(ev.attempt_id, actor);
}

async function getEvaluationById(
  evaluationId: string,
  opts?: { includeCorrect?: boolean; studentSafe?: boolean }
) {
  const ev = await queryOne<{
    id: string;
    attempt_id: string;
    campaign_id: string;
    user_id: string;
    assessment_id: string;
    status: EvaluationStatus;
    total_marks: number;
    obtained_marks: number;
    negative_marks: number;
    percentage: number;
    passing_marks: number;
    passed: boolean | null;
    needs_manual_review: boolean;
    evaluated_at: string | null;
    published_at: string | null;
    student_name: string | null;
    student_email: string | null;
    assessment_name: string;
    campaign_name: string;
    attempt_number: number;
    submitted_at: string | null;
  }>(
    `SELECT e.id, e.attempt_id, e.campaign_id, e.user_id, e.assessment_id, e.status,
            e.total_marks::float AS total_marks, e.obtained_marks::float AS obtained_marks,
            e.negative_marks::float AS negative_marks, e.percentage::float AS percentage,
            e.passing_marks::float AS passing_marks, e.passed, e.needs_manual_review,
            e.evaluated_at::text, e.published_at::text,
            u.name AS student_name, u.email AS student_email,
            a.name AS assessment_name, c.name AS campaign_name,
            att.attempt_number, att.submitted_at::text
     FROM college_campaign_evaluations e
     JOIN users u ON u.id = e.user_id
     JOIN college_assessments a ON a.id = e.assessment_id
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     WHERE e.id = $1`,
    [evaluationId]
  );
  if (!ev) throw new AppError("Evaluation not found.", 404);

  const questions = await query<{
    question_id: string;
    question_type: string;
    title: string;
    marks_possible: number;
    marks_awarded: number;
    is_correct: boolean | null;
    selected: unknown;
    correct_labels: unknown;
    evaluation_status: QuestionEvalStatus;
    manual_feedback: string | null;
  }>(
    `SELECT qr.question_id, qr.question_type, q.title,
            qr.marks_possible::float AS marks_possible,
            qr.marks_awarded::float AS marks_awarded,
            qr.is_correct, qr.selected, qr.correct_labels,
            qr.evaluation_status, qr.manual_feedback
     FROM college_campaign_question_results qr
     JOIN college_questions q ON q.id = qr.question_id
     WHERE qr.evaluation_id = $1
     ORDER BY q.created_at ASC`,
    [evaluationId]
  );

  return {
    ...ev,
    questions: questions.map((q) => ({
      question_id: q.question_id,
      question_type: q.question_type,
      title: q.title,
      marks_possible: q.marks_possible,
      marks_awarded: q.marks_awarded,
      is_correct: q.is_correct,
      selected: parseJsonArray(q.selected),
      correct_labels:
        opts?.includeCorrect && !opts?.studentSafe ? parseJsonArray(q.correct_labels) : undefined,
      evaluation_status: q.evaluation_status,
      manual_feedback: q.manual_feedback,
    })),
  };
}

export async function listCampaignResults(collegeId: string, campaignId: string) {
  await ensureEvaluationSchema();
  const camp = await queryOne<{
    id: string;
    name: string;
    campaign_code: string;
    show_result_immediately: boolean;
  }>(
    `SELECT id, name, campaign_code, show_result_immediately
     FROM college_assessment_campaigns
     WHERE id = $1 AND college_id = $2 AND deleted_at IS NULL`,
    [campaignId, collegeId]
  );
  if (!camp) throw new AppError("Campaign not found.", 404);

  const rows = await query<{
    id: string;
    attempt_id: string;
    user_id: string;
    student_name: string;
    student_email: string;
    attempt_number: number;
    status: EvaluationStatus;
    obtained_marks: number;
    total_marks: number;
    percentage: number;
    passed: boolean | null;
    needs_manual_review: boolean;
    submitted_at: string | null;
    published_at: string | null;
  }>(
    `SELECT e.id, e.attempt_id, e.user_id, u.name AS student_name, u.email AS student_email,
            att.attempt_number, e.status,
            e.obtained_marks::float AS obtained_marks, e.total_marks::float AS total_marks,
            e.percentage::float AS percentage, e.passed, e.needs_manual_review,
            att.submitted_at::text, e.published_at::text
     FROM college_campaign_evaluations e
     JOIN users u ON u.id = e.user_id
     JOIN college_campaign_attempts att ON att.id = e.attempt_id
     WHERE e.campaign_id = $1
     ORDER BY e.percentage DESC NULLS LAST, u.name ASC`,
    [campaignId]
  );

  const submittedCount = await queryOne<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM college_campaign_attempts
     WHERE campaign_id = $1 AND status IN ('submitted', 'expired')`,
    [campaignId]
  );

  return {
    campaign: camp,
    summary: {
      submitted: Number(submittedCount?.n || 0),
      evaluated: rows.length,
      published: rows.filter((r) => r.status === "published").length,
      needs_manual_review: rows.filter((r) => r.needs_manual_review).length,
      passed: rows.filter((r) => r.passed).length,
      failed: rows.filter((r) => r.passed === false).length,
    },
    results: rows,
  };
}

export async function getFacultyEvaluation(
  collegeId: string,
  campaignId: string,
  evaluationId: string
) {
  await ensureEvaluationSchema();
  const ok = await queryOne<{ id: string }>(
    `SELECT e.id FROM college_campaign_evaluations e
     JOIN college_assessment_campaigns c ON c.id = e.campaign_id
     WHERE e.id = $1 AND e.campaign_id = $2 AND c.college_id = $3`,
    [evaluationId, campaignId, collegeId]
  );
  if (!ok) throw new AppError("Evaluation not found.", 404);
  return getEvaluationById(evaluationId, { includeCorrect: true });
}

/** Student result — only when published (or immediate publish already applied). */
export async function getStudentResult(studentId: string, campaignId: string) {
  await ensureEvaluationSchema();
  const ev = await queryOne<{ id: string; status: EvaluationStatus }>(
    `SELECT id, status FROM college_campaign_evaluations
     WHERE campaign_id = $1 AND user_id = $2
     ORDER BY evaluated_at DESC NULLS LAST
     LIMIT 1`,
    [campaignId, studentId]
  );
  if (!ev) {
    throw new AppError("Result not available yet.", 404);
  }
  if (ev.status !== "published") {
    throw new AppError(
      "Results have not been published yet. Please check back later.",
      403
    );
  }
  // Student view: scores + pass/fail, hide correct answer keys
  return getEvaluationById(ev.id, { includeCorrect: false, studentSafe: true });
}
