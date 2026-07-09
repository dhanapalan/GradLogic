import { useCallback } from "react";
import { useAuthStore } from "../stores/authStore";
import { resolveRole } from "../components/ProtectedRoute";
import type { Permission } from "../constants/permissions";

/**
 * RBAC hook for the client. Reads the permission set resolved by the server
 * at login (stored in the auth store) and exposes convenience checks.
 *
 * super_admin always passes every check (defensive: matches the server).
 */
export function usePermissions() {
  const permissions = useAuthStore((s) => s.permissions);
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user ? resolveRole(user.role) === "super_admin" : false;

  const has = useCallback(
    (permission: Permission): boolean => isSuperAdmin || permissions.includes(permission),
    [permissions, isSuperAdmin]
  );

  const hasAll = useCallback(
    (...perms: Permission[]): boolean => isSuperAdmin || perms.every((p) => permissions.includes(p)),
    [permissions, isSuperAdmin]
  );

  const hasAny = useCallback(
    (...perms: Permission[]): boolean => isSuperAdmin || perms.some((p) => permissions.includes(p)),
    [permissions, isSuperAdmin]
  );

  return { permissions, has, hasAll, hasAny, isSuperAdmin };
}
