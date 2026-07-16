/**
 * Multi-language Learning / AI Translator (Phase 14).
 *
 * Reuses Voice Tutor's student-safe knowledge-object projection and language
 * set (Phase 6) — "Voice" translation is already fully covered by the Voice
 * Tutor's "translate" action + its existing TTS pipeline (Phase 6/7); this
 * file adds the piece that was missing: translating Question + Explanation +
 * Hint + Examples together, structured, for a text reading view (not just
 * spoken output).
 */

import { z } from "zod";
import { generateJSON } from "./ai.service.js";
import { getKnowledgeObject, VOICE_TUTOR_LANGUAGES, type VoiceTutorLanguage } from "./voiceTutor.service.js";
import { AppError } from "../middleware/errorHandler.js";

const translationSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).optional(),
  explanation: z.string().optional(),
  hint: z.string().optional(),
  examples: z.array(z.string()).optional(),
});
export type TranslatedKnowledgeObject = z.infer<typeof translationSchema>;

export async function translateKnowledgeObject(questionId: string, language: VoiceTutorLanguage): Promise<TranslatedKnowledgeObject> {
  if (language === "en") {
    // Nothing to translate — return the original fields verbatim so the
    // client can render one consistent shape regardless of language.
    const ko = await getKnowledgeObject(questionId);
    return {
      question: ko.question_text,
      options: ko.options ?? undefined,
      explanation: ko.explanation ?? undefined,
      hint: ko.hint ?? undefined,
    };
  }

  const ko = await getKnowledgeObject(questionId);
  const languageName = VOICE_TUTOR_LANGUAGES[language].label;

  const prompt = [
    `Translate the following exam question content into ${languageName}.`,
    "CRITICAL: keep technical terms, proper nouns, code, variable names, mathematical notation, and units UNTRANSLATED — write them exactly as given (e.g. keep \"SQL JOIN\", \"array\", \"O(n log n)\", \"CPU\" in their original English/technical form even inside translated sentences). Translate everything else naturally.",
    "Also add one or two short additional worked examples (in the target language, same technical-terms rule) that help explain the concept, if useful.",
    "",
    `Question: ${ko.question_text}`,
    ko.options ? `Options: ${ko.options.join(" | ")}` : "",
    ko.explanation ? `Explanation: ${ko.explanation}` : "",
    ko.hint ? `Hint: ${ko.hint}` : "",
    "",
    'Return JSON: {"question": string, "options": string[] (if options existed, same count/order), "explanation": string (if one existed), "hint": string (if one existed), "examples": string[] (0-2 new examples, optional)}.',
  ].filter(Boolean).join("\n");

  const raw = await generateJSON<unknown>(prompt, {
    system: "You are a professional technical translator for an exam-prep app. Respond with ONLY a JSON object matching the requested shape — no prose, no markdown.",
    riskLevel: "practice",
  });
  const { requiresReview: _rr, ...rest } = raw as Record<string, unknown>;
  const parsed = translationSchema.safeParse(rest);
  if (!parsed.success) {
    throw new AppError("Translation returned a response that didn't match the expected shape", 502);
  }
  return parsed.data;
}
