import { postSSE } from "../lib/sse";
import type { VoiceTutorLanguage } from "./voiceTutorService";

// =============================================================================
// AI Learning Companion (Phase 15) — client wrapper. Reuses the Voice
// Tutor's speech (STT/TTS) helpers directly — see voiceTutorService.ts's
// startListening/speakChunk/stopSpeaking/createSentenceSplitter.
// =============================================================================

export type CompanionAction =
  | "explain" | "why" | "how" | "example" | "hint" | "translate"
  | "diagram" | "coding_example" | "real_world_example" | "placement_tips" | "ask";

export interface CompanionTurn {
  role: "student" | "companion";
  text: string;
}

class LearningCompanionService {
  async getPostAssessmentContext() {
    const { default: api } = await import("../lib/api");
    const res = await api.get("/learning-companion/post-assessment");
    return res.data?.data as {
      id: string;
      drive_name: string | null;
      weak_topics: string[];
      strong_topics: string[];
      recommendations: string[];
      recommended_object_id: string | null;
      recommended_object_label: string | null;
      recommended_lesson_id: string | null;
      recommended_lesson_title: string | null;
      recommended_lesson_href: string | null;
      assigned_practice_topic: string | null;
      assigned_practice_difficulty: string | null;
      assigned_practice_href: string | null;
      placement_readiness: number | null;
      score_percent: number | null;
      loop_status: Record<string, boolean> | null;
      created_at: string;
    } | null;
  }

  async streamConverse(
    params: {
      learningObjectId: string;
      action: CompanionAction;
      message?: string;
      language: VoiceTutorLanguage;
      history: CompanionTurn[];
    },
    handlers: {
      onDelta: (chunk: string) => void;
      onDone: (result: { text: string; requiresReview: boolean; ragUsed: boolean }) => void;
      onError: (message: string) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    await postSSE("/learning-companion/converse", params, (event) => {
      if (event.type === "delta") handlers.onDelta(event.text);
      else if (event.type === "done") handlers.onDone(event);
      else if (event.type === "error") handlers.onError(event.message);
    }, signal);
  }
}

export default new LearningCompanionService();
