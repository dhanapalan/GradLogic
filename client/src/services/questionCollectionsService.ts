import api from "../lib/api";
import { Question } from "./questionBankService";
import {
  PHASE1_PLACEMENT_DOMAINS,
  phase1DomainByBankCategory,
} from "../lib/phase1PlacementDomains";

/** @deprecated Prefer PHASE1_PLACEMENT_DOMAINS — kept for existing imports. */
export const PHASE1_COLLECTION_DOMAINS = PHASE1_PLACEMENT_DOMAINS.map((d) => ({
  value: d.bankCategory,
  label: d.label,
}));

export function phase1CollectionLabel(category: string | null | undefined) {
  return phase1DomainByBankCategory(category)?.label || category || "—";
}

export interface QuestionCollection {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  question_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionCollectionDetail extends QuestionCollection {
  questions: Question[];
}

const questionCollectionsService = {
  async list(params?: { search?: string; category?: string }): Promise<QuestionCollection[]> {
    const res = await api.get("/question-collections", {
      params: {
        search: params?.search || undefined,
        category: params?.category || undefined,
      },
    });
    return res.data?.data || [];
  },

  async get(id: string): Promise<QuestionCollectionDetail> {
    const res = await api.get(`/question-collections/${id}`);
    return res.data?.data;
  },

  async create(input: {
    name: string;
    description?: string;
    category?: string;
  }): Promise<QuestionCollection> {
    const res = await api.post("/question-collections", input);
    return res.data?.data;
  },

  async update(
    id: string,
    input: Partial<{ name: string; description: string; category: string }>
  ): Promise<QuestionCollection> {
    const res = await api.put(`/question-collections/${id}`, input);
    return res.data?.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/question-collections/${id}`);
  },

  async seedPhase1(): Promise<{ created_count: number }> {
    const res = await api.post("/question-collections/seed-phase1");
    return res.data?.data || { created_count: 0 };
  },

  async fillFromBank(id: string, limit = 40): Promise<{ added: number; requested: number }> {
    const res = await api.post(`/question-collections/${id}/fill-from-bank`, { limit });
    return res.data?.data;
  },

  async addQuestions(
    id: string,
    questionIds: string[]
  ): Promise<{ added: number; skipped?: number; missing?: number }> {
    const res = await api.post(`/question-collections/${id}/questions`, {
      question_ids: questionIds,
    });
    return res.data?.data;
  },

  async removeQuestion(id: string, questionId: string): Promise<void> {
    await api.delete(`/question-collections/${id}/questions/${questionId}`);
  },
};

export default questionCollectionsService;
