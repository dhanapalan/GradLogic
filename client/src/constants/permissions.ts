/**
 * Client mirror of the server RBAC permission catalog.
 * Keep in sync with server/src/constants/permissions.ts.
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

/** Group the catalog by category for matrix / settings UIs. */
export function permissionsByCategory(): Record<string, PermissionMeta[]> {
  return PERMISSION_CATALOG.reduce<Record<string, PermissionMeta[]>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});
}
