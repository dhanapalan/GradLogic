import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { FeatureGuard } from "./FeatureGuard";
import { resolveCollegeLegacyRouteFeature } from "../constants/platformFeatures";

/**
 * Guards legacy /app/* routes (DashboardLayout) that college roles can reach.
 * Routes not in the legacy map pass through unchanged.
 */
export function CollegeLegacyFeatureGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const feature = resolveCollegeLegacyRouteFeature(pathname);

  return (
    <FeatureGuard portal="college" feature={feature}>
      {children}
    </FeatureGuard>
  );
}
