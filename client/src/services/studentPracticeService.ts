import api from "../lib/api";
import {
  PHASE1_PLACEMENT_DOMAINS,
  phase1DomainByBankCategory,
} from "../lib/phase1PlacementDomains";

export interface DailyTarget {
  target: number;
  completed_today: number;
  remaining: number;
  met: boolean;
  current_streak: number;
  longest_streak: number;
  last_practice_date: string | null;
}

export interface PracticeTopic {
  topic: string;
  total_questions: number;
  easy: number;
  medium: number;
  hard: number;
  label?: string;
}

export interface PracticeBookmark {
  id: string;
  question_id: string;
  created_at: string;
  category: string;
  difficulty_level: string;
  question_text: string;
  type: string;
}

export function practiceTopicLabel(topic: string | null | undefined): string {
  return phase1DomainByBankCategory(topic)?.label || topic || "—";
}

const studentPracticeService = {
  /** The student's daily practice goal (set by their college) + today's progress. */
  async getDailyTarget(): Promise<DailyTarget> {
    const { data } = await api.get("/practice/daily-target");
    return data.data;
  },

  async getTopics(): Promise<PracticeTopic[]> {
    const { data } = await api.get("/practice/topics");
    return ((data.data || []) as PracticeTopic[]).map((t) => ({
      ...t,
      label: practiceTopicLabel(t.topic),
    }));
  },

  async startSession(input: {
    session_type?: string;
    topic?: string;
    difficulty?: string;
    question_count?: number;
    retry_incorrect?: boolean;
    question_ids?: string[];
  }) {
    const { data } = await api.post("/practice/sessions", {
      session_type: input.session_type || "quiz",
      topic: input.topic || undefined,
      difficulty: input.difficulty || "mixed",
      question_count: input.question_count || 10,
      retry_incorrect: !!input.retry_incorrect,
      question_ids: input.question_ids,
    });
    return data.data;
  },

  async submitAnswer(
    sessionId: string,
    body: {
      question_id: string;
      student_answer: string;
      time_spent_seconds?: number;
      hint_used?: boolean;
    }
  ) {
    const { data } = await api.post(`/practice/sessions/${sessionId}/answer`, body);
    return data.data;
  },

  async completeSession(sessionId: string) {
    const { data } = await api.put(`/practice/sessions/${sessionId}/complete`);
    return data.data;
  },

  async listBookmarks(): Promise<PracticeBookmark[]> {
    const { data } = await api.get("/practice/bookmarks");
    return data.data || [];
  },

  async addBookmark(questionId: string) {
    const { data } = await api.post("/practice/bookmarks", { question_id: questionId });
    return data.data;
  },

  async removeBookmark(questionId: string) {
    await api.delete(`/practice/bookmarks/${questionId}`);
  },

  async listIncorrect(topic?: string) {
    const { data } = await api.get("/practice/incorrect", {
      params: topic ? { topic } : undefined,
    });
    return data.data || [];
  },

  phase1Domains: PHASE1_PLACEMENT_DOMAINS,
};

export default studentPracticeService;
