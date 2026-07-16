import api from "../lib/api";

export type CampaignStatus = "draft" | "published" | "closed" | "archived";

export interface CampaignDashboard {
  assigned: number;
  started: number;
  completed: number;
  pending: number;
  expired: number;
}

export interface CampusCampaign {
  id: string;
  college_id: string;
  campaign_code: string;
  name: string;
  assessment_id: string;
  assessment_code?: string;
  assessment_name?: string;
  assessment_status?: string;
  instructions: string | null;
  start_at: string;
  end_at: string;
  max_attempts: number;
  duration_minutes: number | null;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  show_result_immediately: boolean;
  negative_marking: boolean;
  target_department: string | null;
  target_batch: string | null;
  target_semester: string | null;
  target_section: string | null;
  notify_students: boolean;
  reminder_enabled: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  status: CampaignStatus;
  created_by: string | null;
  updated_by: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  student_ids?: string[];
  dashboard?: CampaignDashboard;
  proctoring_enabled?: boolean;
  require_fullscreen?: boolean;
  detect_tab_switch?: boolean;
  detect_window_blur?: boolean;
  detect_copy_paste?: boolean;
  detect_multi_monitor?: boolean;
  require_camera?: boolean;
  require_microphone?: boolean;
  tab_switch_limit?: number;
  integrity_auto_flag?: boolean;
}

export interface CampaignPayload {
  name: string;
  assessment_id: string;
  instructions?: string | null;
  start_at: string;
  end_at: string;
  max_attempts?: number;
  duration_minutes?: number | null;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  allow_resume?: boolean;
  show_result_immediately?: boolean;
  negative_marking?: boolean;
  target_department?: string | null;
  target_batch?: string | null;
  target_semester?: string | null;
  target_section?: string | null;
  student_ids?: string[];
  notify_students?: boolean;
  reminder_enabled?: boolean;
  notify_email?: boolean;
  notify_in_app?: boolean;
  status?: string;
  proctoring_enabled?: boolean;
  require_fullscreen?: boolean;
  detect_tab_switch?: boolean;
  detect_window_blur?: boolean;
  detect_copy_paste?: boolean;
  detect_multi_monitor?: boolean;
  require_camera?: boolean;
  require_microphone?: boolean;
  tab_switch_limit?: number;
  integrity_auto_flag?: boolean;
}

export interface CampaignListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface CampaignMeta {
  statuses: Array<{ value: string; label: string }>;
}

const campusCampaignsService = {
  async meta(): Promise<CampaignMeta> {
    const { data } = await api.get("/campus/campaigns/meta");
    return data.data;
  },

  async list(params: CampaignListParams = {}) {
    const { data } = await api.get("/campus/campaigns", { params });
    return data as {
      data: CampusCampaign[];
      pagination: { total: number; page: number; limit: number; pages: number };
    };
  },

  async get(id: string): Promise<CampusCampaign> {
    const { data } = await api.get(`/campus/campaigns/${id}`);
    return data.data;
  },

  async create(payload: CampaignPayload): Promise<CampusCampaign> {
    const { data } = await api.post("/campus/campaigns", payload);
    return data.data;
  },

  async update(id: string, payload: CampaignPayload): Promise<CampusCampaign> {
    const { data } = await api.put(`/campus/campaigns/${id}`, payload);
    return data.data;
  },

  async publish(id: string): Promise<CampusCampaign> {
    const { data } = await api.patch(`/campus/campaigns/${id}/publish`);
    return data.data;
  },

  async close(id: string): Promise<CampusCampaign> {
    const { data } = await api.patch(`/campus/campaigns/${id}/close`);
    return data.data;
  },

  async archive(id: string): Promise<CampusCampaign> {
    const { data } = await api.patch(`/campus/campaigns/${id}/archive`);
    return data.data;
  },

  async softDelete(id: string) {
    const { data } = await api.delete(`/campus/campaigns/${id}`);
    return data;
  },

  async previewAudience(payload: CampaignPayload): Promise<{ count: number; sample_ids: string[] }> {
    const { data } = await api.post("/campus/campaigns/preview-audience", payload);
    return data.data;
  },
};

export default campusCampaignsService;
