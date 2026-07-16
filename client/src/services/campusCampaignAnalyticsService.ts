import api from "../lib/api";

export interface CampaignAnalytics {
  campaign: {
    id: string;
    name: string;
    campaign_code: string;
    assessment_name: string;
    passing_marks: number;
    total_marks: number;
    duration_minutes: number | null;
    max_attempts: number;
    window_start: string;
    window_end: string;
  };
  assessment_summary: {
    assigned: number;
    started: number;
    submitted: number;
    evaluated: number;
    published: number;
    needs_manual_review: number;
    avg_score: number;
    avg_percentage: number;
    pass_percentage: number;
    attempt_rate: number;
    passed: number;
    failed: number;
  };
  attempt_statistics: {
    assigned: number;
    started: number;
    in_progress: number;
    submitted: number;
    expired: number;
    completion_rate: number;
  };
  time_analysis: {
    avg_minutes: number;
    median_minutes: number;
    min_minutes: number;
    max_minutes: number;
    configured_duration_minutes: number | null;
    buckets: Array<{ bucket: string; count: number }>;
  };
  student_performance: Array<{
    user_id: string;
    name: string;
    email: string;
    department: string;
    attempt_number: number;
    attempt_status: string;
    obtained_marks: number | null;
    total_marks: number | null;
    percentage: number | null;
    passed: boolean | null;
    evaluation_status: string | null;
    duration_minutes: number | null;
    submitted_at: string | null;
  }>;
  department_performance: Array<{
    department: string;
    students: number;
    avg_percentage: number;
    passed: number;
    failed: number;
    pass_percentage: number;
  }>;
  question_analysis: Array<{
    question_id: string;
    title: string;
    question_type: string;
    difficulty: string;
    marks_possible: number;
    attempts: number;
    correct: number;
    incorrect: number;
    pending: number;
    avg_marks: number;
    accuracy_pct: number;
  }>;
  difficulty_analysis: Array<{
    difficulty: string;
    questions: number;
    attempts: number;
    accuracy_pct: number;
    avg_marks: number;
  }>;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const campusCampaignAnalyticsService = {
  async get(campaignId: string): Promise<CampaignAnalytics> {
    const { data } = await api.get(`/campus/campaigns/${campaignId}/analytics`);
    return data.data;
  },

  async export(campaignId: string, format: "xlsx" | "pdf") {
    const res = await api.get(`/campus/campaigns/${campaignId}/analytics/export`, {
      params: { format },
      responseType: "blob",
    });
    const ext = format === "pdf" ? "pdf" : "xlsx";
    const disposition = String(res.headers["content-disposition"] || "");
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    const filename = match?.[1] || `campaign-analytics.${ext}`;
    triggerDownload(res.data, filename);
  },
};

export default campusCampaignAnalyticsService;
