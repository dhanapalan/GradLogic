export const HOME_NAV = [
  { label: "Home", href: "/#home" },
  { label: "Features", href: "/#features" },
  { label: "AI Learning", href: "/#ai-learning" },
  { label: "Assessments", href: "/#assessments" },
  { label: "Readiness", href: "/#readiness" },
  { label: "Pricing", href: "/pricing" },
  { label: "Colleges", href: "/campus" },
  { label: "Contact", href: "/contact" },
] as const;

/**
 * Portal chooser cards on the home page.
 *
 * Student and College only. Faculty is folded into the College card — faculty
 * sign in through the same campus portal. Platform administration is
 * deliberately absent: admins reach it directly and there is no reason to
 * advertise the admin entry point to the public.
 */
export const PORTAL_CARDS = [
  {
    id: "student",
    title: "Student Portal",
    summary: "Learn, practise, and become placement ready.",
    features: [
      "AI learning paths",
      "Practice & mock tests",
      "Mock interviews",
      "Placement readiness score",
    ],
    cta: "Student login",
    portal: "exam",
  },
  {
    id: "college",
    title: "College Portal",
    summary: "For placement cells, college admins and faculty.",
    features: [
      "Student management",
      "Question banks",
      "Assessment campaigns",
      "Analytics & reports",
    ],
    cta: "College login",
    portal: "campus",
  },
] as const;

/**
 * Grouped into four phases rather than ten flat steps: the flat list needed a
 * horizontal scrollbar that hid the last four steps (including the outcome the
 * whole section is meant to sell) and gave "Learning" the same visual weight
 * as "Job Offers".
 */
export const WORKFLOW_PHASES = [
  {
    phase: "Onboard",
    summary: "Colleges enrol students and baseline their skills.",
    steps: ["Student onboarded by college", "Diagnostic assessment"],
  },
  {
    phase: "Learn",
    summary: "An AI path adapts to the gaps the diagnostic found.",
    steps: ["AI learning path", "Guided learning", "Practice sets"],
  },
  {
    phase: "Prove",
    summary: "Proctored assessments and mock interviews build a readiness score.",
    steps: ["Assessments", "Mock interviews", "Placement readiness"],
  },
  {
    phase: "Perform",
    summary: "Every student walks into placement season backed by a live readiness score.",
    steps: ["Placement readiness score", "Interview-day confidence"],
  },
] as const;

export const WHY_FEATURES = [
  { title: "AI Personalized Learning", desc: "Adaptive paths based on diagnostic gaps and goals." },
  { title: "AI Tutor", desc: "Always-on coaching for concepts, doubts, and practice." },
  { title: "AI Career Coach", desc: "Role guidance, readiness tips, and weekly focus plans." },
  { title: "AI Resume Review", desc: "ATS scoring, keyword gaps, and rewrite suggestions." },
  { title: "AI Interview Coach", desc: "Voice & text mocks with scoring and feedback." },
  { title: "AI Proctoring", desc: "Integrity signals for fair campus assessments." },
  { title: "AI Skill Gap Analysis", desc: "Skill heatmaps tied to placement targets." },
  { title: "AI Recommendation Engine", desc: "Courses, practice sets, and next assessments." },
  { title: "ATS Resume Analysis", desc: "Parse, score, and improve resumes for hiring filters." },
  { title: "Gamified Practice", desc: "Streaks, achievements, and leaderboards that make consistent practice stick." },
] as const;

export const STATS = [
  { label: "Students", value: 125000 },
  { label: "Colleges", value: 420 },
  { label: "Courses", value: 1800 },
  { label: "Assessments", value: 9500 },
  { label: "Companies", value: 860 },
  { label: "Placements", value: 48000 },
  { label: "Mock Interviews", value: 210000 },
  { label: "Questions", value: 1250000 },
  { label: "Certificates", value: 92000 },
] as const;

export const TESTIMONIALS = [
  {
    role: "Student",
    name: "Ananya R.",
    quote:
      "The readiness score made my gaps obvious. Mock interviews and practice sets got me campus-ready in one semester.",
    org: "CSE · Final Year",
  },
  {
    role: "Recruiter",
    name: "Vikram S.",
    quote:
      "We shortlist faster with ranked assessments and integrity signals. Campus hiring finally feels like a product, not a spreadsheet.",
    org: "Talent Lead · FinTech",
  },
  {
    role: "College",
    name: "Dr. Meera K.",
    quote:
      "Placement cell visibility improved overnight — drives, readiness, and outcomes in one dashboard for every department.",
    org: "Placement Director",
  },
  {
    role: "Student",
    name: "Rohan P.",
    quote:
      "Voice AI interviews felt real. Feedback after each round told me exactly what to fix before company drives.",
    org: "IT · Pre-final",
  },
  {
    role: "Recruiter",
    name: "Priya N.",
    quote:
      "Scheduling interviews and tracking offers across colleges is seamless. GradLogic replaced three tools for us.",
    org: "Campus Hiring · Product Co.",
  },
] as const;
