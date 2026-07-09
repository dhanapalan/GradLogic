import { query } from "../config/database.js";
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  canonicalRole,
  type Permission,
} from "../constants/permissions.js";

/**
 * Resolves the effective permission set for a role.
 *
 * Strategy:
 *  1. Prefer DB grants (roles → role_permissions → permissions) so the
 *     Permission Matrix UI is authoritative and changes take effect live.
 *  2. Fall back to the code-defined DEFAULT_ROLE_PERMISSIONS when the DB has
 *     no grants for the role (fresh DB, migration not applied, etc.).
 *  3. super_admin always gets every permission.
 *
 * Results are cached in-process for a short TTL to avoid a DB round-trip on
 * every authorized request. Call `invalidateRbacCache()` after editing grants.
 */

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { perms: Set<Permission>; expires: number }>();

export function invalidateRbacCache(): void {
  cache.clear();
}

async function loadPermissionsFromDb(roleName: string): Promise<Permission[]> {
  const rows = await query<{ name: string }>(
    `SELECT p.name
     FROM roles r
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE r.name = $1 AND r.deleted_at IS NULL AND p.deleted_at IS NULL`,
    [roleName]
  );
  return rows.map((r) => r.name as Permission);
}

export async function getPermissionsForRole(role: string): Promise<Permission[]> {
  const canonical = canonicalRole(role);

  if (canonical === "super_admin") {
    return [...ALL_PERMISSIONS];
  }

  const cached = cache.get(canonical);
  if (cached && cached.expires > Date.now()) {
    return [...cached.perms];
  }

  let perms: Permission[] = [];
  try {
    perms = await loadPermissionsFromDb(canonical);
  } catch {
    perms = [];
  }

  // Fallback to code defaults when the DB has nothing for this role.
  if (perms.length === 0) {
    perms = DEFAULT_ROLE_PERMISSIONS[canonical] ?? [];
  }

  cache.set(canonical, { perms: new Set(perms), expires: Date.now() + CACHE_TTL_MS });
  return perms;
}

export async function roleHasPermission(role: string, permission: Permission): Promise<boolean> {
  if (canonicalRole(role) === "super_admin") return true;
  const perms = await getPermissionsForRole(role);
  return perms.includes(permission);
}

/** True if the role has ALL of the given permissions. */
export async function roleHasAllPermissions(
  role: string,
  permissions: Permission[]
): Promise<boolean> {
  if (canonicalRole(role) === "super_admin") return true;
  const perms = new Set(await getPermissionsForRole(role));
  return permissions.every((p) => perms.has(p));
}

/** True if the role has ANY of the given permissions. */
export async function roleHasAnyPermission(
  role: string,
  permissions: Permission[]
): Promise<boolean> {
  if (canonicalRole(role) === "super_admin") return true;
  const perms = new Set(await getPermissionsForRole(role));
  return permissions.some((p) => perms.has(p));
}
