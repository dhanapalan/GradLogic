/** Typical program lengths used to show course years as start–end (e.g. B.E. 4 yrs → 2002 - 2006). */
const DEGREE_DURATION_YEARS: Array<{ match: RegExp; years: number }> = [
  { match: /\b(b\.?\s*e\.?|b\.?\s*tech|be\b|btech)/i, years: 4 },
  { match: /\b(b\.?\s*sc|bsc|b\.?\s*com|bcom|b\.?\s*a\.?\b|\bba\b)/i, years: 3 },
  { match: /\b(m\.?\s*tech|m\.?\s*e\.?|mca|mba|m\.?\s*sc|msc|m\.?\s*com|mcom)/i, years: 2 },
  { match: /\b(diploma)/i, years: 3 },
  { match: /\b(ph\.?\s*d|doctorate)/i, years: 5 },
  { match: /\bbachelor/i, years: 4 },
];

/** Default UG engineering length when degree is missing or unrecognized. */
const DEFAULT_DURATION_YEARS = 4;

export function getDegreeDurationYears(degree?: string | null): number {
  const d = (degree || "").trim();
  if (!d) return DEFAULT_DURATION_YEARS;
  for (const { match, years } of DEGREE_DURATION_YEARS) {
    if (match.test(d)) return years;
  }
  return DEFAULT_DURATION_YEARS;
}

export function getCourseStartYear(
  degree?: string | null,
  passingYear?: number | null
): number | null {
  if (passingYear == null || !Number.isFinite(Number(passingYear))) return null;
  return Number(passingYear) - getDegreeDurationYears(degree);
}

/**
 * Format stored passing/end year as a full course span, e.g. "2002 - 2006".
 */
export function formatCourseYears(
  degree?: string | null,
  passingYear?: number | null,
  fallback = "—"
): string {
  if (passingYear == null || !Number.isFinite(Number(passingYear))) return fallback;
  const end = Number(passingYear);
  const start = getCourseStartYear(degree, end);
  if (start == null) return String(end);
  return `${start} - ${end}`;
}
