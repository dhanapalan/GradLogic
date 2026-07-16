import api from "../lib/api";

// =============================================================================
// Adaptive Learning (Phase 8) — client wrapper over /api/adaptive-learning/*.
// =============================================================================

export interface SkillAccuracy {
  category: string;
  attempts: number;
  correct: number;
  accuracy: number;
  avgTimeSeconds: number;
  hasEnoughData: boolean;
}

export interface LessonRecommendation {
  id: string;
  title: string;
  moduleType: string;
  durationMinutes: number | null;
  difficulty: string | null;
}

export interface PracticeQuestionRef {
  id: string;
  question_text: string;
  difficulty_level: "easy" | "medium" | "hard";
}

export interface NextRecommendation {
  weakestSkill: SkillAccuracy;
  recommendedDifficulty: "easy" | "medium" | "hard";
  nextQuestion: { id: string; question_text: string } | null;
  nextLesson: LessonRecommendation | null;
  estimatedLearningTimeMinutes: number;
}

export interface LearningPathStep {
  order: number;
  category: string;
  accuracy: number;
  attempts: number;
  hasEnoughData: boolean;
  difficulty: "easy" | "medium" | "hard";
  lesson: LessonRecommendation | null;
  practiceQuestions: PracticeQuestionRef[];
  estimatedMinutes: number;
}

export interface LearningPath {
  steps: LearningPathStep[];
  totalEstimatedMinutes: number;
}

class AdaptiveLearningService {
  async getTrack(): Promise<SkillAccuracy[]> {
    const res = await api.get("/adaptive-learning/track");
    return res.data.data;
  }

  async getWeakSkills(limit = 5): Promise<SkillAccuracy[]> {
    const res = await api.get("/adaptive-learning/weak-skills", { params: { limit } });
    return res.data.data;
  }

  async getRecommendation(): Promise<NextRecommendation> {
    const res = await api.get("/adaptive-learning/recommend");
    return res.data.data;
  }

  async getLearningPath(maxSteps = 5): Promise<LearningPath> {
    const res = await api.get("/adaptive-learning/learning-path", { params: { maxSteps } });
    return res.data.data;
  }
}

export default new AdaptiveLearningService();
