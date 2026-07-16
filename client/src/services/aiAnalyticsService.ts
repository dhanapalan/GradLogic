import api from "../lib/api";

// =============================================================================
// AI Analytics Dashboard (Phase 11) — client wrapper.
// =============================================================================

export interface CategoryCoverage {
  category: string;
  totalQuestions: number;
  easy: number;
  medium: number;
  hard: number;
}

export interface WeakSubject {
  category: string;
  attempts: number;
  accuracy: number;
}

export interface DuplicatePair {
  a: { id: string; question_text: string };
  b: { id: string; question_text: string };
  similarity: number;
}

export interface QualityFlag {
  id: string;
  question_text: string;
  category: string;
  reasons: string[];
}

export interface StudentSuccessSummary {
  examsTaken: number;
  averageExamScore: number | null;
  studentsWithScores: number;
}

export interface LearningTimeSummary {
  totalPracticeMinutes: number;
  totalSessions: number;
  averageSessionMinutes: number;
}

export interface SkillCoverageEntry {
  category: string;
  questionCount: number;
  lessonCount: number;
}

export interface UsageBreakdown {
  feature: string;
  count: number;
}

export interface Recommendation {
  severity: "high" | "medium" | "low";
  message: string;
}

export interface AiAnalyticsDashboard {
  knowledgeCoverage: CategoryCoverage[];
  weakSubjects: WeakSubject[];
  duplicateQuestions: { pairs: DuplicatePair[]; scannedCount: number; totalEmbedded: number };
  questionQuality: QualityFlag[];
  studentSuccess: StudentSuccessSummary;
  learningTime: LearningTimeSummary;
  skillCoverage: SkillCoverageEntry[];
  aiUsage: { total: number; byFeature: UsageBreakdown[]; voiceEvents: number };
  recommendations: Recommendation[];
}

class AiAnalyticsService {
  async getDashboard(): Promise<AiAnalyticsDashboard> {
    const res = await api.get("/ai-analytics/dashboard");
    return res.data.data;
  }
}

export default new AiAnalyticsService();
