import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FeatureGuard } from "./FeatureGuard";
import { resolveCollegeLegacyRouteFeature } from "../constants/platformFeatures";
import { resolveRole } from "./ProtectedRoute";
import { useAuthStore } from "../stores/authStore";

const COLLEGE_ROLES = new Set(["college_admin", "college", "college_staff"]);

/**
 * Legacy /app/students routes that now have a real equivalent inside the new
 * Campus Portal shell. College-role users are redirected there instead of
 * seeing the old DashboardLayout nav; other roles (hr, cxo, super_admin) have
 * no Campus Portal and keep using these pages unchanged.
 */
const STUDENT_ROUTE_REDIRECTS: { match: RegExp; to: (pathname: string) => string }[] = [
  { match: /^\/app\/students\/[^/]+\/edit$/, to: (p) => p.replace(/^\/app\/students\/([^/]+)\/edit$/, "/app/college-portal/students/$1") },
  { match: /^\/app\/students\/[^/]+$/, to: (p) => p.replace(/^\/app\/students\//, "/app/college-portal/students/") },
  { match: /^\/app\/students$/, to: () => "/app/college-portal/students" },
];

/**
 * Guards legacy /app/* routes (DashboardLayout) that college roles can reach.
 * Routes not in the legacy map pass through unchanged.
 */
export function CollegeLegacyFeatureGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const user = useAuthStore((s) => s.user);
  const role = resolveRole(user?.role ?? "");
  const feature = resolveCollegeLegacyRouteFeature(pathname);

  if (COLLEGE_ROLES.has(role)) {
    // "new" / "bulk-import" have no in-shell equivalent yet — leave those on
    // the legacy page rather than redirect into a dead end.
    const redirect = STUDENT_ROUTE_REDIRECTS.find((r) => r.match.test(pathname));
    if (redirect) {
      return <Navigate to={redirect.to(pathname)} replace />;
    }
  }

  return (
    <FeatureGuard portal="college" feature={feature}>
      {children}
    </FeatureGuard>
  );
}
