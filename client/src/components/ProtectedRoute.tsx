import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore, type AuthUser } from "../stores/authStore";

// ── Canonical role type (matches server UserRole) ────────────────────────────

export type AppRole =
  | "super_admin"
  | "admin"
  | "hr"
  | "engineer"
  | "cxo"
  | "college_admin"
  | "college"
  | "college_staff"
  | "student"
  | "instructor"
  | "mentor"
  | "company"
  | "placement_cell";

export type AppWorkflow = "admin" | "college" | "student" | "neutral";

// Legacy roles map to their canonical equivalents
const ROLE_ALIASES: Record<string, AppRole> = {
  admin: "super_admin",
  college: "college_admin",
};

/** Resolve a possibly-legacy role to a canonical one. */
export function resolveRole(raw: string): AppRole {
  const normalized = raw.toLowerCase();
  return (ROLE_ALIASES[normalized] ?? normalized) as AppRole;
}

const ADMIN_WORKFLOW_ROLES: AppRole[] = [
  "super_admin",
  "admin",
  "hr",
  "engineer",
  "cxo",
];

const COLLEGE_WORKFLOW_ROLES: AppRole[] = [
  "college_admin",
  "college",
  "college_staff",
  "placement_cell",
];

const STUDENT_WORKFLOW_ROLES: AppRole[] = ["student"];

function getCurrentWorkflow(hostname: string): AppWorkflow {
  const host = hostname.toLowerCase();
  if (host === "admin" || host.startsWith("admin.")) return "admin";
  if (host === "college" || host.startsWith("college.")) return "college";
  if (host === "student" || host.startsWith("student.")) return "student";
  return "neutral";
}

function getWorkflowForRole(role: AppRole): AppWorkflow {
  if (ADMIN_WORKFLOW_ROLES.includes(role)) return "admin";
  if (COLLEGE_WORKFLOW_ROLES.includes(role)) return "college";
  if (STUDENT_WORKFLOW_ROLES.includes(role)) return "student";
  return "neutral";
}

function inferWorkflowOrigin(targetWorkflow: "admin" | "college" | "student"): string | null {
  const current = new URL(window.location.origin);
  const host = current.hostname.toLowerCase();
  const protocol = current.protocol;
  const port = current.port ? `:${current.port}` : "";

  if (host.startsWith("admin.") || host.startsWith("college.") || host.startsWith("student.")) {
    const rest = host.split(".").slice(1).join(".");
    if (rest) {
      return `${protocol}//${targetWorkflow}.${rest}${port}`;
    }
  }

  return null;
}

function getConfiguredWorkflowOrigin(workflow: "admin" | "college" | "student"): string | null {
  const key =
    workflow === "admin"
      ? import.meta.env.VITE_ADMIN_APP_URL
      : workflow === "college"
        ? import.meta.env.VITE_COLLEGE_APP_URL
        : import.meta.env.VITE_STUDENT_APP_URL;
  const value = (typeof key === "string" ? key.trim() : "") || "";
  return value || null;
}

export function getWorkflowRedirectUrl(
  user: AuthUser | null,
  path: string = "/",
): string | null {
  if (!user || typeof window === "undefined") {
    return null;
  }

  const effectiveRole = resolveRole(user.role);
  const desiredWorkflow = getWorkflowForRole(effectiveRole);
  const currentWorkflow = getCurrentWorkflow(window.location.hostname);

  if (
    currentWorkflow === "neutral" ||
    desiredWorkflow === "neutral" ||
    currentWorkflow === desiredWorkflow
  ) {
    return null;
  }

  const targetOrigin =
    getConfiguredWorkflowOrigin(desiredWorkflow) ??
    inferWorkflowOrigin(desiredWorkflow);

  if (!targetOrigin) {
    return null;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${targetOrigin}${normalizedPath}`;
}

function WorkflowRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}

/** Default landing path per role after login. */
export const ROLE_HOME: Record<AppRole, string> = {
  super_admin: "/app/superadmin/dashboard",
  admin: "/app/superadmin/dashboard",
  hr: "/app/hr-dashboard",
  engineer: "/app/engineer-panel",
  cxo: "/app/cxo-analytics",
  college_admin: "/app/college-portal/dashboard",
  college: "/app/college-portal/dashboard",
  college_staff: "/app/college-portal/dashboard",
  student: "/app/student-portal",
  instructor: "/app/faculty-dashboard",
  mentor: "/app/mentor/students",
  // No active portal for the company role — the standalone recruiter/company
  // portal was retired; fall back to the public site root.
  company: "/",
  placement_cell: "/app/placement-cell-dashboard",
};

/** Get the correct landing path for a user. */
export function getLandingPath(user: AuthUser | null): string {
  if (!user) return "/auth/login";

  // Forced password change takes precedence
  if (user.must_change_password) {
    return "/auth/setup-password";
  }

  // Students must complete onboarding first
  if (
    resolveRole(user.role) === "student" &&
    user.is_profile_complete === false
  ) {
    return "/student-onboarding";
  }

  return ROLE_HOME[resolveRole(user.role)] ?? "/";
}

// ─────────────────────────────────────────────────────────────────────────────
// ProtectedRoute — requires authentication
// ─────────────────────────────────────────────────────────────────────────────

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  const redirectToWorkflow = getWorkflowRedirectUrl(
    user,
    `${location.pathname}${location.search}${location.hash}`,
  );
  if (redirectToWorkflow) {
    return <WorkflowRedirect to={redirectToWorkflow} />;
  }

  // Password change gate
  if (user?.must_change_password && location.pathname !== "/auth/setup-password") {
    return <Navigate to="/auth/setup-password" replace />;
  }

  // Student onboarding gate
  if (location.pathname === "/student-onboarding" && resolveRole(user?.role ?? "") !== "student") {
    return <Navigate to={getLandingPath(user)} replace />;
  }

  if (
    resolveRole(user?.role ?? "") === "student" &&
    user?.is_profile_complete === false &&
    location.pathname !== "/student-onboarding"
  ) {
    return <Navigate to="/student-onboarding" replace />;
  }

  if (
    resolveRole(user?.role ?? "") === "student" &&
    user?.is_profile_complete === true &&
    location.pathname === "/student-onboarding"
  ) {
    return <Navigate to="/app/student-portal" replace />;
  }

  return <>{children}</>;
}

// ─────────────────────────────────────────────────────────────────────────────
// RoleGuard — restricts a route to a set of allowed roles
// ─────────────────────────────────────────────────────────────────────────────

interface RoleGuardProps {
  /** Canonical roles allowed to render this route. */
  allowed: AppRole[];
  children: React.ReactNode;
}

/**
 * Wraps child routes and redirects to /not-authorized if the user's role
 * (after alias resolution) is not in the `allowed` list.
 */
export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  const effective = resolveRole(user.role);

  if (!allowed.includes(effective)) {
    return <Navigate to="/not-authorized" replace />;
  }

  return <>{children}</>;
}
