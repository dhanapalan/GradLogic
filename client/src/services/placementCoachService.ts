import api from "../lib/api";
import { postSSE } from "../lib/sse";
import type { SkillAccuracy, LearningPath } from "./adaptiveLearningService";

// =============================================================================
// AI Placement Coach (Phase 9) — client wrapper.
// Voice Coaching reuses the exact same speech (STT/TTS) helpers as the Voice
// Tutor (Phase 6) — see voiceTutorService.ts's startListening/speakChunk/
// stopSpeaking/createSentenceSplitter — only the SSE endpoint differs.
// =============================================================================

export interface InterviewQuestion {
  question: string;
  type: "behavioral" | "technical" | "company_specific";
  focusSkill?: string;
}

export interface CodingChallengeRef {
  id: string;
  question_text: string;
  category: string;
  difficulty_level: string;
  marks: number;
}

export interface PlacementReadiness {
  score: number;
  label: "Getting started" | "Building readiness" | "Interview ready" | "Highly prepared";
  breakdown: { practiceAccuracyScore: number; examScore: number; profileCompletenessScore: number };
  dataQuality: "low" | "moderate" | "good";
}

export interface PlacementCoachReport {
  readiness: PlacementReadiness;
  weakSkills: SkillAccuracy[];
  interviewQuestions: InterviewQuestion[];
  codingChallenges: CodingChallengeRef[];
  studyPlan: LearningPath;
  skills: string[];
  hasResume: boolean;
}

export interface CoachConversationTurn {
  role: "student" | "coach";
  text: string;
}

class PlacementCoachService {
  async getReport(targetCompany?: string, targetRole?: string): Promise<PlacementCoachReport> {
    const res = await api.get("/placement-coach/report", { params: { targetCompany, targetRole } });
    return res.data.data;
  }

  async streamConverse(
    params: { message: string; targetCompany?: string; targetRole?: string; history: CoachConversationTurn[] },
    handlers: {
      onDelta: (chunk: string) => void;
      onDone: (result: { text: string; requiresReview: boolean }) => void;
      onError: (message: string) => void;
    },
    signal?: AbortSignal,
  ): Promise<void> {
    await postSSE("/placement-coach/voice/converse", params, (event) => {
      if (event.type === "delta") handlers.onDelta(event.text);
      else if (event.type === "done") handlers.onDone(event);
      else if (event.type === "error") handlers.onError(event.message);
    }, signal);
  }
}

export default new PlacementCoachService();
