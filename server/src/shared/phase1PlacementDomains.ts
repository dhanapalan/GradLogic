/**
 * Phase 1 Assessment Types — Placement Preparation only.
 * Shared by Assessment Hub seeders / filters. No engineering-specific domains.
 */
export const PHASE1_PLACEMENT_DOMAINS = [
  {
    value: "aptitude",
    label: "Aptitude",
    bankCategory: "aptitude",
    journeyDomain: "aptitude",
  },
  {
    value: "reasoning",
    label: "Logical Reasoning",
    bankCategory: "reasoning",
    journeyDomain: "reasoning",
  },
  {
    value: "python_coding",
    label: "Python",
    bankCategory: "python_coding",
    journeyDomain: "python_coding",
  },
  {
    value: "java_coding",
    label: "Java",
    bankCategory: "java_coding",
    journeyDomain: "java_coding",
  },
  {
    value: "ai_fundamentals",
    label: "AI Fundamentals",
    bankCategory: "data_science",
    journeyDomain: "ai_fundamentals",
  },
] as const;

export type Phase1PlacementDomain = (typeof PHASE1_PLACEMENT_DOMAINS)[number]["value"];

export const PHASE1_BANK_CATEGORIES = PHASE1_PLACEMENT_DOMAINS.map((d) => d.bankCategory);

export const PHASE1_COLLECTION_SEEDS = PHASE1_PLACEMENT_DOMAINS.map((d) => ({
  name: d.label,
  category: d.bankCategory,
  description: `Placement Preparation · ${d.label} — Phase 1 reusable pack for practice, mocks, and assessments.`,
}));

export function isPhase1BankCategory(category: string | null | undefined): boolean {
  return !!category && (PHASE1_BANK_CATEGORIES as readonly string[]).includes(category);
}
