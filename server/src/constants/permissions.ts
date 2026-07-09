/**
 * RBAC permission catalog — single source of truth for the server.
 *
 * The database (roles / permissions / role_permissions) is the *manageable*
 * source used by the Permission Matrix UI. This code map is the enforcement
 * default + resilient fallback when the DB has not been seeded yet, and it is
 * what `requirePermission` consults (via rbac.service, which prefers the DB).
 */

export type Permission =
  | "dashboard_view"
  | "users_view"
  | "users_manage"
  | "users_reset_password"
  | "users_assign_role"
  | "roles_view"
  | "roles_manage"
  | "permissions_view"
  | "permissions_manage"
  | "colleges_view"
  | "colleges_manage"
  | "modules_view"
  | "modules_manage"
  | "students_view"
  | "students_manage"
  | "assessments_view"
  | "assessments_manage"
  | "workflows_view"
  | "workflows_manage"
  | "analytics_view"
  | "audit_view"
  | "audit_export"
  | "settings_view"
  | "settings_manage"
  | "billing_view"
  | "billing_manage"
  | "notifications_view"
  | "notifications_manage";

export interface PermissionMeta {
  key: Permission;
  label: string;
  category: string;
}

export const PERMISSION_CATALOG: PermissionMeta[] = [
  { key: "dashboard_view", label: "View dashboards", category: "General" },
  { key: "users_view", label: "View users", category: "Users" },
  { key: "users_manage", label: "Create / edit / delete users", category: "Users" },
  { key: "users_reset_password", label: "Reset user passwords", category: "Users" },
  { key: "users_assign_role", label: "Assign roles to users", category: "Users" },
  { key: "roles_view", label: "View roles", category: "Roles & Permissions" },
  { key: "roles_manage", label: "Manage roles", category: "Roles & Permissions" },
  { key: "permissions_view", label: "View permission matrix", category: "Roles & Permissions" },
  { key: "permissions_manage", label: "Manage role permissions", category: "Roles & Permissions" },
  { key: "colleges_view", label: "View colleges", category: "Colleges" },
  { key: "colleges_manage", label: "Manage colleges", category: "Colleges" },
  { key: "modules_view", label: "View feature modules", category: "Modules" },
  { key: "modules_manage", label: "Manage feature modules", category: "Modules" },
  { key: "students_view", label: "View students", category: "Students" },
  { key: "students_manage", label: "Manage students", category: "Students" },
  { key: "assessments_view", label: "View assessments", category: "Assessments" },
  { key: "assessments_manage", label: "Manage assessments", category: "Assessments" },
  { key: "workflows_view", label: "View workflows", category: "Workflows" },
  { key: "workflows_manage", label: "Manage workflows", category: "Workflows" },
  { key: "analytics_view", label: "View analytics", category: "Analytics" },
  { key: "audit_view", label: "View audit trail", category: "Audit" },
  { key: "audit_export", label: "Export audit logs", category: "Audit" },
  { key: "settings_view", label: "View settings", category: "Settings" },
  { key: "settings_manage", label: "Manage settings", category: "Settings" },
  { key: "billing_view", label: "View billing", category: "Billing" },
  { key: "billing_manage", label: "Manage billing", category: "Billing" },
  { key: "notifications_view", label: "View notifications", category: "Notifications" },
  { key: "notifications_manage", label: "Send notifications", category: "Notifications" },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_CATALOG.map((p) => p.key);

const CAMPUS_PERMISSIONS: Permission[] = [
  "dashboard_view",
  "students_view",
  "students_manage",
  "assessments_view",
  "assessments_manage",
  "analytics_view",
  "modules_view",
  "settings_view",
  "notifications_view",
  "notifications_manage",
];

/**
 * Default role → permissions map (by canonical role name).
 * Used as enforcement fallback when the DB has no grants for a role.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  super_admin: [...ALL_PERMISSIONS],
  college_admin: CAMPUS_PERMISSIONS,
  college: CAMPUS_PERMISSIONS,
  college_staff: CAMPUS_PERMISSIONS.filter((p) => !p.endsWith("_manage")),
  tpo: CAMPUS_PERMISSIONS,
  hr: ["dashboard_view", "students_view", "assessments_view", "analytics_view", "colleges_view"],
  cxo: ["dashboard_view", "analytics_view", "colleges_view"],
  engineer: ["dashboard_view", "assessments_view", "assessments_manage"],
  mentor: ["dashboard_view", "students_view", "assessments_view", "analytics_view"],
  instructor: ["dashboard_view", "assessments_view"],
  company: ["dashboard_view"],
  student: ["dashboard_view"],
};

/** Legacy role names → canonical. */
export const ROLE_ALIASES: Record<string, string> = {
  admin: "super_admin",
  college: "college_admin",
};

export function canonicalRole(role: string): string {
  const normalized = role.toLowerCase();
  return ROLE_ALIASES[normalized] ?? normalized;
}
