/**
 * Phase 2 · Module 02 — College Profile
 * Master record for the caller's college (view / edit / logo).
 */
import { v4 as uuidv4 } from "uuid";
import { query, queryOne } from "../config/database.js";
import { uploadFile } from "../config/storage.js";
import { AppError } from "../middleware/errorHandler.js";
import { writeAuditLog } from "./audit.service.js";

const PROFILE_COLUMNS = `
  id, college_code, name, short_name, logo_url, university, college_type,
  email, phone, website,
  address, address_line1, address_line2, city, state, country, pin_code,
  placement_officer_name, placement_officer_email, placement_officer_mobile,
  created_at, updated_at
`;

export const COLLEGE_TYPES = [
  "Engineering",
  "Arts & Science",
  "Polytechnic",
  "Management",
  "Other",
] as const;

export type CollegeType = (typeof COLLEGE_TYPES)[number];

export interface CollegeProfileUpdate {
  name?: string;
  college_code?: string;
  short_name?: string | null;
  university?: string | null;
  college_type?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pin_code?: string | null;
  placement_officer_name?: string | null;
  placement_officer_email?: string | null;
  placement_officer_mobile?: string | null;
}

const EDIT_ROLES = new Set(["college_admin", "college", "super_admin", "admin", "hr"]);
const VIEW_ROLES = new Set([
  ...EDIT_ROLES,
  "college_staff",
  "placement_cell",
  "instructor",
]);

export function canViewCollegeProfile(role: string | undefined): boolean {
  return VIEW_ROLES.has((role || "").toLowerCase());
}

export function canEditCollegeProfile(role: string | undefined): boolean {
  const r = (role || "").toLowerCase();
  // college_staff: view-only per Module 02 (Org Admin + College Admin edit)
  return EDIT_ROLES.has(r);
}

function requireCollegeId(collegeId: string | null | undefined): string {
  if (!collegeId) {
    throw new AppError("Access denied. No college associated with this user.", 403);
  }
  return collegeId;
}

function emptyToNull(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function isValidEmail(v: string | null): boolean {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidPhone(v: string | null): boolean {
  if (!v) return true;
  const digits = v.replace(/[\s\-()+]/g, "");
  return /^\d{7,15}$/.test(digits);
}

function isValidWebsite(v: string | null): boolean {
  if (!v) return true;
  try {
    const u = new URL(v.startsWith("http") ? v : `https://${v}`);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidPin(v: string | null): boolean {
  if (!v) return true;
  return /^[A-Za-z0-9\- ]{3,12}$/.test(v);
}

export async function getCollegeProfile(collegeId: string | null | undefined) {
  const id = requireCollegeId(collegeId);
  const row = await queryOne<Record<string, unknown>>(
    `SELECT ${PROFILE_COLUMNS} FROM colleges WHERE id = $1`,
    [id]
  );
  if (!row) {
    throw new AppError("College profile not found.", 404);
  }
  return mapProfile(row);
}

function mapProfile(row: Record<string, unknown>) {
  const addressLine1 =
    (row.address_line1 as string | null) ||
    (row.address as string | null) ||
    null;
  return {
    id: row.id,
    college_code: row.college_code,
    name: row.name,
    short_name: row.short_name ?? null,
    logo_url: row.logo_url ?? null,
    university: row.university ?? null,
    college_type: row.college_type ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    address_line1: addressLine1,
    address_line2: row.address_line2 ?? null,
    city: row.city ?? null,
    state: row.state ?? null,
    country: row.country ?? "India",
    pin_code: row.pin_code ?? null,
    placement_officer_name: row.placement_officer_name ?? null,
    placement_officer_email: row.placement_officer_email ?? null,
    placement_officer_mobile: row.placement_officer_mobile ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function validateProfileUpdate(body: CollegeProfileUpdate): CollegeProfileUpdate {
  const name = body.name !== undefined ? String(body.name).trim() : undefined;
  if (name !== undefined && !name) {
    throw new AppError("College Name is required.", 400);
  }

  const college_code =
    body.college_code !== undefined ? String(body.college_code).trim() : undefined;
  if (college_code !== undefined && !college_code) {
    throw new AppError("College Code is required.", 400);
  }
  if (college_code !== undefined && !/^[A-Za-z0-9_.\-]{2,50}$/.test(college_code)) {
    throw new AppError(
      "College Code must be 2–50 characters (letters, numbers, dot, hyphen, underscore).",
      400
    );
  }

  const college_type = emptyToNull(body.college_type);
  if (
    college_type &&
    !COLLEGE_TYPES.includes(college_type as CollegeType)
  ) {
    throw new AppError(
      `College Type must be one of: ${COLLEGE_TYPES.join(", ")}.`,
      400
    );
  }

  const email = emptyToNull(body.email);
  const phone = emptyToNull(body.phone);
  let website = emptyToNull(body.website);
  const placement_officer_email = emptyToNull(body.placement_officer_email);
  const placement_officer_mobile = emptyToNull(body.placement_officer_mobile);
  const pin_code = emptyToNull(body.pin_code);

  if (!isValidEmail(email)) throw new AppError("Enter a valid college email address.", 400);
  if (!isValidEmail(placement_officer_email)) {
    throw new AppError("Enter a valid placement officer email address.", 400);
  }
  if (!isValidPhone(phone)) {
    throw new AppError("Enter a valid phone number (7–15 digits).", 400);
  }
  if (!isValidPhone(placement_officer_mobile)) {
    throw new AppError("Enter a valid placement officer mobile (7–15 digits).", 400);
  }
  if (!isValidWebsite(website)) {
    throw new AppError("Enter a valid website URL (e.g. https://college.edu).", 400);
  }
  if (website && !/^https?:\/\//i.test(website)) {
    website = `https://${website}`;
  }
  if (!isValidPin(pin_code)) {
    throw new AppError("Enter a valid PIN / postal code.", 400);
  }

  return {
    name,
    college_code,
    short_name: emptyToNull(body.short_name),
    university: emptyToNull(body.university),
    college_type,
    email,
    phone,
    website,
    address_line1: emptyToNull(body.address_line1),
    address_line2: emptyToNull(body.address_line2),
    city: emptyToNull(body.city),
    state: emptyToNull(body.state),
    country: emptyToNull(body.country) ?? "India",
    pin_code,
    placement_officer_name: emptyToNull(body.placement_officer_name),
    placement_officer_email,
    placement_officer_mobile,
  };
}

export async function updateCollegeProfile(
  collegeId: string | null | undefined,
  raw: CollegeProfileUpdate,
  actor: { id: string; role: string; ip?: string }
) {
  const id = requireCollegeId(collegeId);
  const data = validateProfileUpdate(raw);

  if (data.college_code) {
    const clash = await queryOne<{ id: string }>(
      `SELECT id FROM colleges WHERE college_code = $1 AND id <> $2 LIMIT 1`,
      [data.college_code, id]
    );
    if (clash) {
      throw new AppError("College Code must be unique. Another college already uses this code.", 409);
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  const assign = (col: string, value: unknown) => {
    if (value === undefined) return;
    sets.push(`${col} = $${i++}`);
    params.push(value);
  };

  assign("name", data.name);
  assign("college_code", data.college_code);
  assign("short_name", data.short_name);
  assign("university", data.university);
  assign("college_type", data.college_type);
  assign("email", data.email);
  assign("phone", data.phone);
  assign("website", data.website);
  assign("address_line1", data.address_line1);
  assign("address_line2", data.address_line2);
  assign("city", data.city);
  assign("state", data.state);
  assign("country", data.country);
  assign("pin_code", data.pin_code);
  assign("placement_officer_name", data.placement_officer_name);
  assign("placement_officer_email", data.placement_officer_email);
  assign("placement_officer_mobile", data.placement_officer_mobile);

  // Keep legacy address in sync for older consumers
  if (data.address_line1 !== undefined) {
    const combined = [data.address_line1, data.address_line2].filter(Boolean).join(", ");
    assign("address", combined || null);
  }

  if (sets.length === 0) {
    throw new AppError("No fields to update.", 400);
  }

  params.push(id);
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE colleges
     SET ${sets.join(", ")}, updated_at = NOW()
     WHERE id = $${i}
     RETURNING ${PROFILE_COLUMNS}`,
    params
  );

  if (!row) throw new AppError("College profile not found.", 404);

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "CAMPUS_UPDATED",
    target_type: "campus",
    target_id: id,
    reason: "College profile updated",
    metadata: { fields: sets.map((s) => s.split(" ")[0]) },
    ip_address: actor.ip,
  }).catch(() => {});

  return mapProfile(row);
}

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadCollegeLogo(
  collegeId: string | null | undefined,
  file: Express.Multer.File | undefined,
  actor: { id: string; role: string; ip?: string }
) {
  const id = requireCollegeId(collegeId);
  if (!file) throw new AppError("Logo image file is required.", 400);
  if (!IMAGE_MIME.has(file.mimetype)) {
    throw new AppError("Logo must be an image (JPEG, PNG, WebP, or GIF).", 400);
  }
  if (file.size > 2 * 1024 * 1024) {
    throw new AppError("Logo file size must be 2MB or less.", 400);
  }

  const ext = (file.originalname.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `college-logos/${id}/${uuidv4()}.${ext || "png"}`;
  const logoUrl = await uploadFile(key, file.buffer, file.mimetype);

  const row = await queryOne<Record<string, unknown>>(
    `UPDATE colleges
     SET logo_url = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING ${PROFILE_COLUMNS}`,
    [logoUrl, id]
  );
  if (!row) throw new AppError("College profile not found.", 404);

  await writeAuditLog({
    actor_id: actor.id,
    actor_role: actor.role,
    action: "CAMPUS_UPDATED",
    target_type: "campus",
    target_id: id,
    reason: "College logo uploaded",
    metadata: { logo_url: logoUrl },
    ip_address: actor.ip,
  }).catch(() => {});

  return mapProfile(row);
}

/** Ensure migration columns exist (dev safety net). */
export async function ensureCollegeProfileColumns(): Promise<void> {
  await query(`
    ALTER TABLE colleges
      ADD COLUMN IF NOT EXISTS short_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS university VARCHAR(255),
      ADD COLUMN IF NOT EXISTS college_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS website VARCHAR(255),
      ADD COLUMN IF NOT EXISTS address_line1 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS address_line2 VARCHAR(255),
      ADD COLUMN IF NOT EXISTS country VARCHAR(120) DEFAULT 'India',
      ADD COLUMN IF NOT EXISTS pin_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS placement_officer_name VARCHAR(150),
      ADD COLUMN IF NOT EXISTS placement_officer_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS placement_officer_mobile VARCHAR(30)
  `);
  // Soft constraint — ignore if already present
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_colleges_college_type'
      ) THEN
        ALTER TABLE colleges
          ADD CONSTRAINT chk_colleges_college_type
          CHECK (
            college_type IS NULL OR college_type IN (
              'Engineering',
              'Arts & Science',
              'Polytechnic',
              'Management',
              'Other'
            )
          );
      END IF;
    END $$;
  `).catch(() => {});
}
