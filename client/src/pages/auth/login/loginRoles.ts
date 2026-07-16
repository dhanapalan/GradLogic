export type LoginRoleId =
  | "student"
  | "faculty"
  | "college"
  | "platform_admin"
  | "recruiter"
  | "company_hr"
  | "super_admin";

export type LoginRole = {
  id: LoginRoleId;
  label: string;
  hint: string;
  /** Expected backend roles for soft guidance (auth still uses email/password). */
  expectedRoles: string[];
};

export const LOGIN_ROLES: LoginRole[] = [
  {
    id: "student",
    label: "Student",
    hint: "Learn, practice, assessments & readiness",
    expectedRoles: ["student"],
  },
  {
    id: "faculty",
    label: "Faculty",
    hint: "Review assessments & student progress",
    expectedRoles: ["instructor", "college_staff"],
  },
  {
    id: "college",
    label: "College Admin",
    hint: "Campaigns, students & placement cell",
    expectedRoles: ["college_admin", "college", "placement_cell"],
  },
  {
    id: "platform_admin",
    label: "Platform Admin",
    hint: "Cross-college platform operations",
    expectedRoles: ["hr", "admin"],
  },
  {
    id: "recruiter",
    label: "Recruiter",
    hint: "Search talent & schedule interviews",
    expectedRoles: ["company", "hr"],
  },
  {
    id: "company_hr",
    label: "Company HR",
    hint: "Drives, candidates & offers",
    expectedRoles: ["company", "hr"],
  },
  {
    id: "super_admin",
    label: "Super Admin",
    hint: "Full platform administration",
    expectedRoles: ["super_admin"],
  },
];

export const LOGIN_ROLE_STORAGE_KEY = "gradlogic.lastLoginRole";

export function readStoredLoginRole(): LoginRoleId {
  const raw = localStorage.getItem(LOGIN_ROLE_STORAGE_KEY);
  if (LOGIN_ROLES.some((r) => r.id === raw)) return raw as LoginRoleId;
  return "student";
}

export function storeLoginRole(id: LoginRoleId) {
  localStorage.setItem(LOGIN_ROLE_STORAGE_KEY, id);
}

/** Dummy hooks for future OAuth / OTP / magic-link connectivity. */
export const authProvidersApi = {
  async startOAuth(provider: "google" | "microsoft" | "linkedin" | "apple") {
    return { ok: false as const, provider, message: `${provider} sign-in is not configured yet.` };
  },
  async requestOtp(_email: string) {
    return { ok: false as const, message: "OTP login will be available soon." };
  },
  async requestMagicLink(_email: string) {
    return { ok: false as const, message: "Magic link login will be available soon." };
  },
};
