import api from "../lib/api";
import {
  type AssessmentTemplate,
  type AssessmentType,
  type HubTemplateConfig,
  boundSections,
  canInstantiateTemplate,
  driveTypeForAssessmentType,
  normalizeStatus,
  parseHubConfig,
  toPersistStatus,
} from "../pages/superadmin/features/templates/templateConstants";

export type CreateTemplateInput = {
  name: string;
  description?: string;
  duration_minutes?: number;
  total_questions?: number;
  total_marks?: number;
  overall_cutoff?: number | null;
  negative_marking_enabled?: boolean;
  negative_marking_value?: number | null;
  difficulty_distribution?: Record<string, number>;
  skill_distribution?: Record<string, number>;
  targeting_config?: Record<string, unknown>;
  hub_template_config?: HubTemplateConfig;
  status?: string;
  proctoring_mode?: string;
};

function normalizeRow(row: AssessmentTemplate): AssessmentTemplate {
  return {
    ...row,
    status: toPersistStatus(row.status || "draft"),
    hub_template_config: parseHubConfig(row.hub_template_config),
    difficulty_distribution:
      typeof row.difficulty_distribution === "string"
        ? (() => {
            try {
              return JSON.parse(row.difficulty_distribution as unknown as string);
            } catch {
              return {};
            }
          })()
        : row.difficulty_distribution,
  };
}

const assessmentTemplatesService = {
  async list(params?: { status?: string }): Promise<AssessmentTemplate[]> {
    const res = await api.get("/assessment-rules", {
      params: { status: params?.status },
    });
    return ((res.data?.data || []) as AssessmentTemplate[]).map(normalizeRow);
  },

  async get(id: string): Promise<AssessmentTemplate> {
    const res = await api.get(`/assessment-rules/${id}`);
    return normalizeRow(res.data?.data);
  },

  async create(input: CreateTemplateInput): Promise<AssessmentTemplate> {
    const body = {
      ...input,
      status: input.status ? toPersistStatus(input.status) : "draft",
    };
    const res = await api.post("/assessment-rules", body);
    return normalizeRow(res.data?.data);
  },

  async update(id: string, input: Partial<CreateTemplateInput>): Promise<AssessmentTemplate> {
    const body = {
      ...input,
      ...(input.status != null ? { status: toPersistStatus(input.status) } : {}),
    };
    const res = await api.put(`/assessment-rules/${id}`, body);
    return normalizeRow(res.data?.data);
  },

  async clone(id: string): Promise<AssessmentTemplate> {
    const res = await api.post(`/assessment-rules/${id}/clone`);
    return normalizeRow(res.data?.data);
  },

  async archive(id: string): Promise<AssessmentTemplate> {
    const res = await api.post(`/assessment-rules/${id}/archive`);
    return normalizeRow(res.data?.data);
  },

  async seedPhase1(): Promise<{ created_count: number; repaired_count?: number }> {
    const res = await api.post("/assessment-rules/seed-phase1");
    return res.data?.data || { created_count: 0, repaired_count: 0 };
  },

  /**
   * Create an assessment instance from a published template.
   * Reuses Assessment Builder POST /drives (no Builder UI changes).
   */
  async instantiateFromTemplate(
    template: AssessmentTemplate,
    options?: {
      driveTypeOverride?: "hiring" | "practice_test" | "mock_test" | "coding_assessment";
      nameSuffix?: string;
    }
  ): Promise<{ id: string }> {
    const hub = parseHubConfig(template.hub_template_config);
    if (normalizeStatus(template.status) !== "published") {
      throw new Error("Only published templates can create assessments");
    }

    const sections = boundSections(hub);
    if (!canInstantiateTemplate(template) || sections.length === 0) {
      throw new Error(
        "Bind at least one Question Collection section on the template before creating an assessment"
      );
    }

    const assessmentType = (hub.assessment_type || "placement_test") as AssessmentType;
    const drive_type =
      options?.driveTypeOverride || driveTypeForAssessmentType(assessmentType);

    const nameBase = template.name.replace(/\s*\(Copy\)\s*$/i, "").trim();
    const suffix =
      options?.nameSuffix ||
      (drive_type === "practice_test"
        ? "Practice"
        : drive_type === "mock_test"
          ? "Mock"
          : drive_type === "coding_assessment"
            ? "Coding"
            : "Assessment");

    const res = await api.post("/drives", {
      name: `${nameBase} · ${suffix}`,
      rule_id: template.id,
      drive_type,
      duration_minutes: template.duration_minutes || 60,
      attempt_limit: drive_type === "practice_test" ? 99 : 1,
      shuffle_questions: hub.shuffle_questions ?? true,
      auto_submit: true,
      // Practice Sets: unlimited self-practice — active immediately, no proctoring
      ...(drive_type === "practice_test"
        ? { status: "active", proctoring_mode: "none" }
        : {}),
      // Mock Tests: single-attempt placement simulation — student-visible after pool seed
      ...(drive_type === "mock_test"
        ? { status: "active", proctoring_mode: "none", allow_mock: true, attempt_limit: 1 }
        : {}),
      // Coding Assessments: Python/Java challenges from Knowledge Library collections
      ...(drive_type === "coding_assessment"
        ? { status: "active", proctoring_mode: "none", attempt_limit: 3, shuffle_questions: false }
        : {}),
      collection_ids: sections.map((s) => s.collection_id),
      sections: sections.map((s) => ({
        collection_id: s.collection_id,
        section_name: s.section_name || "Section",
        // Section timers from template (stored for player / analysis)
        ...(s.time_limit_minutes != null
          ? { time_limit_minutes: s.time_limit_minutes }
          : {}),
      })),
      auto_generate_pool: false,
    });

    const id = res.data?.data?.id as string | undefined;
    if (!id) throw new Error("Assessment was created but no id returned");
    return { id };
  },
};

export default assessmentTemplatesService;
export type { AssessmentTemplate };
