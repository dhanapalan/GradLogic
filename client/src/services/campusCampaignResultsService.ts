import api from "../lib/api";

export interface CampaignResultsSummary {
  submitted: number;
  evaluated: number;
  published: number;
  needs_manual_review: number;
  passed: number;
  failed: number;
}

export interface CampaignResultRow {
  id: string;
  attempt_id: string;
  user_id: string;
  student_name: string;
  student_email: string;
  attempt_number: number;
  status: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number;
  passed: boolean | null;
  needs_manual_review: boolean;
  submitted_at: string | null;
  published_at: string | null;
}

export interface CampaignResultsPayload {
  campaign: {
    id: string;
    name: string;
    campaign_code: string;
    show_result_immediately: boolean;
  };
  summary: CampaignResultsSummary;
  results: CampaignResultRow[];
}

export interface FacultyEvaluationDetail {
  id: string;
  attempt_id: string;
  student_name: string | null;
  student_email: string | null;
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
  needs_manual_review: boolean;
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
    correct_labels?: string[];
    evaluation_status: string;
    manual_feedback: string | null;
  }>;
}

const campusCampaignResultsService = {
  async list(campaignId: string): Promise<CampaignResultsPayload> {
    const { data } = await api.get(`/campus/campaigns/${campaignId}/results`);
    return data.data;
  },

  async evaluate(campaignId: string) {
    const { data } = await api.post(`/campus/campaigns/${campaignId}/evaluate`);
    return data.data as { campaign_id: string; evaluated: number };
  },

  async publish(campaignId: string) {
    const { data } = await api.post(`/campus/campaigns/${campaignId}/results/publish`);
    return data.data as { campaign_id: string; published: number };
  },

  async getEvaluation(campaignId: string, evaluationId: string): Promise<FacultyEvaluationDetail> {
    const { data } = await api.get(`/campus/campaigns/${campaignId}/results/${evaluationId}`);
    return data.data;
  },

  async scoreShortAnswer(
    campaignId: string,
    evaluationId: string,
    questionId: string,
    payload: { marks_awarded: number; is_correct?: boolean; feedback?: string }
  ) {
    const { data } = await api.put(
      `/campus/campaigns/${campaignId}/results/${evaluationId}/questions/${questionId}`,
      payload
    );
    return data.data as FacultyEvaluationDetail;
  },
};

export default campusCampaignResultsService;
