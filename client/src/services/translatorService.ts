import api from "../lib/api";
import type { VoiceTutorLanguage } from "./voiceTutorService";

// =============================================================================
// Multi-language Learning / AI Translator (Phase 14) — client wrapper.
// =============================================================================

export interface TranslatedKnowledgeObject {
  question: string;
  options?: string[];
  explanation?: string;
  hint?: string;
  examples?: string[];
}

class TranslatorService {
  async translate(questionId: string, language: VoiceTutorLanguage): Promise<TranslatedKnowledgeObject> {
    const res = await api.get(`/translator/${questionId}`, { params: { language } });
    return res.data.data;
  }
}

export default new TranslatorService();
