import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { FeatureGuard } from "./FeatureGuard";
import { resolveCollegeLegacyRouteFeature } from "../constants/platformFeatures";
import { resolveRole } from "./ProtectedRoute";
import { useAuthStore } from "../stores/authStore";

const COLLEGE_ROLES = new Set(["college_admin", "college", "college_staff"]);

/**
 * Legacy /app/* routes that render the exact same component as a route
 * inside the new Campus Portal shell (/app/college-portal/*) — e.g.
 * /app/college/drives and /app/college-portal/drives both mount
 * CampusDrivesListPage. College-role users are redirected to the
 * college-portal URL instead of seeing the old DashboardLayout nav around
 * identical content; other roles (hr, cxo, super_admin) have no Campus
 * Portal and keep using these pages unchanged.
 *
 * Every /app/college/* page now has a college-portal equivalent — this list
 * should stay exhaustive for that prefix. If a legacy page is retired
 * without a replacement, remove its entry here rather than leaving a
 * redirect to a dead end.
 */
const LEGACY_ROUTE_REDIRECTS: { match: RegExp; to: (pathname: string) => string }[] = [
  { match: /^\/app\/students\/bulk-import$/, to: () => "/app/college-portal/students" },
  { match: /^\/app\/students\/[^/]+\/edit$/, to: (p) => p.replace(/^\/app\/students\/([^/]+)\/edit$/, "/app/college-portal/students/$1") },
  { match: /^\/app\/students\/[^/]+$/, to: (p) => p.replace(/^\/app\/students\//, "/app/college-portal/students/") },
  { match: /^\/app\/students$/, to: () => "/app/college-portal/students" },
  { match: /^\/app\/college\/drives\/[^/]+$/, to: (p) => p.replace(/^\/app\/college\/drives\//, "/app/college-portal/drives/") },
  { match: /^\/app\/college\/drives$/, to: () => "/app/college-portal/drives" },
  { match: /^\/app\/college\/settings$/, to: () => "/app/college-portal/settings" },
  { match: /^\/app\/college\/integrity$/, to: () => "/app/college-portal/integrity" },
  { match: /^\/app\/college\/results$/, to: () => "/app/college-portal/results" },
  { match: /^\/app\/college\/insights$/, to: () => "/app/college-portal/insights" },
  { match: /^\/app\/college\/communications$/, to: () => "/app/college-portal/communications" },
  { match: /^\/app\/college\/billing$/, to: () => "/app/college-portal/billing" },
  { match: /^\/app\/college\/campus-admins$/, to: () => "/app/college-portal/campus-admins" },
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
    const redirect = LEGACY_ROUTE_REDIRECTS.find((r) => r.match.test(pathname));
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
