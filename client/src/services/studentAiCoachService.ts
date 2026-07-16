/**
 * Student Portal Module 08 — AI Learning Coach client (consume-only).
 */
import api from "../lib/api";
import { postSSE } from "../lib/sse";

export type ChatTurn = { role: "student" | "coach"; text: string };

export type LiCard = {
  kind: string;
  title: string;
  description: string | null;
  href: string;
  priority: "High" | "Medium" | "Low";
  learning_intelligence: {
    skill: string | null;
    topic: string | null;
    sub_topic: string | null;
    difficulty: string | null;
    bloom_level: string | null;
    learning_outcome: string | null;
    estimated_learning_time_minutes: number | null;
  };
  meta?: Record<string, unknown>;
};

async function getData<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const { data } = await api.get(path, { params });
  return data.data as T;
}

const studentAiCoachService = {
  getDashboard: () => getData<Record<string, unknown>>("/ai/dashboard"),
  getRecommendations: () => getData<Record<string, unknown>>("/ai/recommendations"),
  getStudyPlan: () => getData<Record<string, unknown>>("/ai/study-plan"),
  getLearningPath: () => getData<Record<string, unknown>>("/ai/learning-path"),
  getPracticeRecommendations: () =>
    getData<{ recommendations: LiCard[]; path_preview: unknown[] }>("/ai/practice-recommendations"),
  getWeakAreas: () => getData<Record<string, unknown>>("/ai/weak-areas"),
  getProgress: () => getData<Record<string, unknown>>("/ai/progress"),
  getExplainResultContext: (attemptId: string) =>
    getData<Record<string, unknown>>("/ai/explain-result", { attempt_id: attemptId }),

  generateStudyPlan: async (maxSteps = 5) => {
    const { data } = await api.post("/ai/generate-study-plan", { max_steps: maxSteps });
    return data.data;
  },

  streamChat: (
    params: { message: string; history: ChatTurn[] },
    handlers: {
      onDelta: (chunk: string) => void;
      onDone: (result: { text: string; requiresReview?: boolean }) => void;
      onError: (message: string) => void;
    },
    signal?: AbortSignal
  ) =>
    postSSE("/ai/chat", params, (event) => {
      if (event.type === "delta") handlers.onDelta(event.text);
      else if (event.type === "done") handlers.onDone(event);
      else if (event.type === "error") handlers.onError(event.message);
    }, signal),

  streamExplainResult: (
    params: { attempt_id: string; message?: string; history?: ChatTurn[] },
    handlers: {
      onDelta: (chunk: string) => void;
      onDone: (result: { text: string; requiresReview?: boolean; context?: unknown }) => void;
      onError: (message: string) => void;
    },
    signal?: AbortSignal
  ) =>
    postSSE("/ai/explain-result", params, (event) => {
      if (event.type === "delta") handlers.onDelta(event.text);
      else if (event.type === "done") handlers.onDone(event);
      else if (event.type === "error") handlers.onError(event.message);
    }, signal),

  streamExplainQuestion: (
    params: Record<string, unknown>,
    handlers: {
      onDelta: (chunk: string) => void;
      onDone: (result: { text: string; requiresReview?: boolean }) => void;
      onError: (message: string) => void;
    },
    signal?: AbortSignal
  ) =>
    postSSE("/ai/explain-question", params, (event) => {
      if (event.type === "delta") handlers.onDelta(event.text);
      else if (event.type === "done") handlers.onDone(event);
      else if (event.type === "error") handlers.onError(event.message);
    }, signal),
};

export default studentAiCoachService;
