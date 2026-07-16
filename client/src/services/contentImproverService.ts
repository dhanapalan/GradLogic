import api from "../lib/api";

// =============================================================================
// AI Content Improver (Phase 13) — client wrapper.
// =============================================================================

export type ImprovementType = "grammar" | "distractors" | "explanation" | "examples" | "difficulty" | "coding_version";

export interface QuestionVersion {
  id: string;
  question_id: string;
  improvement_type: ImprovementType;
  question_text: string | null;
  options: string[] | null;
  explanation: string | null;
  hint: string | null;
  difficulty_level: string | null;
  starter_code: Record<string, string> | null;
  test_cases: unknown[] | null;
  change_summary: string | null;
  status: "proposed" | "applied" | "rejected";
  created_at: string;
  applied_at: string | null;
}

class ContentImproverService {
  async improve(questionId: string, improvementType: ImprovementType): Promise<QuestionVersion> {
    const res = await api.post(`/content-improver/${questionId}/improve`, { improvementType });
    return res.data.data;
  }

  async getVersions(questionId: string): Promise<QuestionVersion[]> {
    const res = await api.get(`/content-improver/${questionId}/versions`);
    return res.data.data;
  }

  async applyVersion(versionId: string): Promise<void> {
    await api.post(`/content-improver/versions/${versionId}/apply`);
  }

  async rejectVersion(versionId: string): Promise<void> {
    await api.post(`/content-improver/versions/${versionId}/reject`);
  }
}

export default new ContentImproverService();
