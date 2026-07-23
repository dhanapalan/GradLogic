/**
 * College-scoped departments — per-college configurable department list,
 * replacing the free-text/hardcoded department field on student records.
 */
import { query, queryOne } from "../config/database.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";

export interface DepartmentRow {
  id: string;
  college_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

let schemaReady = false;

export async function ensureDepartmentsSchema(): Promise<void> {
  if (schemaReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS college_departments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      college_id UUID NOT NULL REFERENCES colleges(id),
      name VARCHAR(150) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await query(`
    CREATE UNIQUE INDEX IF NOT EXISTS college_departments_name_unique
      ON college_departments (college_id, LOWER(name))
  `).catch(() => {});
  schemaReady = true;
}

export async function listDepartments(
  collegeId: string,
  includeInactive = false
): Promise<DepartmentRow[]> {
  await ensureDepartmentsSchema();
  const where = includeInactive
    ? `WHERE college_id = $1`
    : `WHERE college_id = $1 AND is_active = TRUE`;
  return query<DepartmentRow>(
    `SELECT id, college_id, name, is_active, created_at::text, updated_at::text
     FROM college_departments
     ${where}
     ORDER BY name ASC`,
    [collegeId]
  );
}

export async function createDepartment(
  collegeId: string,
  name: string,
  actor: { id: string; role: string; ip?: string }
): Promise<DepartmentRow> {
  await ensureDepartmentsSchema();
  const trimmed = name.trim();
  if (!trimmed) throw new AppError("Department name is required.", 400);
  if (trimmed.length > 150) throw new AppError("Department name is too long.", 400);

  const dup = await queryOne<{ id: string }>(
    `SELECT id FROM college_departments WHERE college_id = $1 AND LOWER(name) = LOWER($2)`,
    [collegeId, trimmed]
  );
  if (dup) throw new AppError("A department with this name already exists.", 409);

  const row = await queryOne<DepartmentRow>(
    `INSERT INTO college_departments (college_id, name)
     VALUES ($1, $2)
     RETURNING id, college_id, name, is_active, created_at::text, updated_at::text`,
    [collegeId, trimmed]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "DEPARTMENT_CREATED",
    target_type: "department",
    target_id: row!.id,
    reason: `Department "${trimmed}" created`,
    metadata: { college_id: collegeId },
    ip_address: actor.ip,
  }).catch(() => {});

  return row!;
}

export async function updateDepartment(
  collegeId: string,
  id: string,
  updates: { name?: string; is_active?: boolean },
  actor: { id: string; role: string; ip?: string }
): Promise<DepartmentRow> {
  await ensureDepartmentsSchema();
  const existing = await queryOne<DepartmentRow>(
    `SELECT id, college_id, name, is_active, created_at::text, updated_at::text
     FROM college_departments WHERE id = $1 AND college_id = $2`,
    [id, collegeId]
  );
  if (!existing) throw new AppError("Department not found.", 404);

  const name = updates.name != null ? updates.name.trim() : existing.name;
  if (!name) throw new AppError("Department name is required.", 400);
  if (name.length > 150) throw new AppError("Department name is too long.", 400);
  const is_active = updates.is_active != null ? updates.is_active : existing.is_active;

  if (name.toLowerCase() !== existing.name.toLowerCase()) {
    const dup = await queryOne<{ id: string }>(
      `SELECT id FROM college_departments
       WHERE college_id = $1 AND LOWER(name) = LOWER($2) AND id <> $3`,
      [collegeId, name, id]
    );
    if (dup) throw new AppError("A department with this name already exists.", 409);
  }

  const row = await queryOne<DepartmentRow>(
    `UPDATE college_departments
     SET name = $1, is_active = $2, updated_at = NOW()
     WHERE id = $3 AND college_id = $4
     RETURNING id, college_id, name, is_active, created_at::text, updated_at::text`,
    [name, is_active, id, collegeId]
  );

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "DEPARTMENT_UPDATED",
    target_type: "department",
    target_id: id,
    reason: "Department updated",
    metadata: { college_id: collegeId, from: existing.name, to: name, is_active },
    ip_address: actor.ip,
  }).catch(() => {});

  return row!;
}
