/**
 * Ensure Postgres user_role enum includes all roles the app uses.
 * Safe to call repeatedly (checks pg_enum before ADD VALUE).
 */
import { query } from "../config/database.js";

const REQUIRED_ROLES = [
  "instructor",
  "mentor",
  "company",
  "placement_cell",
  "super_admin",
  "college_admin",
  "college_staff",
] as const;

let ensured = false;

export async function ensureUserRoleEnum(): Promise<void> {
  if (ensured) return;
  for (const role of REQUIRED_ROLES) {
    await query(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_type t
           JOIN pg_enum e ON e.enumtypid = t.oid
           WHERE t.typname = 'user_role' AND e.enumlabel = '${role}'
         ) THEN
           ALTER TYPE user_role ADD VALUE '${role}';
         END IF;
       END $$;`
    );
  }
  ensured = true;
}

/** Roles accepted by list/create user APIs (must match user_role enum). */
export const USER_ROLE_FILTERS = [
  "admin",
  "super_admin",
  "college",
  "college_admin",
  "college_staff",
  "student",
  "hr",
  "cxo",
  "engineer",
  "instructor",
  "mentor",
  "company",
  "placement_cell",
] as const;

export type UserRoleFilter = (typeof USER_ROLE_FILTERS)[number];

export function isValidUserRoleFilter(role: string): role is UserRoleFilter {
  return (USER_ROLE_FILTERS as readonly string[]).includes(role);
}
