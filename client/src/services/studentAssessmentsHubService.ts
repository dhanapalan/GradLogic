/**
 * Student Portal Module 05 — My Assessments facade client.
 */
import api from "../lib/api";

export type AssessmentHubRow = {
  campaign_id: string;
  campaign_code?: string;
  campaign_name: string;
  assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  subject?: string | null;
  total_questions: number;
  duration_minutes: number | null;
  passing_marks?: number;
  max_attempts: number;
  attempts_used: number;
  attempts_remaining?: number;
  available_from: string;
  available_until: string;
  instructions?: string | null;
  status: string;
  display_status?: string;
  started_at?: string | null;
  completed_at?: string | null;
  can_start: boolean;
  can_resume: boolean;
  action?: string;
  start_blocked_reason?: string | null;
  launch_href?: string;
  resume_href?: string;
  result_href?: string;
  details_href?: string;
  score?: number | null;
  percentage?: number | null;
  passed?: boolean | null;
  rank?: number | null;
  result_published?: boolean;
  reason?: string;
  progress_percent?: number;
  questions_attempted?: number;
  time_remaining_seconds?: number;
  auto_save_status?: string;
  last_activity?: string;
};

export type AssessmentSummary = {
  total_assigned: number;
  upcoming: number;
  active: number;
  live: number;
  in_progress: number;
  completed: number;
  missed: number;
  practice: number;
  average_score: number | null;
  pending_results: number;
};

export type HubListResponse = {
  data: AssessmentHubRow[];
  pagination: { total: number; page: number; limit: number; pages: number };
};

export type HubFilters = {
  search?: string;
  assessment_type?: string;
  sort?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
  paginated?: string;
};

async function list(path: string, filters: HubFilters = {}): Promise<HubListResponse> {
  const { data } = await api.get(path, { params: filters });
  return {
    data: data.data ?? [],
    pagination: data.pagination ?? { total: 0, page: 1, limit: 20, pages: 1 },
  };
}

const studentAssessmentsHubService = {
  getDashboard: async () => {
    const { data } = await api.get("/assessments/dashboard");
    return data.data as {
      summary: AssessmentSummary;
      upcoming_preview: AssessmentHubRow[];
      live_preview: AssessmentHubRow[];
      in_progress_preview: AssessmentHubRow[];
    };
  },
  getAssigned: (f?: HubFilters) => list("/assessments/assigned", f),
  getUpcoming: (f?: HubFilters) =>
    list("/assessments/upcoming", { ...f, paginated: "1", page: f?.page || 1 }),
  getLive: (f?: HubFilters) => list("/assessments/live", f),
  getInProgress: (f?: HubFilters) => list("/assessments/in-progress", f),
  getCompleted: (f?: HubFilters) => list("/assessments/completed", f),
  getMissed: (f?: HubFilters) => list("/assessments/missed", f),
  getPractice: (f?: HubFilters) => list("/assessments/practice", f),
  getAssessment: async (campaignId: string) => {
    const { data } = await api.get(`/assessments/${campaignId}`);
    return data.data;
  },
  getAttempts: async (campaignId: string) => {
    const { data } = await api.get(`/assessments/${campaignId}/attempts`);
    return data.data as Array<{
      attempt_id: string;
      attempt_number: number;
      start_time: string | null;
      end_time: string | null;
      duration_seconds: number | null;
      status: string;
      submission_type: string | null;
      score: number | null;
      percentage: number | null;
    }>;
  },
  launch: async (campaignId: string) => {
    const { data } = await api.post(`/assessments/${campaignId}/launch`);
    return data.data as { workspace_href: string; attempt_id: string; message?: string };
  },
  resume: async (campaignId: string) => {
    const { data } = await api.post(`/assessments/${campaignId}/resume`);
    return data.data as { workspace_href: string; attempt_id: string; message?: string };
  },
  getCalendar: async (days = 60) => {
    const { data } = await api.get("/calendar/assessments", { params: { days } });
    return data.data as Array<{
      id: string;
      title: string;
      type: string;
      starts_at: string;
      ends_at?: string | null;
      href: string;
    }>;
  },
  getNotifications: async (limit = 20) => {
    const { data } = await api.get("/notifications/assessments", { params: { limit } });
    return data.data as Array<{
      id: string;
      title: string;
      message: string;
      type: string;
      is_read: boolean;
      created_at: string;
      href: string;
    }>;
  },
};

export default studentAssessmentsHubService;
