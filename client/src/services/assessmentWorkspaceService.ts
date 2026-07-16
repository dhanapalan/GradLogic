/**
 * Module 06 — Assessment Workspace attempt-scoped API client.
 * Thin wrapper over /api/assessment-workspace/* (facade over campaign attempt engine).
 */
import api from "../lib/api";
import type {
  AttemptSavePayload,
  AttemptSaveResult,
  AttemptTimerSync,
  AttemptWorkspace,
  SubmissionCompletion,
  SubmissionSummary,
} from "./studentAssessmentsService";

export type WorkspaceLaunchResult = {
  attempt_id: string;
  campaign_id: string;
  assessment_id?: string;
  started?: boolean;
  resumed?: boolean;
  message?: string;
  workspace_href: string;
};

const assessmentWorkspaceService = {
  launch: async (campaignId: string): Promise<WorkspaceLaunchResult> => {
    const { data } = await api.post("/assessment-workspace/launch", {
      campaign_id: campaignId,
    });
    return data.data;
  },

  get: async (attemptId: string): Promise<AttemptWorkspace> => {
    const { data } = await api.get(`/assessment-workspace/${attemptId}`);
    return data.data;
  },

  getQuestions: async (attemptId: string) => {
    const { data } = await api.get(`/assessment-workspace/${attemptId}/questions`);
    return data.data as {
      attempt_id: string;
      campaign_id: string;
      questions: AttemptWorkspace["questions"];
      palette: AttemptWorkspace["palette"];
      current_index: number;
    };
  },

  saveResponse: async (
    attemptId: string,
    payload: AttemptSavePayload
  ): Promise<AttemptSaveResult> => {
    const { data } = await api.put(`/assessment-workspace/${attemptId}/response`, payload);
    return data.data;
  },

  autosave: async (
    attemptId: string,
    payload: AttemptSavePayload
  ): Promise<AttemptSaveResult> => {
    const { data } = await api.post(`/assessment-workspace/${attemptId}/autosave`, payload);
    return data.data;
  },

  heartbeat: async (attemptId: string): Promise<AttemptTimerSync & { heartbeat_at?: string }> => {
    const { data } = await api.post(`/assessment-workspace/${attemptId}/heartbeat`);
    return data.data;
  },

  telemetry: async (
    attemptId: string,
    eventType: string,
    metadata?: Record<string, unknown>
  ) => {
    const { data } = await api.post(`/assessment-workspace/${attemptId}/telemetry`, {
      event_type: eventType,
      metadata: metadata || {},
    });
    return data.data;
  },

  resume: async (attemptId: string): Promise<WorkspaceLaunchResult> => {
    const { data } = await api.post(`/assessment-workspace/${attemptId}/resume`);
    return data.data;
  },

  submit: async (attemptId: string): Promise<SubmissionCompletion> => {
    const { data } = await api.post(`/assessment-workspace/${attemptId}/submit`);
    return data.data;
  },

  getSummary: async (attemptId: string): Promise<SubmissionSummary> => {
    const { data } = await api.get(`/assessment-workspace/${attemptId}/summary`);
    return data.data;
  },
};

export default assessmentWorkspaceService;
