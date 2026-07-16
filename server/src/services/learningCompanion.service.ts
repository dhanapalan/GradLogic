/**
 * AI Learning Companion (Phase 15) — "the final Copilot."
 *
 * A floating assistant available on every learning page, always scoped to
 * whatever knowledge object the student currently has open. This is a
 * superset persona of the Voice Tutor (Phase 6/7): same scope-lock and
 * streaming mechanism, more capabilities (Why/How/Diagram/Coding Example/
 * Real World Example/Placement Tips), and genuine RAG grounding — it
 * retrieves the top-K most semantically similar OTHER questions (via Phase
 * 10's real embeddings) as supporting context alongside the current
 * object's own fields, rather than answering from the LLM's parametric
 * knowledge alone.
 *
 * "Repeat" and "Voice" are deliberately NOT backend actions — Repeat just
 * re-speaks the last message client-side, and every reply is already spoken
 * via the same TTS pipeline as the Voice Tutor, so there is nothing to add
 * server-side for either.
 */

import { z } from "zod";
import { query } from "../config/database.js";
import { generateStream } from "./ai.service.js";
import { getKnowledgeObject, VOICE_TUTOR_LANGUAGES, type VoiceTutorLanguage, type KnowledgeObjectView } from "./voiceTutor.service.js";
import type { QuestionBankRow } from "../types/index.js";

export const COMPANION_ACTIONS = [
  "explain", "why", "how", "example", "hint", "translate",
  "diagram", "coding_example", "real_world_example", "placement_tips", "ask",
] as const;
export type CompanionAction = (typeof COMPANION_ACTIONS)[number];

export interface CompanionTurn {
  role: "student" | "companion";
  text: string;
}

const MAX_HISTORY_TURNS = 8;
const RAG_TOP_K = 3;
const RAG_SIMILARITY_FLOOR = 0.4; // below this, a "related" result isn't actually relevant enough to ground the answer

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Retrieval step of RAG: pulls the top-K other questions (same or related
 * category) whose stored embedding is most similar to the current object's
 * own embedding, to ground answers like "give a real-world example" or
 * "why does this work" in more than just the single question's own text.
 * Returns [] honestly if the current object has no embedding yet (Phase 10
 * backfills lazily) rather than fabricating grounding context.
 */
async function retrieveRagContext(ko: KnowledgeObjectView): Promise<string[]> {
  const rows = await query<{ search_embedding: number[] | null }>(
    `SELECT search_embedding FROM question_bank WHERE id = $1`,
    [ko.id],
  );
  const ownEmbedding = rows[0]?.search_embedding;
  if (!ownEmbedding) return [];

  const candidates = await query<Pick<QuestionBankRow, "id" | "question_text" | "explanation" | "search_embedding">>(
    `SELECT id, question_text, explanation, search_embedding FROM question_bank
     WHERE category = $1 AND id != $2 AND search_embedding IS NOT NULL
       AND is_active = TRUE AND status = 'published'
     LIMIT 100`,
    [ko.category, ko.id],
  );

  const ranked = candidates
    .map((c) => ({ c, sim: cosineSimilarity(ownEmbedding, c.search_embedding!) }))
    .filter((r) => r.sim >= RAG_SIMILARITY_FLOOR)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, RAG_TOP_K);

  return ranked.map((r) => `- ${r.c.question_text}${r.c.explanation ? ` (${r.c.explanation})` : ""}`);
}

const ACTION_INSTRUCTIONS: Record<Exclude<CompanionAction, "ask">, string> = {
  explain: "Explain the concept this question tests, clearly and simply, without revealing which option is correct.",
  why: "Explain WHY the underlying concept works the way it does — the reasoning/justification, not just what it is.",
  how: "Explain HOW to approach solving this step by step, procedurally — without giving the final answer.",
  example: "Walk through a different, analogous example that illustrates the same concept.",
  hint: "Give ONE short nudge toward the right approach, without revealing the final answer.",
  translate: "Translate the question into the target language, keeping technical terms intact.",
  diagram: "Describe a simple diagram (as a clear step-by-step text description, since no diagram-rendering is available) that would help visualize this concept.",
  coding_example: "Give a short code snippet (any common language, pick the most natural for this topic) that illustrates the underlying concept.",
  real_world_example: "Give a concrete real-world analogy or scenario where this concept applies.",
  placement_tips: "Give 1-2 practical tips for how this kind of question is likely to come up in a campus placement interview, and how to handle it.",
};

function buildSystemPrompt(ko: KnowledgeObjectView, language: VoiceTutorLanguage, ragContext: string[]): string {
  const languageName = VOICE_TUTOR_LANGUAGES[language].label;
  return [
    "You are the AI Learning Companion — a floating assistant available while a student studies. You are scoped to exactly ONE learning object (the question below) for this conversation.",
    "",
    "STRICT SCOPE: only discuss this learning object and directly related clarifications. If asked about anything else, politely decline in one sentence and steer back to this object. Never reveal the correct option.",
    "Keep responses short and conversational: 2-6 sentences, no markdown headings — this may be read aloud.",
    `Respond in ${languageName}.`,
    "",
    "Current learning object:",
    `Category: ${ko.category} | Difficulty: ${ko.difficulty_level}`,
    `Question: ${ko.question_text}`,
    ko.options ? `Options: ${ko.options.join(" | ")}` : "",
    ko.hint ? `Hint on file: ${ko.hint}` : "",
    ko.explanation ? `Explanation on file: ${ko.explanation}` : "",
    "",
    ragContext.length
      ? `Related context retrieved from the knowledge base (for your grounding only — do not go off-topic to discuss these, only use them to inform your answer about the current object):\n${ragContext.join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(action: CompanionAction, message: string | undefined, history: CompanionTurn[]): string {
  const trimmed = history.slice(-MAX_HISTORY_TURNS);
  const historyBlock = trimmed.length
    ? `Conversation so far:\n${trimmed.map((t) => `${t.role === "student" ? "Student" : "Companion"}: ${t.text}`).join("\n")}\n\n`
    : "";
  if (action === "ask") {
    return `${historyBlock}Student says: ${message?.trim() || "(no message)"}\n\nRespond as the companion.`;
  }
  return `${historyBlock}${ACTION_INSTRUCTIONS[action]}`;
}

export interface CompanionResult {
  text: string;
  requiresReview: boolean;
  ragUsed: boolean;
}

export async function converseCompanion(
  params: {
    learningObjectId: string;
    action: CompanionAction;
    message?: string;
    language: VoiceTutorLanguage;
    history: CompanionTurn[];
  },
  onDelta: (chunk: string) => void,
): Promise<CompanionResult> {
  const ko = await getKnowledgeObject(params.learningObjectId);
  const ragContext = await retrieveRagContext(ko);

  const system = buildSystemPrompt(ko, params.language, ragContext);
  const userPrompt = buildUserPrompt(params.action, params.message, params.history);

  const result = await generateStream(userPrompt, onDelta, { system, maxTokens: 500, riskLevel: "practice" });
  return { text: result.text, requiresReview: result.requiresReview, ragUsed: ragContext.length > 0 };
}

export const companionConverseRequestSchema = z.object({
  learningObjectId: z.string().uuid(),
  action: z.enum(COMPANION_ACTIONS),
  message: z.string().max(2000).optional(),
  language: z.enum(Object.keys(VOICE_TUTOR_LANGUAGES) as [VoiceTutorLanguage, ...VoiceTutorLanguage[]]),
  history: z
    .array(z.object({ role: z.enum(["student", "companion"]), text: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
});
