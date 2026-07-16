/**
 * AI Placement Coach — Voice Coaching (Phase 9).
 *
 * Reuses the exact streaming primitive from voiceTutor.service.ts
 * (generateStream from ai.service.ts) with a different persona: instead of
 * being scoped to one knowledge object, this conversation is scoped to the
 * student's placement prep for a target company/role — it can discuss their
 * weak skills, walk through interview questions, and give coaching feedback,
 * but still refuses to wander into unrelated topics.
 */

import { z } from "zod";
import { generateStream } from "./ai.service.js";
import { getWeakSkills } from "./adaptive.service.js";

export interface CoachConversationTurn {
  role: "student" | "coach";
  text: string;
}

const MAX_HISTORY_TURNS = 8;

function buildSystemPrompt(params: {
  skills: string[];
  weakCategoryLabels: string[];
  targetCompany?: string;
  targetRole?: string;
}): string {
  return [
    "You are an AI Placement Coach having a short spoken coaching conversation with a campus-placement candidate.",
    "",
    "HOW TO COACH:",
    "- Behave like a supportive, experienced placement coach/mock interviewer — ask questions, listen to the student's answer, then give brief constructive feedback (what was strong, what to improve) before moving on.",
    "- When appropriate, ask a realistic interview question (behavioral or technical) relevant to the student's target role/company and weak areas.",
    "- Be encouraging but honest — don't just say everything is great.",
    "- Keep the conversation scoped to placement/interview preparation for this student. If asked about anything unrelated, politely decline in one sentence and steer back to coaching.",
    "- Keep responses spoken-conversation length: 2-5 sentences, no markdown, no bullet lists — this will be read aloud.",
    "",
    params.targetCompany ? `Target company: ${params.targetCompany}` : "No specific target company given.",
    params.targetRole ? `Target role: ${params.targetRole}` : "",
    params.skills.length ? `Candidate's self-reported skills: ${params.skills.join(", ")}` : "",
    params.weakCategoryLabels.length ? `Areas needing more practice: ${params.weakCategoryLabels.join(", ")}` : "",
  ].filter(Boolean).join("\n");
}

export const coachConverseRequestSchema = z.object({
  message: z.string().max(2000),
  targetCompany: z.string().max(200).optional(),
  targetRole: z.string().max(200).optional(),
  history: z
    .array(z.object({ role: z.enum(["student", "coach"]), text: z.string().max(4000) }))
    .max(20)
    .optional()
    .default([]),
});

export interface CoachConverseResult {
  text: string;
  requiresReview: boolean;
}

export async function converseCoach(
  params: {
    studentId: string;
    message: string;
    targetCompany?: string;
    targetRole?: string;
    history: CoachConversationTurn[];
  },
  onDelta: (chunk: string) => void,
): Promise<CoachConverseResult> {
  const weakSkills = await getWeakSkills(params.studentId, 3);
  const weakCategoryLabels = weakSkills.map((s) => s.category.replace(/_/g, " "));

  const system = buildSystemPrompt({
    skills: [],
    weakCategoryLabels,
    targetCompany: params.targetCompany,
    targetRole: params.targetRole,
  });

  const trimmedHistory = params.history.slice(-MAX_HISTORY_TURNS);
  const historyBlock = trimmedHistory.length
    ? `Conversation so far:\n${trimmedHistory.map((t) => `${t.role === "student" ? "Student" : "Coach"}: ${t.text}`).join("\n")}\n\n`
    : "";
  const userPrompt = `${historyBlock}Student says: ${params.message}\n\nRespond as the coach.`;

  const result = await generateStream(userPrompt, onDelta, {
    system,
    maxTokens: 500,
    riskLevel: "practice",
  });

  return { text: result.text, requiresReview: result.requiresReview };
}
