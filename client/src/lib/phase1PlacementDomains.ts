/**
 * Phase 1 Assessment Types — Placement Preparation only.
 * Do not add domain-specific engineering subjects (Civil, Mech, ECE, DSA-as-track, SQL track, etc.).
 *
 * bankCategory = question_bank.category enum value
 * journeyDomain = learning_paths.domain (AI Fundamentals uses a friendlier journey key)
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
export type Phase1BankCategory = (typeof PHASE1_PLACEMENT_DOMAINS)[number]["bankCategory"];

export const PHASE1_BANK_CATEGORIES: Phase1BankCategory[] = PHASE1_PLACEMENT_DOMAINS.map(
  (d) => d.bankCategory
);

export const PHASE1_PLACEMENT_TRACK = {
  id: "placement_preparation",
  title: "Placement Preparation",
  description:
    "Phase 1 assessment types for campus placement — Aptitude, Logical Reasoning, Python, Java, and AI Fundamentals only.",
} as const;

export function phase1DomainByBankCategory(category: string | null | undefined) {
  if (!category) return undefined;
  return PHASE1_PLACEMENT_DOMAINS.find((d) => d.bankCategory === category);
}

export function phase1DomainByValue(value: string | null | undefined) {
  if (!value) return undefined;
  return PHASE1_PLACEMENT_DOMAINS.find(
    (d) => d.value === value || d.bankCategory === value || d.journeyDomain === value
  );
}

export function isPhase1BankCategory(category: string | null | undefined): boolean {
  return !!category && (PHASE1_BANK_CATEGORIES as string[]).includes(category);
}
