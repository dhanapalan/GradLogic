/**
 * Student Portal Module 07 — Results & Performance Analytics client.
 * Consume-only; no evaluation or scoring on the client.
 */
import api from "../lib/api";

export type HistoryFilters = {
  search?: string;
  skill?: string;
  assessment_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
};

export type HistoryRow = {
  attempt_id: string;
  evaluation_id: string;
  campaign_id: string;
  assessment_id: string;
  assessment_name: string;
  campaign_name: string;
  subject: string | null;
  assessment_type: string | null;
  attempt: number;
  completed_at: string | null;
  score: number;
  total_marks: number;
  percentage: number;
  grade: string | null;
  passed: boolean | null;
  status: string;
  evaluation_status: string;
  duration_seconds: number | null;
  report_href: string;
  action: string;
};

export type AttemptSummary = {
  attempt_id: string;
  evaluation_id: string;
  campaign_id: string;
  assessment_id: string;
  assessment_name: string;
  campaign_name: string;
  assessment_type: string | null;
  overall_score: number;
  total_marks: number;
  percentage: number;
  grade: string | null;
  pass_fail: string;
  passed: boolean | null;
  rank: number | null;
  percentile: number | null;
  placement_readiness_impact: {
    current: number;
    previous: number | null;
    trend: number | null;
    level: string;
  } | null;
  attempt_number: number;
  assessment_duration_seconds: number | null;
  submission_time: string | null;
  evaluation_status: string;
  published_at: string | null;
  performance_category: string;
  strongest_skill: { name: string; percentage: number } | null;
  weakest_skill: { name: string; percentage: number } | null;
  continue_learning: {
    learning_hub: string;
    practice_hub: string;
    practice_weak: string;
    ai_coach: string;
    retry_assessment: string;
    my_assessments: string;
  };
};

export type ReviewQuestion = {
  question_id: string;
  question: string;
  explanation: string | null;
  student_answer: string[];
  correct_answer: string[];
  marks_awarded: number;
  marks_possible: number;
  is_correct: boolean | null;
  skill: string;
  topic: string;
  sub_topic: string | null;
  difficulty: string;
  bloom_level: string | null;
  learning_outcome: string | null;
  reference_lesson: { title: string; href: string };
  actions: {
    explain_ai_href: string;
    practice_similar_href: string;
    bookmarkable: boolean;
  };
};

export type SkillRow = {
  skill_name: string;
  score: number;
  percentage: number;
  performance: string;
  progress: number;
  questions: number | null;
  correct: number | null;
  wrong: number | null;
  accuracy: number | null;
  recommended_improvement: string;
  source: string;
};

async function getData<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get(path, { params });
  return data.data as T;
}

const studentResultsAnalyticsService = {
  getHistory: async (filters: HistoryFilters = {}) => {
    const { data } = await api.get("/results/history", { params: filters });
    return {
      data: (data.data ?? []) as HistoryRow[],
      pagination: data.pagination as {
        total: number;
        page: number;
        limit: number;
        pages: number;
      },
    };
  },

  getAttempt: (attemptId: string) => getData<AttemptSummary>(`/results/${attemptId}`),

  getAttemptQuestions: (attemptId: string) =>
    getData<{ attempt_id: string; total: number; questions: ReviewQuestion[] }>(
      `/results/${attemptId}/questions`
    ),

  getPerformance: () => getData<Record<string, unknown>>("/analytics/performance"),

  getSkills: (attemptId?: string) =>
    getData<{
      skills: SkillRow[];
      strongest_skill: { name: string; percentage: number } | null;
      weakest_skill: { name: string; percentage: number } | null;
      top_skills: Array<{ name: string; proficiency: number }>;
      weak_skills: Array<{ name: string; proficiency: number }>;
    }>("/analytics/skills", attemptId ? { attempt_id: attemptId } : undefined),

  getTopics: (attemptId?: string) =>
    getData<{
      available: boolean;
      skills: Array<{
        skill: string;
        topics: Array<{
          topic: string;
          questions: number;
          correct: number;
          wrong: number;
          accuracy: number | null;
          recommendation: string;
        }>;
      }>;
      flat: Array<{
        topic: string;
        questions: number;
        correct: number;
        wrong: number;
        accuracy: number | null;
        recommendation: string;
      }>;
    }>("/analytics/topics", attemptId ? { attempt_id: attemptId } : undefined),

  getSubtopics: (attemptId?: string) =>
    getData<{ available: boolean; message?: string; items: unknown[] }>(
      "/analytics/subtopics",
      attemptId ? { attempt_id: attemptId } : undefined
    ),

  getDifficulty: (attemptId?: string) =>
    getData<{
      available: boolean;
      headline: string;
      weakest_difficulty: string | null;
      levels: Array<{
        difficulty: string;
        questions: number;
        correct: number;
        wrong: number;
        accuracy: number | null;
        performance: string;
        insight: string;
      }>;
    }>("/analytics/difficulty", attemptId ? { attempt_id: attemptId } : undefined),

  getBloom: (attemptId?: string) =>
    getData<{
      available: boolean;
      message?: string;
      levels: Array<{
        bloom_level: string;
        percentage: number | null;
        questions: number;
        performance: string;
      }>;
    }>("/analytics/bloom", attemptId ? { attempt_id: attemptId } : undefined),

  getLearningOutcomes: (attemptId?: string) =>
    getData<{
      available: boolean;
      items: Array<{
        learning_outcome: string;
        description: string;
        mapped_skill: string;
        mapped_topic: string;
        status: string;
        accuracy: number | null;
        recommendation: string;
      }>;
      summary: {
        achieved: number;
        partially_achieved: number;
        needs_improvement: number;
        not_attempted: number;
      };
    }>("/analytics/learning-outcomes", attemptId ? { attempt_id: attemptId } : undefined),

  getTrends: () =>
    getData<{
      score_trend: Array<{
        date: string | null;
        assessment: string;
        percentage: number;
        attempt_id: string;
      }>;
      skill_snapshot: Array<{ skill: string; percentage: number }>;
      readiness_trend: {
        current: number;
        previous: number | null;
        delta: number | null;
        stages: Record<string, number>;
      } | null;
      improvement_pct: number | null;
      time_spent_seconds: number;
      assessments_completed: number;
    }>("/analytics/trends"),

  getReadiness: () =>
    getData<{
      score: number;
      level: string;
      current_readiness: number;
      previous_readiness: number | null;
      improvement: number | null;
      contributing_skills: SkillRow[];
      weak_skills: SkillRow[];
      readiness_timeline: Array<{ date: string | null; label: string; score: number }>;
      stages: Record<string, number>;
    }>("/analytics/readiness"),

  getRecommendations: () =>
    getData<{
      items: Array<{
        id: string;
        type: string;
        title: string;
        description: string;
        href: string;
        priority: "High" | "Medium" | "Low";
      }>;
      panels: {
        recommended_voice_lessons: Array<{
          id: string;
          title: string;
          description: string;
          href: string;
          priority: string;
        }>;
        recommended_practice_sets: Array<{
          id: string;
          title: string;
          description: string;
          href: string;
          priority: string;
        }>;
        recommended_question_library: Array<{
          id: string;
          title: string;
          description: string;
          href: string;
          priority: string;
        }>;
        recommended_next_assessment: Array<{
          id: string;
          title: string;
          description: string;
          href: string;
          priority: string;
        }>;
        recommended_learning_path: Array<{
          id: string;
          title: string;
          description: string;
          href: string;
          priority: string;
        }>;
        study_plan: {
          readiness: number | null;
          focus_skill: string | null;
          steps: Array<{ label: string; href: string; priority: string }>;
        };
      };
    }>("/analytics/recommendations"),

  getStrengths: (attemptId?: string) =>
    getData<{
      strengths: {
        top_skills: SkillRow[];
        top_topics: Array<{ topic: string; accuracy: number | null }>;
        strong_difficulty_levels: Array<{ difficulty: string; accuracy: number | null }>;
        learning_outcomes_achieved: Array<{ learning_outcome: string; status: string }>;
      };
      improvement_areas: {
        weak_skills: SkillRow[];
        weak_topics: Array<{ topic: string; accuracy: number | null }>;
        weak_sub_topics: unknown[];
        weak_difficulty_levels: Array<{ difficulty: string; accuracy: number | null }>;
        learning_outcomes_not_achieved: Array<{ learning_outcome: string; status: string }>;
      };
    }>("/analytics/strengths", attemptId ? { attempt_id: attemptId } : undefined),

  bookmarkQuestion: async (questionId: string, meta?: Record<string, unknown>) => {
    const { data } = await api.post(`/questions/${questionId}/bookmark`, { meta });
    return data.data;
  },
};

export default studentResultsAnalyticsService;
