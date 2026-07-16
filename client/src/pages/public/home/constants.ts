export const HOME_NAV = [
  { label: "Home", href: "/#home" },
  { label: "Features", href: "/#features" },
  { label: "AI Learning", href: "/#ai-learning" },
  { label: "Assessments", href: "/#assessments" },
  { label: "Placements", href: "/#placements" },
  { label: "Pricing", href: "/pricing" },
  { label: "Colleges", href: "/campus" },
  { label: "Recruiters", href: "/#recruiters" },
  { label: "Contact", href: "/contact" },
] as const;

export const WORKFLOW_STEPS = [
  "Student Registers",
  "Diagnostic Assessment",
  "AI Learning Path",
  "Learning",
  "Practice",
  "Assessments",
  "Mock Interviews",
  "Placement Readiness",
  "Campus Hiring",
  "Job Offers",
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
  { title: "Campus Hiring Automation", desc: "Drives, shortlists, interviews, and offers in one flow." },
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
