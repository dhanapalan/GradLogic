import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { usePortalFeatures } from "../hooks/usePortalFeatures";
import { useAuthStore } from "../stores/authStore";
import { resolveRole } from "./ProtectedRoute";
import type { PlatformFeatureKey } from "../constants/platformFeatures";

const COLLEGE_ROLES = new Set(["college_admin", "college", "college_staff"]);

interface FeatureGuardProps {
  portal: "college" | "student";
  /** null = always allowed (dashboard, profile, etc.) */
  feature: PlatformFeatureKey | null;
  children: ReactNode;
}

/**
 * Blocks direct URL access when the user's college has not been assigned this feature.
 * Super Admin / HR / other roles bypass the check.
 */
export function FeatureGuard({ portal, feature, children }: FeatureGuardProps) {
  const user = useAuthStore((s) => s.user);
  const role = resolveRole(user?.role ?? "");

  const applies =
    portal === "college" ? COLLEGE_ROLES.has(role) : role === "student";

  const { hasFeature, isLoading } = usePortalFeatures(portal);

  if (!applies || feature === null) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (!hasFeature(feature)) {
    return (
      <Navigate
        to="/not-authorized"
        replace
        state={{ reason: "feature_disabled", feature, portal }}
      />
    );
  }

  return <>{children}</>;
}

/** Shorthand for college portal routes. */
export function CollegeFeatureGuard({
  feature,
  children,
}: {
  feature: PlatformFeatureKey | null;
  children: ReactNode;
}) {
  return (
    <FeatureGuard portal="college" feature={feature}>
      {children}
    </FeatureGuard>
  );
}

/** Shorthand for student portal routes. */
export function StudentFeatureGuard({
  feature,
  children,
}: {
  feature: PlatformFeatureKey | null;
  children: ReactNode;
}) {
  return (
    <FeatureGuard portal="student" feature={feature}>
      {children}
    </FeatureGuard>
  );
}
