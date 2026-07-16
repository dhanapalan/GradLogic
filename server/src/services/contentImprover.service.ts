/**
 * AI Content Improver (Phase 13).
 *
 * Rules this file exists to enforce:
 *   - "Improve" NEVER writes to question_bank. It reads the current row,
 *     asks the LLM for a specific, scoped improvement, validates the JSON
 *     shape, and stores the proposal as a new row in question_bank_versions
 *     with status='proposed'. The original question is untouched.
 *   - "Apply" is a separate, explicit action (applyVersion) that a
 *     superadmin takes deliberately — only then does the live question_bank
 *     row change, and only for the fields the version actually proposed.
 *   - Every version is retained (status becomes 'applied' or 'rejected', the
 *     row is never deleted) — that's the version history.
 */

import { z } from "zod";
import { query, queryOne } from "../config/database.js";
import { generateJSON } from "./ai.service.js";
import { AppError } from "../middleware/errorHandler.js";
import type { QuestionBankRow } from "../types/index.js";

export const IMPROVEMENT_TYPES = ["grammar", "distractors", "explanation", "examples", "difficulty", "coding_version"] as const;
export type ImprovementType = (typeof IMPROVEMENT_TYPES)[number];

async function getQuestion(questionId: string): Promise<QuestionBankRow> {
  const row = await queryOne<QuestionBankRow>(`SELECT * FROM question_bank WHERE id = $1`, [questionId]);
  if (!row) throw new AppError("Question not found", 404);
  return row;
}

const proposalSchema = z.object({
  question_text: z.string().optional(),
  options: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  hint: z.string().optional(),
  difficulty_level: z.enum(["easy", "medium", "hard"]).optional(),
  starter_code: z.record(z.string()).optional(),
  test_cases: z.array(z.object({ input: z.string(), expectedOutput: z.string(), hidden: z.boolean().optional() })).optional(),
  change_summary: z.string().min(1),
});

const IMPROVEMENT_PROMPTS: Record<ImprovementType, (q: QuestionBankRow) => string> = {
  grammar: (q) =>
    `Fix any grammar, spelling, and phrasing issues in this question's text and explanation, without changing its meaning or difficulty.\nQuestion: ${q.question_text}\nExplanation: ${q.explanation ?? "(none)"}\nReturn JSON: {"question_text": string, "explanation": string (if one existed), "change_summary": string describing what changed}.`,
  distractors: (q) =>
    `Improve the wrong-answer options (distractors) for this multiple-choice question so they're more plausible and less obviously wrong, WITHOUT changing the correct answer's position or wording.\nQuestion: ${q.question_text}\nCurrent options: ${JSON.stringify(q.options)}\nReturn JSON: {"options": string[] (same length and same correct answer, improved distractors), "change_summary": string}.`,
  explanation: (q) =>
    `Write a clearer, more thorough explanation for this question.\nQuestion: ${q.question_text}\nCurrent explanation: ${q.explanation ?? "(none)"}\nReturn JSON: {"explanation": string, "change_summary": string}.`,
  examples: (q) =>
    `Add or improve a worked example / hint that illustrates how to approach this question, without giving away the final answer.\nQuestion: ${q.question_text}\nCurrent hint: ${q.hint ?? "(none)"}\nReturn JSON: {"hint": string, "change_summary": string}.`,
  difficulty: (q) =>
    `Rewrite this question at a ${q.difficulty_level === "hard" ? "slightly easier" : "slightly harder"} difficulty than its current level (${q.difficulty_level}), keeping the same core concept.\nQuestion: ${q.question_text}\nOptions: ${JSON.stringify(q.options)}\nReturn JSON: {"question_text": string, "options": string[] (if applicable), "difficulty_level": "easy"|"medium"|"hard", "change_summary": string}.`,
  coding_version: (q) =>
    `Generate a coding-challenge version of this concept: turn it into a programming problem with starter code stubs and 2-4 test cases (input/expectedOutput).\nOriginal question: ${q.question_text}\nReturn JSON: {"question_text": string (coding problem statement), "starter_code": {"python": string, "javascript": string}, "test_cases": [{"input": string, "expectedOutput": string}], "change_summary": string}.`,
};

export interface QuestionVersion {
  id: string;
  question_id: string;
  improvement_type: ImprovementType;
  question_text: string | null;
  options: string[] | null;
  explanation: string | null;
  hint: string | null;
  difficulty_level: string | null;
  starter_code: Record<string, string> | null;
  test_cases: unknown[] | null;
  change_summary: string | null;
  status: "proposed" | "applied" | "rejected";
  created_at: string;
  applied_at: string | null;
}

export async function improveQuestion(questionId: string, improvementType: ImprovementType, createdBy: string): Promise<QuestionVersion> {
  const q = await getQuestion(questionId);
  const prompt = IMPROVEMENT_PROMPTS[improvementType](q);

  const raw = await generateJSON<unknown>(prompt, {
    system: "You are an AI content editor for an exam question bank. Respond with ONLY a JSON object matching the requested shape — no prose, no markdown.",
    riskLevel: "draft",
  });
  const { requiresReview: _rr, ...rest } = raw as Record<string, unknown>;
  const parsed = proposalSchema.safeParse(rest);
  if (!parsed.success) {
    throw new AppError("AI Content Improver returned a response that didn't match the expected shape", 502);
  }
  const p = parsed.data;

  const row = await queryOne<QuestionVersion>(
    `INSERT INTO question_bank_versions
       (question_id, improvement_type, question_text, options, explanation, hint, difficulty_level, starter_code, test_cases, change_summary, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
    [
      questionId,
      improvementType,
      p.question_text ?? null,
      p.options ? JSON.stringify(p.options) : null,
      p.explanation ?? null,
      p.hint ?? null,
      p.difficulty_level ?? null,
      p.starter_code ? JSON.stringify(p.starter_code) : null,
      p.test_cases ? JSON.stringify(p.test_cases) : null,
      p.change_summary,
      createdBy,
    ],
  );
  if (!row) throw new AppError("Failed to store proposed version", 500);
  return row;
}

export async function getVersionHistory(questionId: string): Promise<QuestionVersion[]> {
  return query<QuestionVersion>(
    `SELECT * FROM question_bank_versions WHERE question_id = $1 ORDER BY created_at DESC`,
    [questionId],
  );
}

/** Explicit, separate action: copies a proposed version's fields onto the live question_bank row. */
export async function applyVersion(versionId: string): Promise<QuestionBankRow> {
  const version = await queryOne<QuestionVersion>(`SELECT * FROM question_bank_versions WHERE id = $1`, [versionId]);
  if (!version) throw new AppError("Version not found", 404);
  if (version.status !== "proposed") throw new AppError(`Version is already ${version.status}`, 400);

  const updated = await queryOne<QuestionBankRow>(
    `UPDATE question_bank SET
       question_text = COALESCE($2, question_text),
       options = COALESCE($3, options),
       explanation = COALESCE($4, explanation),
       hint = COALESCE($5, hint),
       difficulty_level = COALESCE($6, difficulty_level)::difficulty_level,
       starter_code = COALESCE($7, starter_code),
       test_cases = COALESCE($8, test_cases),
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      version.question_id,
      version.question_text,
      version.options ? JSON.stringify(version.options) : null,
      version.explanation,
      version.hint,
      version.difficulty_level,
      version.starter_code ? JSON.stringify(version.starter_code) : null,
      version.test_cases ? JSON.stringify(version.test_cases) : null,
    ],
  );
  if (!updated) throw new AppError("Question not found", 404);

  await query(`UPDATE question_bank_versions SET status = 'applied', applied_at = NOW() WHERE id = $1`, [versionId]);
  return updated;
}

export async function rejectVersion(versionId: string): Promise<void> {
  await query(`UPDATE question_bank_versions SET status = 'rejected' WHERE id = $1 AND status = 'proposed'`, [versionId]);
}
