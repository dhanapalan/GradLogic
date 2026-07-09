import { Navigate } from "react-router-dom";
import { usePermissions } from "../hooks/usePermissions";
import type { Permission } from "../constants/permissions";

interface PermissionGuardProps {
  /** Permission(s) required to view the route/section. */
  permission: Permission | Permission[];
  /** If true, having ANY of the permissions is enough (default: ALL). */
  mode?: "all" | "any";
  children: React.ReactNode;
  /**
   * When used to gate a whole route, redirect to /not-authorized on failure.
   * When used inline (e.g. to hide a button), pass `fallback={null}` instead.
   */
  redirect?: boolean;
  fallback?: React.ReactNode;
}

/**
 * Route/section guard driven by RBAC permissions.
 *
 * Route usage:   <PermissionGuard permission="users_view" redirect><Page/></PermissionGuard>
 * Inline usage:  <PermissionGuard permission="users_manage" fallback={null}><Button/></PermissionGuard>
 */
export function PermissionGuard({
  permission,
  mode = "all",
  children,
  redirect = false,
  fallback = null,
}: PermissionGuardProps) {
  const { hasAll, hasAny } = usePermissions();
  const perms = Array.isArray(permission) ? permission : [permission];
  const allowed = mode === "any" ? hasAny(...perms) : hasAll(...perms);

  if (allowed) return <>{children}</>;
  if (redirect) return <Navigate to="/not-authorized" replace />;
  return <>{fallback}</>;
}
