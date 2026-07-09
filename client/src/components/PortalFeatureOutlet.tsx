import { Outlet, useLocation } from "react-router-dom";
import { FeatureGuard } from "./FeatureGuard";
import { ModuleGuard } from "./ModuleGuard";
import {
  COLLEGE_NAV_FEATURE_MAP,
  STUDENT_ROUTE_FEATURE_RULES,
  extractLmsModuleKey,
  type PlatformFeatureKey,
} from "../constants/platformFeatures";

const COLLEGE_PORTAL_BASE = "/app/college-portal";
const STUDENT_PORTAL_BASE = "/app/student-portal";

function collegeSegmentFeature(pathname: string): PlatformFeatureKey | null {
  if (!pathname.startsWith(COLLEGE_PORTAL_BASE)) return null;
  const rest = pathname.slice(COLLEGE_PORTAL_BASE.length).replace(/^\//, "");
  const segment = rest.split("/")[0] || "dashboard";
  if (segment === "lms") return null;
  return COLLEGE_NAV_FEATURE_MAP[segment] ?? null;
}

function studentPathFeature(pathname: string): PlatformFeatureKey | null {
  if (!pathname.startsWith(STUDENT_PORTAL_BASE)) return null;
  let rest = pathname.slice(STUDENT_PORTAL_BASE.length).replace(/^\//, "");
  if (!rest) return null;
  if (rest.startsWith("lms/")) return null;

  for (const rule of STUDENT_ROUTE_FEATURE_RULES) {
    if (rule.prefix === "") continue;
    if (rest === rule.prefix || rest.startsWith(`${rule.prefix}/`)) {
      return rule.feature;
    }
  }
  return null;
}

interface PortalFeatureOutletProps {
  portal: "college" | "student";
}

/**
 * Wraps nested portal routes and enforces module-based feature access
 * from the current URL (pairs with sidebar filtering in layouts).
 */
export function PortalFeatureOutlet({ portal }: PortalFeatureOutletProps) {
  const { pathname } = useLocation();
  const lmsModuleKey = extractLmsModuleKey(pathname, portal);

  if (lmsModuleKey) {
    return (
      <ModuleGuard moduleKey={lmsModuleKey} portal={portal}>
        <Outlet />
      </ModuleGuard>
    );
  }

  const feature =
    portal === "college"
      ? collegeSegmentFeature(pathname)
      : studentPathFeature(pathname);

  return (
    <FeatureGuard portal={portal} feature={feature}>
      <Outlet />
    </FeatureGuard>
  );
}
