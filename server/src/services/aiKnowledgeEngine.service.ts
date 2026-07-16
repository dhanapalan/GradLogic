/**
 * AI Knowledge Engine (Phase 5) — service abstraction for the 10 general-purpose
 * AI capabilities: Explain, Summarize, Improve, Generate, Translate, Recommend,
 * Validate, Difficulty Prediction, Bloom Classification, Skill Extraction.
 *
 * Rules this file exists to enforce:
 *   - Every capability returns structured JSON only, validated against a Zod
 *     schema before it's handed back — a malformed LLM response never reaches
 *     a caller as untyped data.
 *   - This module NEVER writes to the database. It is pure input → AI → typed
 *     output. Persisting a result (e.g. saving a generated hint onto a
 *     question_bank row) is the caller's responsibility via the existing
 *     question-bank write paths (createQuestion/updateQuestion), which already
 *     carry their own validation and audit trail.
 *   - All LLM calls go through ai.service.ts's generateJSON(), never a vendor
 *     SDK directly — same rule ai.service.ts itself states for its callers.
 */

import { z } from "zod";
import { generateJSON } from "./ai.service.js";
import { AppError } from "../middleware/errorHandler.js";

// ── Shared plumbing ────────────────────────────────────────────────────────

/**
 * Calls the LLM for one capability and validates the parsed JSON against
 * `schema`. Throws a 502 AppError (not a raw ZodError) if the model's output
 * doesn't match the contract — callers can trust a resolved promise's shape.
 */
async function runCapability<T>(
  capability: string,
  prompt: string,
  schema: z.ZodType<T>,
  opts: { system?: string; riskLevel?: "practice" | "draft" | "graded" } = {},
): Promise<T & { requiresReview: boolean }> {
  const raw = await generateJSON<unknown>(prompt, {
    system: opts.system,
    riskLevel: opts.riskLevel ?? "draft",
  });
  const { requiresReview, ...rest } = raw as { requiresReview: boolean } & Record<string, unknown>;
  const parsed = schema.safeParse(rest);
  if (!parsed.success) {
    throw new AppError(
      `AI Knowledge Engine (${capability}) returned a response that didn't match the expected shape`,
      502,
    );
  }
  return { ...parsed.data, requiresReview };
}

const JSON_ONLY_SYSTEM =
  "You are a backend AI service. Respond with ONLY a single JSON object matching the requested shape — no prose, no markdown fences, no commentary.";

// ── 1. Explain ───────────────────────────────────────────────────────────────

const explainSchema = z.object({
  explanation: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
});
export type ExplainResult = z.infer<typeof explainSchema>;

export async function explain(content: string, audience?: string) {
  const prompt = `Explain the following content clearly${audience ? ` for a ${audience} audience` : ""}. Return JSON: {"explanation": string, "keyPoints": string[]}.\n\nContent:\n${content}`;
  return runCapability("explain", prompt, explainSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "practice" });
}

// ── 2. Summarize ─────────────────────────────────────────────────────────────

const summarizeSchema = z.object({
  summary: z.string().min(1),
});
export type SummarizeResult = z.infer<typeof summarizeSchema>;

export async function summarize(content: string, maxWords?: number) {
  const prompt = `Summarize the following content${maxWords ? ` in at most ${maxWords} words` : ""}. Return JSON: {"summary": string}.\n\nContent:\n${content}`;
  return runCapability("summarize", prompt, summarizeSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "practice" });
}

// ── 3. Improve ───────────────────────────────────────────────────────────────

const improveSchema = z.object({
  improved: z.string().min(1),
  changes: z.array(z.string()).default([]),
});
export type ImproveResult = z.infer<typeof improveSchema>;

export async function improve(content: string, focus?: string) {
  const prompt = `Improve the following content${focus ? ` with a focus on ${focus}` : " for clarity and correctness"}, preserving its original meaning. Return JSON: {"improved": string, "changes": string[]} where changes is a short list of what was changed and why.\n\nContent:\n${content}`;
  return runCapability("improve", prompt, improveSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "draft" });
}

// ── 4. Generate ──────────────────────────────────────────────────────────────

const generateSchema = z.object({
  items: z.array(z.string().min(1)).min(1),
});
export type GenerateResult = z.infer<typeof generateSchema>;

/**
 * General-purpose short-form content generation (e.g. hints, learning
 * objectives, flashcard prompts) — distinct from the Python engine's
 * RAG-grounded question generation in questionBankAI.routes.ts, which
 * remains the path for full MCQ/coding-challenge authoring.
 */
export async function generateItems(instruction: string, count = 3) {
  const prompt = `${instruction}\n\nGenerate exactly ${count} distinct items. Return JSON: {"items": string[]} with exactly ${count} entries.`;
  return runCapability("generate", prompt, generateSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "draft" });
}

// ── 5. Translate ─────────────────────────────────────────────────────────────

const translateSchema = z.object({
  translated: z.string().min(1),
});
export type TranslateResult = z.infer<typeof translateSchema>;

export async function translate(content: string, targetLanguage: string) {
  const prompt = `Translate the following content into ${targetLanguage}. Preserve formatting and technical terms where translation would lose meaning. Return JSON: {"translated": string}.\n\nContent:\n${content}`;
  return runCapability("translate", prompt, translateSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "practice" });
}

// ── 6. Recommend ─────────────────────────────────────────────────────────────

const recommendSchema = z.object({
  recommendations: z
    .array(
      z.object({
        title: z.string().min(1),
        reason: z.string().min(1),
      }),
    )
    .default([]),
});
export type RecommendResult = z.infer<typeof recommendSchema>;

export async function recommend(context: string, count = 5) {
  const prompt = `Given this context, recommend up to ${count} relevant next items (e.g. topics to study, questions to attempt, skills to practice). Return JSON: {"recommendations": [{"title": string, "reason": string}]}.\n\nContext:\n${context}`;
  return runCapability("recommend", prompt, recommendSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "practice" });
}

// ── 7. Validate ──────────────────────────────────────────────────────────────

const validateSchema = z.object({
  valid: z.boolean(),
  issues: z.array(z.string()).default([]),
});
export type ValidateResult = z.infer<typeof validateSchema>;

export async function validateContent(content: string, criteria?: string) {
  const prompt = `Review the following content${criteria ? ` against these criteria: ${criteria}` : " for correctness, clarity, and internal consistency"}. Return JSON: {"valid": boolean, "issues": string[]} where issues is empty if valid is true.\n\nContent:\n${content}`;
  return runCapability("validate", prompt, validateSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "draft" });
}

// ── 8. Difficulty Prediction ─────────────────────────────────────────────────

const difficultySchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard"]),
  confidence: z.number().min(0).max(1),
  rationale: z.string().optional(),
});
export type DifficultyResult = z.infer<typeof difficultySchema>;

export async function predictDifficulty(questionText: string) {
  const prompt = `Predict the difficulty of this question for a campus-recruitment aptitude/technical test. Return JSON: {"difficulty": "easy"|"medium"|"hard", "confidence": number between 0 and 1, "rationale": string}.\n\nQuestion:\n${questionText}`;
  return runCapability("difficulty-prediction", prompt, difficultySchema, { system: JSON_ONLY_SYSTEM, riskLevel: "draft" });
}

// ── 9. Bloom Classification ──────────────────────────────────────────────────

const bloomSchema = z.object({
  bloomLevel: z.enum(["remember", "understand", "apply", "analyze", "evaluate", "create"]),
  confidence: z.number().min(0).max(1),
});
export type BloomResult = z.infer<typeof bloomSchema>;

export async function classifyBloom(questionText: string) {
  const prompt = `Classify this question by Bloom's Taxonomy level. Return JSON: {"bloomLevel": "remember"|"understand"|"apply"|"analyze"|"evaluate"|"create", "confidence": number between 0 and 1}.\n\nQuestion:\n${questionText}`;
  return runCapability("bloom-classification", prompt, bloomSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "draft" });
}

// ── 10. Skill Extraction ─────────────────────────────────────────────────────

const skillExtractionSchema = z.object({
  skills: z.array(z.string().min(1)).default([]),
});
export type SkillExtractionResult = z.infer<typeof skillExtractionSchema>;

export async function extractSkills(content: string) {
  const prompt = `Extract the distinct technical/subject-matter skills or topics demonstrated or required by this content. Return JSON: {"skills": string[]} — short lowercase-hyphenated tags (e.g. "binary-search", "sql-joins").\n\nContent:\n${content}`;
  return runCapability("skill-extraction", prompt, skillExtractionSchema, { system: JSON_ONLY_SYSTEM, riskLevel: "practice" });
}
