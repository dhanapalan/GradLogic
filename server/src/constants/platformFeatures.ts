/**
 * Platform feature catalog — LMS groups + portal capabilities.
 */

export type FeatureCategory =
  | "platform"
  | "aptitude"
  | "technical"
  | "soft_skills"
  | "interview"
  | "entrance";

export type PlatformFeatureKey =
  | "students"
  | "question_bank"
  | "workflows"
  | "assessments"
  | "analytics"
  | "soft_skills"
  | "technical_skills"
  | "settings"
  | "student_workflow"
  | "learn"
  | "practice"
  | "tests"
  | "gamification"
  | "notifications"
  | "payments"
  | "aptitude_practice"
  | "aptitude_tests"
  | "aptitude_workflows"
  | "technical_dsa"
  | "technical_programming"
  | "technical_practice"
  | "technical_assessments"
  | "soft_communication"
  | "soft_presentations"
  | "soft_teamwork"
  | "interview_gd"
  | "interview_mock"
  | "interview_pi"
  | "entrance_cuet"
  | "entrance_gate"
  | "entrance_cat"
  | "ai_question_generation";

export interface FeatureCatalogItem {
  key: PlatformFeatureKey;
  label: string;
  description: string;
  portal: "college" | "student" | "both";
  category: FeatureCategory;
}

export const FEATURE_CATALOG: FeatureCatalogItem[] = [
  { key: "students", label: "Students", description: "Student roster & management", portal: "college", category: "platform" },
  { key: "assessments", label: "Tests & Assessments", description: "Campus drives and exams", portal: "college", category: "platform" },
  { key: "analytics", label: "Analytics & Reports", description: "Performance insights", portal: "college", category: "platform" },
  { key: "settings", label: "Settings", description: "Campus configuration", portal: "college", category: "platform" },
  { key: "question_bank", label: "Question Bank", description: "Practice & assessment questions", portal: "both", category: "platform" },
  { key: "ai_question_generation", label: "AI Question Generator", description: "Prompt-based question generation for the college question bank", portal: "college", category: "platform" },
  { key: "workflows", label: "Workflows", description: "Structured learning workflows", portal: "college", category: "platform" },
  { key: "soft_skills", label: "Soft Skills Hub", description: "College soft-skills management", portal: "college", category: "platform" },
  { key: "technical_skills", label: "Technical Skills Hub", description: "College technical tracks", portal: "college", category: "platform" },
  { key: "student_workflow", label: "My Workflow", description: "Personal placement workflow", portal: "student", category: "platform" },
  { key: "learn", label: "Learn", description: "Courses and learning modules", portal: "student", category: "platform" },
  { key: "practice", label: "Practice", description: "Practice arena", portal: "student", category: "platform" },
  { key: "tests", label: "Tests & Mocks", description: "Mock tests and exams", portal: "student", category: "platform" },
  { key: "gamification", label: "Achievements", description: "Badges, streaks, leaderboards", portal: "student", category: "platform" },
  { key: "notifications", label: "Notifications", description: "Campus announcements", portal: "both", category: "platform" },
  { key: "payments", label: "Payments", description: "Fee collection & billing", portal: "both", category: "platform" },
  { key: "aptitude_practice", label: "Aptitude Practice", description: "Daily aptitude drills", portal: "student", category: "aptitude" },
  { key: "aptitude_tests", label: "Aptitude Mock Tests", description: "Timed aptitude assessments", portal: "both", category: "aptitude" },
  { key: "aptitude_workflows", label: "Aptitude Workflows", description: "Structured aptitude pathways", portal: "college", category: "aptitude" },
  { key: "technical_dsa", label: "DSA Track", description: "Data structures & algorithms", portal: "student", category: "technical" },
  { key: "technical_programming", label: "Programming", description: "Language fundamentals & labs", portal: "student", category: "technical" },
  { key: "technical_practice", label: "Code Practice", description: "Coding practice arena", portal: "student", category: "technical" },
  { key: "technical_assessments", label: "Technical Assessments", description: "Campus technical tests", portal: "both", category: "technical" },
  { key: "soft_communication", label: "Communication", description: "Written & verbal communication", portal: "student", category: "soft_skills" },
  { key: "soft_presentations", label: "Presentations", description: "Public speaking & decks", portal: "student", category: "soft_skills" },
  { key: "soft_teamwork", label: "Teamwork", description: "Collaboration & leadership", portal: "student", category: "soft_skills" },
  { key: "interview_gd", label: "Group Discussion", description: "GD topics & evaluation", portal: "both", category: "interview" },
  { key: "interview_mock", label: "Mock Interviews", description: "AI / peer mock interviews", portal: "student", category: "interview" },
  { key: "interview_pi", label: "Personal Interview", description: "HR & technical PI prep", portal: "student", category: "interview" },
  { key: "entrance_cuet", label: "CUET Prep", description: "Common University Entrance Test", portal: "student", category: "entrance" },
  { key: "entrance_gate", label: "GATE Prep", description: "Graduate Aptitude Test", portal: "student", category: "entrance" },
  { key: "entrance_cat", label: "CAT Prep", description: "MBA entrance preparation", portal: "student", category: "entrance" },
];

export const FEATURE_CATEGORY_LABELS: Record<FeatureCategory, string> = {
  platform: "Platform",
  aptitude: "Aptitude & Reasoning",
  technical: "Technical Skills",
  soft_skills: "Soft Skills & Communication",
  interview: "Interview Preparation",
  entrance: "Higher Education & Entrance Exams",
};

export const COLLEGE_CORE_FEATURES: PlatformFeatureKey[] = ["students", "settings"];
export const STUDENT_CORE_FEATURES: PlatformFeatureKey[] = ["student_workflow"];
export const ALL_FEATURE_KEYS = FEATURE_CATALOG.map((f) => f.key);
export const DEFAULT_COLLEGE_MODULE_KEYS = ["campus-core", "aptitude-reasoning"];

/**
 * Category-specific features imply the shared platform surface they run on —
 * e.g. a module granting aptitude practice must open the Practice Arena route,
 * and module courses need the Learn surface. Applied when resolving a
 * college's enabled feature set.
 */
export const FEATURE_IMPLICATIONS: Partial<Record<PlatformFeatureKey, PlatformFeatureKey[]>> = {
  aptitude_practice: ["practice"],
  technical_practice: ["practice"],
  aptitude_tests: ["tests"],
  technical_assessments: ["tests"],
  aptitude_workflows: ["workflows"],
  entrance_cuet: ["learn"],
  entrance_gate: ["learn"],
  entrance_cat: ["learn"],
};

export function expandFeatureImplications(keys: PlatformFeatureKey[]): PlatformFeatureKey[] {
  const set = new Set(keys);
  for (const key of keys) {
    for (const implied of FEATURE_IMPLICATIONS[key] ?? []) {
      set.add(implied);
    }
  }
  return [...set];
}

export function featureLabel(key: string): string {
  return FEATURE_CATALOG.find((f) => f.key === key)?.label ?? key;
}

export function featuresByCategory(): Record<FeatureCategory, FeatureCatalogItem[]> {
  const grouped = {} as Record<FeatureCategory, FeatureCatalogItem[]>;
  for (const cat of Object.keys(FEATURE_CATEGORY_LABELS) as FeatureCategory[]) {
    grouped[cat] = FEATURE_CATALOG.filter((f) => f.category === cat);
  }
  return grouped;
}
