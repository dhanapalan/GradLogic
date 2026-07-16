/** Assessment Hub · Templates — local constants (do not change shared phase1PlacementDomains). */

export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const ASSESSMENT_TYPES = [
  { value: "practice", label: "Practice" },
  { value: "mock_test", label: "Mock Test" },
  { value: "coding_assessment", label: "Coding Assessment" },
  { value: "weekly_test", label: "Weekly Test" },
  { value: "placement_test", label: "Placement Test" },
] as const;

export type AssessmentType = (typeof ASSESSMENT_TYPES)[number]["value"];

/** Phase-1 domains with Templates display labels (Quantitative Aptitude). */
export const TEMPLATE_DOMAINS = [
  { value: "aptitude", label: "Quantitative Aptitude", bankCategory: "aptitude" },
  { value: "reasoning", label: "Logical Reasoning", bankCategory: "reasoning" },
  { value: "python_coding", label: "Python", bankCategory: "python_coding" },
  { value: "java_coding", label: "Java", bankCategory: "java_coding" },
  { value: "ai_fundamentals", label: "AI Fundamentals", bankCategory: "data_science" },
] as const;

export type TemplateDomain = (typeof TEMPLATE_DOMAINS)[number]["value"];

export const DIFFICULTY_LEVELS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "mixed", label: "Mixed" },
] as const;

export type TemplateDifficulty = (typeof DIFFICULTY_LEVELS)[number]["value"];

export type HubTemplateSection = {
  section_name: string;
  collection_id: string;
  time_limit_minutes?: number | null;
};

export type HubTemplateConfig = {
  assessment_type?: AssessmentType;
  placement_domain?: TemplateDomain | string;
  difficulty?: TemplateDifficulty;
  tags?: string[];
  instructions?: string;
  shuffle_questions?: boolean;
  shuffle_options?: boolean;
  sections?: HubTemplateSection[];
};

export type AssessmentTemplate = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes?: number;
  total_questions?: number;
  total_marks?: number;
  overall_cutoff?: number | null;
  negative_marking_enabled?: boolean;
  negative_marking_value?: number | null;
  difficulty_distribution?: Record<string, number> | null;
  skill_distribution?: Record<string, number> | null;
  targeting_config?: {
    track?: string;
    phase1_domain?: string;
    bank_category?: string | null;
  } | null;
  hub_template_config?: HubTemplateConfig | null;
  status: string;
  version?: number;
  updated_at?: string;
  created_at?: string;
};

/** Map template assessment_type → Assessment Builder drive_type. */
export function driveTypeForAssessmentType(
  type: AssessmentType | string | undefined
): "hiring" | "practice_test" | "mock_test" | "coding_assessment" {
  switch (type) {
    case "practice":
    case "weekly_test":
      return "practice_test";
    case "mock_test":
      return "mock_test";
    case "coding_assessment":
      return "coding_assessment";
    case "placement_test":
    default:
      return "hiring";
  }
}

export function parseHubConfig(
  raw: HubTemplateConfig | string | null | undefined
): HubTemplateConfig {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as HubTemplateConfig;
    } catch {
      return {};
    }
  }
  return raw;
}

export function domainLabel(value: string | null | undefined): string {
  if (!value) return "General";
  if (value === "campus_combined") return "Campus Combined";
  const hit = TEMPLATE_DOMAINS.find(
    (d) => d.value === value || d.bankCategory === value
  );
  return hit?.label || value;
}

export function assessmentTypeLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return ASSESSMENT_TYPES.find((t) => t.value === value)?.label || value;
}

export function statusLabel(status: string): string {
  if (status === "active_template" || status === "active") return "Published";
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
}

export function normalizeStatus(status: string): TemplateStatus {
  if (status === "archived") return "archived";
  if (status === "published" || status === "active_template" || status === "active") {
    return "published";
  }
  return "draft";
}

export function emptyHubConfig(): HubTemplateConfig {
  return {
    assessment_type: "placement_test",
    placement_domain: "aptitude",
    difficulty: "mixed",
    tags: [],
    instructions: "",
    shuffle_questions: true,
    shuffle_options: false,
    sections: [],
  };
}

/** Sections that have a Question Collection bound. */
export function boundSections(
  hub: HubTemplateConfig | string | null | undefined
): HubTemplateSection[] {
  return (parseHubConfig(hub).sections || []).filter((s) => !!s.collection_id);
}

/**
 * Published + at least one bound collection — safe to call instantiateFromTemplate.
 */
export function canInstantiateTemplate(
  template: Pick<AssessmentTemplate, "status" | "hub_template_config">
): boolean {
  return (
    normalizeStatus(template.status) === "published" &&
    boundSections(template.hub_template_config).length > 0
  );
}

/** Persist Hub statuses only (map legacy active → published). */
export function toPersistStatus(status: string): TemplateStatus {
  return normalizeStatus(status);
}
