import api from "../lib/api";

export type AssessmentType = "practice_test" | "mock_test" | "placement_test";
export type AssessmentCategory =
  | "aptitude"
  | "logical_reasoning"
  | "english"
  | "technical"
  | "domain";
export type AssessmentStatus = "draft" | "published" | "archived";

export interface AssessmentQuestion {
  id?: string;
  assessment_id?: string;
  question_id: string;
  display_order: number;
  marks: number;
  question_code?: string;
  title?: string;
  category?: string;
  difficulty?: string;
  question_type?: string;
  question_status?: string;
}

export interface CampusAssessment {
  id: string;
  college_id: string;
  assessment_code: string;
  name: string;
  description: string | null;
  assessment_type: AssessmentType;
  category: AssessmentCategory;
  duration_minutes: number;
  passing_marks: number;
  total_marks: number;
  total_questions: number;
  instructions: string | null;
  status: AssessmentStatus;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  questions?: AssessmentQuestion[];
}

export interface AssessmentPayload {
  name: string;
  description?: string | null;
  assessment_type: string;
  category: string;
  duration_minutes: number;
  passing_marks: number;
  instructions?: string | null;
  status?: string;
  questions: Array<{ question_id: string; display_order?: number; marks?: number }>;
  force?: boolean;
}

export interface AssessmentListParams {
  page?: number;
  limit?: number;
  search?: string;
  assessment_type?: string;
  category?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface AssessmentMeta {
  types: Array<{ value: string; label: string }>;
  categories: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
}

const campusAssessmentsService = {
  async meta(): Promise<AssessmentMeta> {
    const { data } = await api.get("/campus/assessments/meta");
    return data.data;
  },

  async list(params: AssessmentListParams = {}) {
    const { data } = await api.get("/campus/assessments", { params });
    return data as {
      data: CampusAssessment[];
      pagination: { total: number; page: number; limit: number; pages: number };
    };
  },

  async get(id: string): Promise<CampusAssessment> {
    const { data } = await api.get(`/campus/assessments/${id}`);
    return data.data;
  },

  async create(payload: AssessmentPayload): Promise<CampusAssessment> {
    const { data } = await api.post("/campus/assessments", payload);
    return data.data;
  },

  async update(id: string, payload: AssessmentPayload): Promise<CampusAssessment> {
    const { data } = await api.put(`/campus/assessments/${id}`, payload);
    return data.data;
  },

  async duplicate(id: string): Promise<CampusAssessment> {
    const { data } = await api.post(`/campus/assessments/${id}/duplicate`);
    return data.data;
  },

  async publish(id: string): Promise<CampusAssessment> {
    const { data } = await api.patch(`/campus/assessments/${id}/publish`);
    return data.data;
  },

  async archive(id: string): Promise<CampusAssessment> {
    const { data } = await api.patch(`/campus/assessments/${id}/archive`);
    return data.data;
  },

  async softDelete(id: string) {
    const { data } = await api.delete(`/campus/assessments/${id}`);
    return data;
  },
};

export default campusAssessmentsService;
