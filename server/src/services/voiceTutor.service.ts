/**
 * AI Voice Tutor (Phase 6) + AI Teacher (Phase 7) — a scoped conversational
 * tutor over exactly one knowledge object (question_bank row) that behaves
 * like a human teacher: explains, asks follow-up questions, hints
 * progressively, and adapts to how the student has been doing on this topic.
 *
 * Scope rules this file exists to enforce:
 *   - Every prompt is built server-side from a question fetched by ID from
 *     the database — never from client-supplied question text. A student
 *     cannot widen the conversation's scope by sending arbitrary "context".
 *   - correct_answer is NEVER included in the prompt, in a Listen
 *     transcript, or handed over on request — the tutor guides (hints,
 *     explains the concept, asks a follow-up, gives an analogous example)
 *     and explicitly declines direct "just tell me the answer" requests.
 *   - The system prompt explicitly refuses to discuss anything outside the
 *     current question and redirects back to it — one topic per session.
 *   - All LLM calls go through ai.service.ts (generate/generateStream) —
 *     same rule that file states for every other caller in the codebase.
 */

import { z } from "zod";
import { query, queryOne } from "../config/database.js";
import { generateStream } from "./ai.service.js";
import { AppError } from "../middleware/errorHandler.js";
import type { QuestionBankRow } from "../types/index.js";

export const VOICE_TUTOR_ACTIONS = ["listen", "explain", "hint", "example", "translate", "ask"] as const;
export type VoiceTutorAction = (typeof VOICE_TUTOR_ACTIONS)[number];

export const VOICE_TUTOR_LANGUAGES = {
  en: { label: "English", bcp47: "en-IN" },
  ta: { label: "Tamil", bcp47: "ta-IN" },
  hi: { label: "Hindi", bcp47: "hi-IN" },
  ml: { label: "Malayalam", bcp47: "ml-IN" },
  te: { label: "Telugu", bcp47: "te-IN" },
} as const;
export type VoiceTutorLanguage = keyof typeof VOICE_TUTOR_LANGUAGES;

export interface ConversationTurn {
  role: "student" | "tutor";
  text: string;
}

/** A safe, non-spoiling projection of a question — never includes correct_answer. */
export interface KnowledgeObjectView {
  id: string;
  question_text: string;
  category: string;
  type: string;
  difficulty_level: string;
  options: string[] | null;
  hint: string | null;
  explanation: string | null;
  learning_objectives: string[];
  bloom_level: string | null;
}

/** Fetches the student-safe projection of one question_bank row by ID. */
export async function getKnowledgeObject(questionId: string): Promise<KnowledgeObjectView> {
  const row = await queryOne<QuestionBankRow>(
    `SELECT id, question_text, category, type, difficulty_level, options,
            hint, explanation, learning_objectives, bloom_level
     FROM question_bank
     WHERE id = $1 AND is_active = TRUE`,
    [questionId],
  );
  if (!row) throw new AppError("Knowledge object not found", 404);
  return {
    id: row.id,
    question_text: row.question_text,
    category: row.category,
    type: row.type,
    difficulty_level: row.difficulty_level,
    options: (row.options as string[] | null) ?? null,
    hint: row.hint,
    explanation: row.explanation,
    learning_objectives: row.learning_objectives ?? [],
    bloom_level: row.bloom_level,
  };
}

const MAX_HISTORY_TURNS = 6;

const ACTION_INSTRUCTIONS: Record<Exclude<VoiceTutorAction, "listen">, string> = {
  explain: "Explain the underlying concept this question is testing, clearly and simply, without stating which option is correct. End with ONE short follow-up question that checks whether the student is following, or nudges them to start reasoning about the question themselves.",
  hint: "Give ONE short nudge that helps the student think about the right approach, without revealing or implying the final answer.",
  example: "Walk through a different, analogous example that illustrates the same concept — do not solve the original question.",
  translate: "Translate the question (and its options, if any) faithfully into the target language. Do not add commentary or reveal the answer.",
  ask: "Respond as the teacher to what the student just said or asked, staying strictly within the scope of the knowledge object below.",
};

/** Bucket of how the student has recently been doing in this question's category. */
export type PerformanceLevel = "struggling" | "developing" | "confident" | "unknown";

export interface StudentPerformance {
  attempted: number;
  correct: number;
  level: PerformanceLevel;
}

/**
 * Looks at the student's last 20 practice attempts in this question's
 * category to gauge how much scaffolding they currently need — the "adapt
 * explanation based on student performance" requirement. This is a signal
 * for the AI Teacher's tone/pacing, never something the student can spoof:
 * it's computed server-side from their own attempt history, keyed by their
 * JWT-derived studentId.
 */
export async function getStudentPerformance(studentId: string, category: string): Promise<StudentPerformance> {
  const rows = await query<{ is_correct: boolean }>(
    `SELECT pa.is_correct
     FROM practice_attempts pa
     JOIN practice_sessions ps ON ps.id = pa.session_id
     JOIN question_bank qb ON qb.id = pa.question_id
     WHERE ps.student_id = $1 AND qb.category::text = $2 AND pa.is_correct IS NOT NULL
     ORDER BY pa.attempted_at DESC
     LIMIT 20`,
    [studentId, category],
  );
  const attempted = rows.length;
  const correct = rows.filter((r) => r.is_correct).length;
  if (attempted < 3) return { attempted, correct, level: "unknown" };
  const accuracy = correct / attempted;
  const level: PerformanceLevel = accuracy < 0.5 ? "struggling" : accuracy < 0.8 ? "developing" : "confident";
  return { attempted, correct, level };
}

const PERFORMANCE_GUIDANCE: Record<PerformanceLevel, string> = {
  struggling: "This student has been getting most recent questions in this topic wrong. Use extra scaffolding: simpler language, smaller steps, more encouragement, and check understanding often.",
  developing: "This student has mixed results in this topic recently. Balance explanation with questions — don't over-simplify, but confirm understanding before moving on.",
  confident: "This student has been doing well in this topic recently. You can move faster, ask sharper follow-up questions, and push their reasoning further rather than over-explaining basics.",
  unknown: "No reliable performance history yet for this topic — teach at a standard, moderate pace.",
};

function buildSystemPrompt(ko: KnowledgeObjectView, language: VoiceTutorLanguage, performance: StudentPerformance): string {
  const languageName = VOICE_TUTOR_LANGUAGES[language].label;
  return [
    "You are an AI Teacher embedded in a student learning app — you behave like a supportive, patient human tutor, not a search engine. You are having a short spoken conversation with a student about ONE specific question (the \"knowledge object\") below.",
    "",
    "HOW TO TEACH:",
    "- Explain concepts in your own words, then check understanding with a short follow-up question rather than lecturing at length.",
    "- Encourage the student's own reasoning: ask \"what do you think happens if...\" / \"why might that be...\" instead of just stating facts.",
    "- Give hints progressively, one small step at a time — never the full solution in one go.",
    "- NEVER reveal or confirm the correct option, even if the student asks directly, insists, or claims a deadline/emergency. You do not even know the correct option. If pressed, gently decline in one sentence and offer the next hint or a guiding question instead.",
    "- Keep the conversation to this ONE topic only. If the student asks about anything else (another subject, unrelated chit-chat, a request to move on to a different question), politely decline in one sentence and steer back to this question.",
    "- Keep responses spoken-conversation length: 2-5 sentences, no markdown, no headings, no bullet lists — this will be read aloud.",
    `- Respond in ${languageName}.`,
    "",
    `Student's recent performance in this topic (${performance.attempted} recent attempts, ${performance.correct} correct): ${PERFORMANCE_GUIDANCE[performance.level]}`,
    "",
    "Knowledge object:",
    `Category: ${ko.category} | Difficulty: ${ko.difficulty_level}`,
    `Question: ${ko.question_text}`,
    ko.options ? `Options: ${ko.options.join(" | ")}` : "",
    ko.hint ? `Existing hint on file: ${ko.hint}` : "",
    ko.explanation ? `Existing explanation on file (for your own grounding only — do not just recite it verbatim, teach it): ${ko.explanation}` : "",
    ko.learning_objectives.length ? `Learning objectives: ${ko.learning_objectives.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

function buildUserPrompt(action: Exclude<VoiceTutorAction, "listen">, message: string | undefined, history: ConversationTurn[]): string {
  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS);
  const historyBlock = trimmedHistory.length
    ? `Conversation so far:\n${trimmedHistory.map((t) => `${t.role === "student" ? "Student" : "Tutor"}: ${t.text}`).join("\n")}\n\n`
    : "";

  if (action === "ask") {
    return `${historyBlock}Student says: ${message?.trim() || "(no message provided)"}\n\nRespond as the teacher.`;
  }
  const instruction = ACTION_INSTRUCTIONS[action];
  return `${historyBlock}${instruction}`;
}

/**
 * Wraps plain spoken text in a minimal, valid SSML document. Browser
 * speechSynthesis (the client's actual TTS engine) does not parse SSML tags
 * — it only speaks plain text — so the client extracts plain text for
 * playback and keeps this `ssml` field as the structured API output, ready
 * to feed a real SSML-aware TTS engine (Polly/Google/Azure) if one is wired
 * in later, matching the provider-agnostic pattern in ai.service.ts.
 */
function toSsml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withBreaks = escaped.replace(/([.!?])\s+/g, "$1<break time=\"350ms\"/> ");
  return `<speak><prosody rate="95%">${withBreaks}</prosody></speak>`;
}

export interface ConverseResult {
  text: string;
  ssml: string;
  requiresReview: boolean;
}

/**
 * Runs one Voice Tutor turn, streaming plain-text deltas to `onDelta` as
 * they arrive (so the client can start speaking sentences before the full
 * reply finishes generating) and returning the final text + SSML.
 *
 * "listen" is handled entirely without an LLM call — it just reads out the
 * question itself, verbatim, from the database.
 */
export async function converse(
  params: {
    questionId: string;
    action: VoiceTutorAction;
    message?: string;
    language: VoiceTutorLanguage;
    history: ConversationTurn[];
    studentId: string;
  },
  onDelta: (chunk: string) => void,
): Promise<ConverseResult> {
  const ko = await getKnowledgeObject(params.questionId);

  if (params.action === "listen") {
    const parts = [ko.question_text];
    if (ko.options?.length) parts.push(ko.options.map((o, i) => `Option ${i + 1}: ${o}`).join(". "));
    const text = parts.join(". ");
    onDelta(text);
    return { text, ssml: toSsml(text), requiresReview: false };
  }

  const performance = await getStudentPerformance(params.studentId, ko.category);
  const system = buildSystemPrompt(ko, params.language, performance);
  const userPrompt = buildUserPrompt(params.action, params.message, params.history);

  const result = await generateStream(userPrompt, onDelta, {
    system,
    maxTokens: 600,
    riskLevel: "practice",
  });

  return { text: result.text, ssml: toSsml(result.text), requiresReview: result.requiresReview };
}

export const converseRequestSchema = z.object({
  questionId: z.string().uuid(),
  action: z.enum(VOICE_TUTOR_ACTIONS),
  message: z.string().max(2000).optional(),
  language: z.enum(Object.keys(VOICE_TUTOR_LANGUAGES) as [VoiceTutorLanguage, ...VoiceTutorLanguage[]]),
  history: z
    .array(z.object({ role: z.enum(["student", "tutor"]), text: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
});
