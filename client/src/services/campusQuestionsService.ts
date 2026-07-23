import api from "../lib/api";

export type CollegeCategory =
  | "aptitude"
  | "logical_reasoning"
  | "english"
  | "technical"
  | "domain";

export type CollegeQuestionType =
  | "mcq_single"
  | "mcq_multiple"
  | "true_false"
  | "short_answer";

export type CollegeDifficulty = "easy" | "medium" | "hard";
export type CollegeQuestionStatus = "draft" | "active" | "inactive";

export interface QuestionOption {
  id?: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order?: number;
}

export interface CampusQuestion {
  id: string;
  college_id: string;
  question_code: string;
  title: string;
  description: string | null;
  category: CollegeCategory;
  question_type: CollegeQuestionType;
  difficulty: CollegeDifficulty;
  marks: number;
  correct_answer: string | null;
  status: CollegeQuestionStatus;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string | null;
  updated_by_name?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  options?: QuestionOption[];
}

export interface QuestionListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  question_type?: string;
  difficulty?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
}

export interface QuestionPayload {
  title: string;
  description?: string | null;
  category: string;
  question_type: string;
  difficulty: string;
  marks: number;
  correct_answer?: string | null;
  status?: string;
  options?: QuestionOption[];
  force?: boolean;
}

export interface ImportSummary {
  summary: {
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  failed: Array<{ row: number; error: string }>;
  skipped: Array<{ row: number; reason: string }>;
}

export interface AiGeneratedQuestion {
  question: string;
  options?: string[];
  correct_answer: string;
  category?: string;
  difficulty?: string;
  explanation?: string;
}

export interface AiImportResult {
  summary: { total: number; successful: number; failed: number; skipped: number };
  successful: string[];
  failed: Array<{ index: number; error: string }>;
  skipped: Array<{ index: number; reason: string }>;
}

export interface BulkActionResult {
  summary: { total: number; successful: number; failed: number };
  successful: string[];
  failed: Array<{ id: string; error: string }>;
}

export interface MetaCatalog {
  categories: Array<{ value: string; label: string }>;
  types: Array<{ value: string; label: string }>;
  difficulties: Array<{ value: string; label: string }>;
  statuses: Array<{ value: string; label: string }>;
}

const campusQuestionsService = {
  async meta(): Promise<MetaCatalog> {
    const { data } = await api.get("/campus/questions/meta");
    return data.data;
  },

  async list(params: QuestionListParams = {}) {
    const { data } = await api.get("/campus/questions", { params });
    return data as {
      data: CampusQuestion[];
      pagination: { total: number; page: number; limit: number; pages: number };
    };
  },

  async get(id: string): Promise<CampusQuestion> {
    const { data } = await api.get(`/campus/questions/${id}`);
    return data.data;
  },

  async create(payload: QuestionPayload): Promise<CampusQuestion> {
    const { data } = await api.post("/campus/questions", payload);
    return data.data;
  },

  async update(id: string, payload: QuestionPayload): Promise<CampusQuestion> {
    const { data } = await api.put(`/campus/questions/${id}`, payload);
    return data.data;
  },

  async setStatus(id: string, status: CollegeQuestionStatus): Promise<CampusQuestion> {
    const { data } = await api.patch(`/campus/questions/${id}/status`, { status });
    return data.data;
  },

  async duplicate(id: string): Promise<CampusQuestion> {
    const { data } = await api.post(`/campus/questions/${id}/duplicate`);
    return data.data;
  },

  async softDelete(id: string) {
    const { data } = await api.delete(`/campus/questions/${id}`);
    return data;
  },

  async downloadImportTemplate() {
    const res = await api.get("/campus/questions/import-template", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = "college_question_import_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  },

  async bulkAction(
    ids: string[],
    action: "activate" | "deactivate" | "delete"
  ): Promise<BulkActionResult> {
    const { data } = await api.post("/campus/questions/bulk-action", { ids, action });
    return data.data;
  },

  async aiImport(questions: AiGeneratedQuestion[]): Promise<AiImportResult> {
    const { data } = await api.post("/campus/questions/ai-import", { questions });
    return data.data;
  },

  async importExcel(file: File): Promise<ImportSummary> {
    const fd = new FormData();
    fd.append("file", file);
    const { data } = await api.post("/campus/questions/import", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },
};

export default campusQuestionsService;
