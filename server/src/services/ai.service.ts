/**
 * AI / Intelligence module — provider-agnostic client.
 *
 * All LLM and embedding calls in the codebase go through this file.
 * Never call @anthropic-ai/sdk, openai, or any other vendor SDK directly
 * from feature code. Swap the provider here without touching callers.
 *
 * Risk gate (from architecture doc §8):
 *   - Practice / learning / question-draft paths → can run more autonomously.
 *   - Graded / hiring outcomes → must go to a human review queue + audit log.
 *     These functions return a "draft" marker and the caller is responsible
 *     for routing through review before the output affects a score or decision.
 */

import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../middleware/errorHandler.js";

// ── Provider client (singleton, lazy) ─────────────────────────────────────────

let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    if (!env.ANTHROPIC_API_KEY) {
      throw new AppError(
        "ANTHROPIC_API_KEY is not configured. Set it in your .env file.",
        500,
      );
    }
    _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  }
  return _client;
}

// ── Core text generation ───────────────────────────────────────────────────────

export interface GenerateOptions {
  system?: string;
  maxTokens?: number;
  /** "draft" = result needs human review before affecting graded/hiring outcomes */
  riskLevel?: "practice" | "draft" | "graded";
}

export interface GenerateResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
  /** true when riskLevel is "draft" or "graded" — caller must route to review queue */
  requiresReview: boolean;
}

export async function generate(
  userPrompt: string,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const { system, maxTokens = 8000, riskLevel = "practice" } = opts;

  logger.info("[AI] generate called", {
    model: env.ANTHROPIC_MODEL,
    maxTokens,
    riskLevel,
    promptLength: userPrompt.length,
  });

  const message = await getClient().messages.create({
    model: env.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: userPrompt }],
  });

  if (message.stop_reason === "max_tokens") {
    throw new AppError(
      "AI response exceeded token limit. Try requesting a shorter output.",
      502,
    );
  }

  const text = (message.content[0] as { type: string; text: string }).text;
  if (!text) throw new AppError("AI returned an empty response", 502);

  return {
    text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    requiresReview: riskLevel !== "practice",
  };
}

/**
 * Streaming variant of `generate`. Calls `onDelta` with each text chunk as it
 * arrives from the model so a caller (e.g. the Voice Tutor) can start acting
 * on partial output — speaking sentences aloud — before generation finishes.
 * Returns the same shape as `generate` once the stream completes.
 */
export async function generateStream(
  userPrompt: string,
  onDelta: (chunk: string) => void,
  opts: GenerateOptions = {},
): Promise<GenerateResult> {
  const { system, maxTokens = 2000, riskLevel = "practice" } = opts;

  logger.info("[AI] generateStream called", {
    model: env.ANTHROPIC_MODEL,
    maxTokens,
    riskLevel,
    promptLength: userPrompt.length,
  });

  const stream = getClient().messages.stream({
    model: env.ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages: [{ role: "user", content: userPrompt }],
  });

  stream.on("text", (delta) => onDelta(delta));

  const message = await stream.finalMessage();

  if (message.stop_reason === "max_tokens") {
    throw new AppError(
      "AI response exceeded token limit. Try requesting a shorter output.",
      502,
    );
  }

  const text = (message.content[0] as { type: string; text: string }).text;
  if (!text) throw new AppError("AI returned an empty response", 502);

  return {
    text,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    requiresReview: riskLevel !== "practice",
  };
}

/**
 * Convenience wrapper: call `generate` and parse the response as JSON.
 * Strips markdown fences the model occasionally adds.
 */
export async function generateJSON<T>(
  userPrompt: string,
  opts: GenerateOptions = {},
): Promise<T & { requiresReview: boolean }> {
  const result = await generate(userPrompt, opts);

  const jsonMatch = result.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError("AI response contained no JSON object", 502);
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as T;
    return { ...parsed, requiresReview: result.requiresReview };
  } catch {
    throw new AppError("AI response was not valid JSON", 502);
  }
}

// ── Embeddings ─────────────────────────────────────────────────────────────────
// Anthropic doesn't expose an embedding endpoint; we use the lightweight
// open-source sentence-transformers model already loaded by the question-bank
// Python engine (QUESTION_ENGINE_URL, port 8001 in local dev — same engine
// questionBankAI.routes.ts talks to) rather than AI_ENGINE_URL (port 8000,
// the proctoring/matching engine, which has no /embed route). No pgvector
// extension is installed in this database — embeddings are stored as a plain
// float array and ranked with in-application cosine similarity (see
// aiSearch.service.ts), not an indexed vector column.

const QUESTION_ENGINE_URL = process.env.QUESTION_ENGINE_URL || "http://host.docker.internal:8001";

export interface EmbeddingResult {
  vector: number[];
  model: string;
}

/**
 * Generate an embedding vector for `text` via the question-bank engine's
 * /embed route (added for Phase 10 AI Search), which reuses its already-
 * loaded sentence-transformers model — no extra model download/cost.
 */
export async function embed(text: string): Promise<EmbeddingResult> {
  try {
    const res = await fetch(`${QUESTION_ENGINE_URL}/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`AI engine returned ${res.status}`);
    }

    const data = (await res.json()) as { vector: number[]; model: string };
    return data;
  } catch (err: any) {
    // Non-fatal: embedding is used for search/dedup, not for graded outcomes.
    // Log and return a zero vector so callers can continue without it.
    logger.warn("[AI] embed() failed — returning zero vector", { error: err.message });
    return { vector: [], model: "unavailable" };
  }
}
