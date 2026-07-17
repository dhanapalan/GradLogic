/**
 * Groq client — used only for drive/assessment question generation.
 *
 * Deliberately kept separate from ai.service.ts (the Anthropic/Claude
 * client used by resume extraction, feedback, and learning-plan generation)
 * so nothing here can regress those Claude-dependent features. Mirrors
 * ai.service.ts's generate()/generateJSON() shape for consistency.
 */

import { env } from "../config/env.js";
import { AppError } from "../middleware/errorHandler.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

export interface GroqGenerateOptions {
  system?: string;
  maxTokens?: number;
}

// Upstream HTTP status + Retry-After (seconds, if Groq sent one) attached so
// callers can branch on 401/403 (bad key — will never succeed) vs 429 (rate
// limited — back off and retry) vs other failures, without this file's own
// AppError.statusCode (always 502, "our server's upstream call failed")
// leaking Groq's raw status into what would be returned to our own clients.
export class GroqApiError extends AppError {
  upstreamStatus: number;
  retryAfterSeconds: number | null;

  constructor(message: string, upstreamStatus: number, retryAfterSeconds: number | null = null) {
    super(message, 502);
    this.upstreamStatus = upstreamStatus;
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, GroqApiError.prototype);
  }
}

export async function generate(
  userPrompt: string,
  opts: GroqGenerateOptions = {},
): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new AppError("GROQ_API_KEY is not configured. Set it in your .env file.", 500);
  }
  const { system, maxTokens = 8000 } = opts;

  const res = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.GROQ_MODEL,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        ...(system ? [{ role: "system" as const, content: system }] : []),
        { role: "user" as const, content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!res.ok) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) || null : null;
    const body = await res.text().catch(() => "");
    throw new GroqApiError(
      `Groq API error ${res.status}: ${body.slice(0, 300)}`,
      res.status,
      retryAfterSeconds,
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new AppError("Groq returned an empty response", 502);
  return text;
}

/**
 * Convenience wrapper: call `generate` and parse the response as JSON.
 * response_format:"json_object" guarantees syntactically valid JSON, but
 * smaller Llama models occasionally still wrap output in markdown fences
 * under load — keep the same regex-extraction fallback ai.service.ts uses
 * for Claude rather than trusting JSON.parse(text) directly.
 */
export async function generateJSON<T>(
  userPrompt: string,
  opts: GroqGenerateOptions = {},
): Promise<T> {
  const text = await generate(userPrompt, opts);

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new AppError("Groq response contained no JSON object", 502);
  }

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    throw new AppError("Groq response was not valid JSON", 502);
  }
}
