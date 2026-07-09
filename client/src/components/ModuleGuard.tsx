import { Navigate } from "react-router-dom";
import { usePortalFeatures } from "../hooks/usePortalFeatures";

interface ModuleGuardProps {
  moduleKey: string;
  portal: "college" | "student";
  children: React.ReactNode;
}

/** Blocks access when the LMS module group is not enabled for the college. */
export function ModuleGuard({ moduleKey, portal, children }: ModuleGuardProps) {
  const { hasModule, isLoading } = usePortalFeatures(portal);

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (!hasModule(moduleKey)) {
    return (
      <Navigate
        to="/not-authorized"
        replace
        state={{ reason: "feature_disabled", moduleKey }}
      />
    );
  }

  return <>{children}</>;
}
