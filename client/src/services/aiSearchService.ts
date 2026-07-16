import api from "../lib/api";

// =============================================================================
// AI Semantic Search (Phase 10) — client wrapper.
// =============================================================================

export interface QuestionSearchResult {
  id: string;
  question_text: string;
  category: string;
  difficulty_level: string;
  type: string;
  tags: string[];
  hint: string | null;
  similarity: number | null;
  voiceLessonAvailable: true;
}

export interface LearningModuleResult {
  id: string;
  title: string;
  description: string | null;
  moduleType: string;
  durationMinutes: number | null;
}

export interface RelatedTopic {
  label: string;
  kind: "category" | "tag";
  count: number;
}

export interface AiSearchResult {
  questions: QuestionSearchResult[];
  learningNotes: LearningModuleResult[];
  videos: LearningModuleResult[];
  relatedTopics: RelatedTopic[];
  embeddingsUsed: boolean;
}

class AiSearchService {
  async search(q: string, limit = 10): Promise<AiSearchResult> {
    const res = await api.get("/ai-search", { params: { q, limit } });
    return res.data.data;
  }
}

export default new AiSearchService();
