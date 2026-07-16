import api from "../lib/api";

export type MyAssessmentStatus =
  | "upcoming"
  | "available"
  | "in_progress"
  | "submitted"
  | "expired";

export type MyAssessmentAction =
  | "view_details"
  | "start"
  | "resume"
  | "view_submission";

export type QuestionNavStatus =
  | "not_visited"
  | "visited"
  | "answered"
  | "marked_for_review";

export interface MyAssessment {
  campaign_id: string;
  campaign_code: string;
  campaign_name: string;
  assessment_id: string;
  assessment_name: string;
  assessment_type: string;
  total_questions: number;
  duration_minutes: number | null;
  passing_marks: number;
  max_attempts: number;
  attempts_used: number;
  available_from: string;
  available_until: string;
  instructions: string | null;
  status: MyAssessmentStatus;
  started_at: string | null;
  completed_at: string | null;
  can_start: boolean;
  can_resume: boolean;
  action: MyAssessmentAction;
  start_blocked_reason?: string | null;
}

export interface AssessmentInstructions extends MyAssessment {
  assessment_code: string;
  total_marks: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_resume: boolean;
  show_result_immediately: boolean;
  negative_marking: boolean;
}

export interface StartAssessmentResult extends AssessmentInstructions {
  attempt_id: string;
  started: boolean;
  resumed: boolean;
  message: string;
}

export interface AttemptQuestion {
  id: string;
  display_order: number;
  marks: number;
  title: string;
  description: string | null;
  question_type: string;
  category: string;
  difficulty?: string | null;
  section?: string | null;
  options: Array<{ label: string; text: string }>;
  status: QuestionNavStatus;
  selected: string[];
  marked_for_review: boolean;
}

export interface AttemptIntegrityContext {
  settings: {
    proctoring_enabled: boolean;
    require_fullscreen: boolean;
    detect_tab_switch: boolean;
    detect_window_blur: boolean;
    detect_copy_paste: boolean;
    detect_multi_monitor: boolean;
    require_camera: boolean;
    require_microphone: boolean;
    tab_switch_limit: number;
    integrity_auto_flag: boolean;
  };
  campaign_id: string;
  campaign_name: string;
  attempt: {
    id: string;
    status: string;
    integrity_score: number;
    integrity_violations: number;
    integrity_status: string;
  } | null;
}

export interface AttemptWorkspace {
  attempt: {
    id: string;
    campaign_id: string;
    assessment_id: string;
    assessment_name: string;
    campaign_name: string;
    attempt_number: number;
    status: string;
    current_index: number;
    time_remaining_seconds: number;
    server_deadline: string;
    server_now?: string;
    timer_warning_seconds?: number;
    auto_save_interval_seconds?: number;
    last_saved_at?: string;
    total_questions: number;
    duration_minutes: number | null;
    available_until: string;
  };
  questions: AttemptQuestion[];
  palette: Array<{ index: number; question_id: string; status: QuestionNavStatus }>;
  /** Module 09 — optional integrity context (null when proctoring off / unavailable) */
  integrity?: AttemptIntegrityContext | null;
}

export interface AttemptTimerSync {
  attempt_id: string;
  server_now: string;
  server_deadline: string;
  available_until: string;
  time_remaining_seconds: number;
  timer_warning_seconds: number;
  current_index: number;
  last_saved_at: string;
  expired: boolean;
}

export interface SubmissionSummary {
  campaign_id: string;
  attempt_id: string;
  assessment_name: string;
  campaign_name: string;
  attempt_number: number;
  total_questions: number;
  answered_questions: number;
  unanswered_questions: number;
  marked_for_review: number;
  is_final: boolean;
  warning: string;
}

export interface SubmissionCompletion {
  campaign_id: string;
  attempt_id: string;
  assessment_name: string;
  campaign_name: string;
  attempt_number: number;
  status: string;
  submitted_at: string;
  auto_submitted?: boolean;
  message: string;
  total_questions?: number;
  answered_questions?: number;
  unanswered_questions?: number;
  marked_for_review?: number;
}

export interface StudentAssessmentResult {
  id: string;
  assessment_name: string;
  campaign_name: string;
  attempt_number: number;
  status: string;
  total_marks: number;
  obtained_marks: number;
  negative_marks: number;
  percentage: number;
  passing_marks: number;
  passed: boolean | null;
  submitted_at: string | null;
  published_at: string | null;
  questions: Array<{
    question_id: string;
    question_type: string;
    title: string;
    marks_possible: number;
    marks_awarded: number;
    is_correct: boolean | null;
    selected: string[];
    evaluation_status: string;
    manual_feedback: string | null;
  }>;
}

export interface AttemptSavePayload {
  current_index?: number;
  time_remaining_seconds?: number;
  question_id?: string;
  selected?: string[] | null;
  marked_for_review?: boolean;
  visit?: boolean;
  clear_response?: boolean;
}

/** Lightweight autosave response (preferred) — avoids full workspace rebuild. */
export interface AttemptSaveAck {
  saved: true;
  attempt: {
    id: string;
    campaign_id: string;
    current_index: number;
    time_remaining_seconds: number;
    server_deadline: string;
    server_now: string;
    last_saved_at: string;
    status: string;
    auto_save_interval_seconds: number;
    timer_warning_seconds: number;
  };
  question: {
    question_id: string;
    selected: string[];
    marked_for_review: boolean;
    status: QuestionNavStatus;
    visited: boolean;
  } | null;
}

export type AttemptSaveResult =
  | AttemptWorkspace
  | AttemptSaveAck
  | SubmissionCompletion
  | { attempt_id: string; status: string; score: number | null; message: string };

export function isSaveAck(data: unknown): data is AttemptSaveAck {
  return !!data && typeof data === "object" && (data as AttemptSaveAck).saved === true;
}

export interface MyAssessmentsMeta {
  statuses: Array<{ value: string; label: string }>;
  assessment_types: Array<{ value: string; label: string }>;
}

export interface MyAssessmentsListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  assessment_type?: string;
}

const studentAssessmentsService = {
  async meta(): Promise<MyAssessmentsMeta> {
    const { data } = await api.get("/student-assessments/meta");
    return data.data;
  },

  async list(params: MyAssessmentsListParams = {}) {
    const { data } = await api.get("/student-assessments/my-assessments", { params });
    return data as {
      data: MyAssessment[];
      pagination: { total: number; page: number; limit: number; pages: number };
    };
  },

  async get(campaignId: string): Promise<MyAssessment> {
    const { data } = await api.get(`/student-assessments/my-assessments/${campaignId}`);
    return data.data;
  },

  async instructions(campaignId: string): Promise<AssessmentInstructions> {
    const { data } = await api.get(
      `/student-assessments/my-assessments/${campaignId}/instructions`
    );
    return data.data;
  },

  async start(campaignId: string): Promise<StartAssessmentResult> {
    const { data } = await api.post(`/student-assessments/my-assessments/${campaignId}/start`);
    return data.data;
  },

  async getAttempt(campaignId: string): Promise<AttemptWorkspace> {
    const { data } = await api.get(`/student-assessments/my-assessments/${campaignId}/attempt`);
    return data.data;
  },

  async syncTimer(campaignId: string): Promise<AttemptTimerSync> {
    const { data } = await api.get(`/student-assessments/my-assessments/${campaignId}/attempt/sync`);
    return data.data;
  },

  async saveAttempt(
    campaignId: string,
    payload: AttemptSavePayload
  ): Promise<AttemptSaveResult> {
    const { data } = await api.put(
      `/student-assessments/my-assessments/${campaignId}/attempt`,
      payload
    );
    return data.data;
  },

  /** Persist with retries for transient failures (Module 06.4). */
  async saveAttemptWithRetry(
    campaignId: string,
    payload: AttemptSavePayload,
    retries = 3
  ): Promise<AttemptSaveResult> {
    let lastErr: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        return await this.saveAttempt(campaignId, payload);
      } catch (err: any) {
        lastErr = err;
        const status = err?.response?.status;
        // Do not retry auth / hard business errors
        if (status === 401 || status === 403 || status === 400 || status === 404) throw err;
        await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
      }
    }
    throw lastErr;
  },

  async getSubmissionSummary(campaignId: string): Promise<SubmissionSummary> {
    const { data } = await api.get(
      `/student-assessments/my-assessments/${campaignId}/attempt/summary`
    );
    return data.data;
  },

  async submitAttempt(campaignId: string): Promise<SubmissionCompletion> {
    const { data } = await api.post(
      `/student-assessments/my-assessments/${campaignId}/attempt/submit`
    );
    return data.data;
  },

  async getSubmissionCompletion(campaignId: string): Promise<SubmissionCompletion> {
    const { data } = await api.get(
      `/student-assessments/my-assessments/${campaignId}/attempt/completion`
    );
    return data.data;
  },

  async getResult(campaignId: string): Promise<StudentAssessmentResult> {
    const { data } = await api.get(`/student-assessments/my-assessments/${campaignId}/result`);
    return data.data;
  },
};

export default studentAssessmentsService;
