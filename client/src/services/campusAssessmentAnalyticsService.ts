import api from "../lib/api";

export interface AnalyticsFilters {
  search?: string;
  academic_year?: string;
  department?: string;
  assessment_id?: string;
  campaign_id?: string;
  result?: "pass" | "fail" | "";
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface AnalyticsMeta {
  assessments: Array<{ id: string; name: string }>;
  campaigns: Array<{ id: string; name: string; status: string }>;
  departments: string[];
  academic_years: string[];
  results: Array<{ value: string; label: string }>;
  forced_department: string | null;
  can_export: boolean;
}

export interface AnalyticsDashboard {
  filters_applied: Record<string, string | null | undefined>;
  summary: {
    total_assessments: number;
    published_assessments: number;
    active_campaigns: number;
    total_attempts: number;
    completed_attempts: number;
    pending_attempts: number;
    average_score: number;
    overall_pass_percentage: number;
  };
  charts: {
    completion: Array<{ label: string; value: number }>;
    result_distribution: Array<{ label: string; value: number }>;
    department_average_score: Array<{ label: string; value: number }>;
    average_score_trend: Array<{ label: string; value: number }>;
  };
}

export interface AssessmentPerformanceRow {
  assessment_name: string;
  campaign: string;
  campaign_id: string;
  assessment_id: string;
  total_assigned: number;
  total_attempted: number;
  completion_pct: number;
  average_score: number;
  pass_pct: number;
  status: string;
}

export interface StudentPerformanceRow {
  student_name: string;
  department: string;
  assessment: string;
  score: number | null;
  percentage: number | null;
  result: string;
  attempt_number: number;
  submitted_on: string | null;
}

export interface DepartmentPerformanceRow {
  department: string;
  students_assigned: number;
  students_attempted: number;
  average_score: number;
  pass_pct: number;
  completion_pct: number;
}

export type AnalyticsReportType =
  | "summary"
  | "assessment"
  | "student"
  | "department"
  | "campaign";

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cleanParams(filters: AnalyticsFilters) {
  const params: Record<string, string | number> = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params[k] = v as string | number;
  });
  return params;
}

const campusAssessmentAnalyticsService = {
  async getMeta(): Promise<AnalyticsMeta> {
    const { data } = await api.get("/campus/assessment-analytics/meta");
    return data.data;
  },

  async getDashboard(filters: AnalyticsFilters = {}): Promise<AnalyticsDashboard> {
    const { data } = await api.get("/campus/assessment-analytics/summary", {
      params: cleanParams(filters),
    });
    return data.data;
  },

  async getAssessments(filters: AnalyticsFilters = {}) {
    const { data } = await api.get("/campus/assessment-analytics/assessments", {
      params: cleanParams(filters),
    });
    return data as {
      success: boolean;
      data: AssessmentPerformanceRow[];
      pagination: { total: number; page: number; limit: number; pages: number };
    };
  },

  async getStudents(filters: AnalyticsFilters = {}) {
    const { data } = await api.get("/campus/assessment-analytics/students", {
      params: cleanParams(filters),
    });
    return data as {
      success: boolean;
      data: StudentPerformanceRow[];
      pagination: { total: number; page: number; limit: number; pages: number };
    };
  },

  async getDepartments(filters: AnalyticsFilters = {}) {
    const { data } = await api.get("/campus/assessment-analytics/departments", {
      params: cleanParams(filters),
    });
    return data as { success: boolean; data: DepartmentPerformanceRow[] };
  },

  async export(
    format: "xlsx" | "pdf",
    report: AnalyticsReportType,
    filters: AnalyticsFilters = {}
  ) {
    const res = await api.get("/campus/assessment-analytics/export", {
      params: { ...cleanParams(filters), format, report },
      responseType: "blob",
    });
    const disposition = String(res.headers["content-disposition"] || "");
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    const filename =
      match?.[1] || `assessment-${report}-analytics.${format === "pdf" ? "pdf" : "xlsx"}`;
    triggerDownload(res.data, filename);
  },
};

export default campusAssessmentAnalyticsService;
