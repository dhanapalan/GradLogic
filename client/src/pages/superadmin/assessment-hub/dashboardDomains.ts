/**
 * Assessment Hub Dashboard — display labels for Phase-1 Placement Prep domains.
 * Local aliases only; does not mutate shared phase1PlacementDomains.
 */
export const DASHBOARD_DOMAINS = [
  { value: "aptitude", label: "Quantitative Aptitude" },
  { value: "reasoning", label: "Logical Reasoning" },
  { value: "python_coding", label: "Python" },
  { value: "java_coding", label: "Java" },
  { value: "ai_fundamentals", label: "AI Fundamentals" },
] as const;

export type DashboardDomainValue = (typeof DASHBOARD_DOMAINS)[number]["value"];
