import { query } from "../config/database.js";
import { logger } from "../config/logger.js";

/**
 * Unified audit helper writing to the `audit_logs` table — the same table the
 * SuperAdmin "Audit Trail" UI reads (see auditTrail.controller.ts).
 *
 * Use this for admin/security events that should be visible in that UI
 * (logins, password resets, role changes, user CRUD, permission edits).
 * Never throws — audit failures must not break the request path.
 */
export interface AdminAuditInput {
  userId?: string | null;         // actor
  action: string;                 // e.g. LOGIN_SUCCESS, RESET_PASSWORD, UPDATE_ROLE_PERMISSIONS
  resourceType?: string | null;   // "user" | "role" | "session" | ...
  resourceId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function recordAuditEvent(input: AdminAuditInput): Promise<void> {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, changes, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        input.userId ?? null,
        input.action,
        input.resourceType ?? null,
        input.resourceId ?? null,
        input.changes ? JSON.stringify(input.changes) : null,
        input.ipAddress ?? null,
      ]
    );
  } catch (err) {
    logger.error("Admin audit write failed:", err);
  }
}
