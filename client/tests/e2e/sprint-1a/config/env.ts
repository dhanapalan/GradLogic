/**
 * Sprint 1A — environment & credentials
 * All values are env-overridable for local / staging / production QA.
 */
export const BASE_URL = (process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
export const API_URL = (process.env.API_URL || "http://localhost:5050/api").replace(/\/$/, "");

export const SUPER_ADMIN = {
  email: process.env.S1A_SUPERADMIN_EMAIL || process.env.ADMIN_EMAIL || "admin@gradlogic.com",
  password: process.env.S1A_SUPERADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "Admin123",
  loginTab: "Super Admin" as const,
};

export const COLLEGE_ADMIN = {
  email: process.env.S1A_COLLEGE_EMAIL || "college@gradlogic.com",
  password: process.env.S1A_COLLEGE_PASSWORD || "gradlogic123",
  loginTab: "College Admin" as const,
};

/** Strong password that satisfies server passwordSchema (≥8, upper, lower, digit). */
export const STRONG_PASSWORD =
  process.env.S1A_STRONG_PASSWORD || "GradLogic@2026!";

export const WEAK_PASSWORD = "abc";

export const ROUTES = {
  login: "/auth/login",
  setupPassword: "/auth/setup-password",
  forgotPassword: "/auth/forgot-password",
  superadminDashboard: "/app/superadmin/dashboard",
  colleges: "/app/superadmin/colleges",
  collegesNew: "/app/superadmin/colleges/new",
  collegeDetail: (id: string) => `/app/superadmin/colleges/${id}`,
  campusDashboard: "/app/college-portal/dashboard",
  campusStudents: "/app/college-portal/students",
  campusStudentNew: "/app/college-portal/students/new",
  campusStudentDetail: (id: string) => `/app/college-portal/students/${id}`,
  studentOnboarding: "/student-onboarding",
  studentDashboard: "/app/student-portal",
} as const;

export type LoginTabLabel =
  | "Student"
  | "Faculty"
  | "College Admin"
  | "Platform Admin"
  | "Recruiter"
  | "Company HR"
  | "Super Admin";
