import api from "../lib/api";
import type { CampaignIntegritySettings } from "../hooks/useCampaignIntegrity";

export interface IntegrityDashboard {
  campaign: {
    id: string;
    name: string;
    campaign_code: string;
    proctoring_enabled: boolean;
  };
  settings: CampaignIntegritySettings & { campaign_id: string; campaign_name: string };
  summary: {
    in_progress: number;
    flagged: number;
    critical: number;
    open_incidents: number;
    total_events: number;
    avg_integrity_score: number;
  };
  event_breakdown: Array<{ event_type: string; count: number }>;
  attempts: Array<{
    attempt_id: string;
    user_id: string;
    student_name: string;
    student_email: string;
    attempt_number: number;
    attempt_status: string;
    integrity_score: number;
    integrity_violations: number;
    integrity_status: string;
    started_at: string | null;
    submitted_at: string | null;
    incident_id: string | null;
    incident_status: string | null;
    risk_level: string | null;
  }>;
}

export interface IntegrityTimeline {
  attempt: {
    id: string;
    user_id: string;
    student_name: string;
    student_email: string;
    attempt_number: number;
    status: string;
    integrity_score: number;
    integrity_violations: number;
    integrity_status: string;
  };
  incident: {
    id: string;
    risk_level: string;
    status: string;
    notes: string | null;
    reviewed_at: string | null;
  } | null;
  events: Array<{
    id: string;
    event_type: string;
    risk_delta: number;
    metadata: unknown;
    created_at: string;
  }>;
}

const campusCampaignIntegrityService = {
  async getDashboard(campaignId: string): Promise<IntegrityDashboard> {
    const { data } = await api.get(`/campus/campaigns/${campaignId}/integrity`);
    return data.data;
  },

  async getTimeline(campaignId: string, attemptId: string): Promise<IntegrityTimeline> {
    const { data } = await api.get(
      `/campus/campaigns/${campaignId}/integrity/attempts/${attemptId}`
    );
    return data.data;
  },

  async reviewIncident(
    campaignId: string,
    incidentId: string,
    payload: { status: "open" | "reviewed" | "dismissed"; notes?: string }
  ) {
    const { data } = await api.patch(
      `/campus/campaigns/${campaignId}/integrity/incidents/${incidentId}`,
      payload
    );
    return data.data as IntegrityDashboard;
  },

  async updateSettings(campaignId: string, settings: Partial<CampaignIntegritySettings>) {
    const { data } = await api.put(
      `/campus/campaigns/${campaignId}/integrity/settings`,
      settings
    );
    return data.data as CampaignIntegritySettings;
  },
};

export default campusCampaignIntegrityService;
