import { z } from "zod";

/** Coerce blank / missing optional numbers to null for update payloads. */
function optionalNullableInt(opts: {
  min: number;
  max: number;
  label: string;
  whole?: boolean;
}) {
  return z.preprocess((raw) => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === "") return null;
    if (typeof raw === "string" && raw.trim() === "") return null;
    return raw;
  }, z.union([
    z.null(),
    z.coerce
      .number({ invalid_type_error: `${opts.label} must be a number` })
      .refine((n) => !Number.isNaN(n), { message: `${opts.label} must be a number` })
      .refine((n) => (opts.whole ? Number.isInteger(n) : true), {
        message: `${opts.label} must be a whole number`,
      })
      .refine((n) => n >= opts.min && n <= opts.max, {
        message: `${opts.label} must be between ${opts.min} and ${opts.max}`,
      }),
  ]).optional());
}

function optionalNullableFloat(opts: { min: number; max: number; label: string }) {
  return z.preprocess((raw) => {
    if (raw === undefined) return undefined;
    if (raw === null || raw === "") return null;
    if (typeof raw === "string" && raw.trim() === "") return null;
    return raw;
  }, z.union([
    z.null(),
    z.coerce
      .number({ invalid_type_error: `${opts.label} must be a number` })
      .refine((n) => !Number.isNaN(n), { message: `${opts.label} must be a number` })
      .refine((n) => n >= opts.min && n <= opts.max, {
        message: `${opts.label} must be between ${opts.min} and ${opts.max}`,
      }),
  ]).optional());
}

const CURRENT_YEAR = new Date().getFullYear();
/** Any plausible calendar year (not locked to 2000–2100). */
const PASSING_YEAR_MIN = 1900;
const PASSING_YEAR_MAX = CURRENT_YEAR + 20;

const passingYear = optionalNullableInt({
  min: PASSING_YEAR_MIN,
  max: PASSING_YEAR_MAX,
  label: "Passing year",
  whole: true,
});

const cgpa = optionalNullableFloat({ min: 0, max: 10, label: "CGPA" });

export const createStudentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long"),
  email: z.string().trim().email("Enter a valid email").max(255),
  college_id: z.string().uuid("Select a valid college"),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  student_identifier: z.string().trim().max(100).optional().nullable(),
  phone_number: z.string().trim().max(30).optional().nullable(),
  degree: z.string().trim().max(150).optional().nullable(),
  specialization: z.string().trim().max(150).optional().nullable(),
  passing_year: passingYear,
  cgpa,
});

export const updateStudentSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Name is too long").optional(),
  email: z.string().trim().email("Enter a valid email").max(255).optional(),
  college_id: z.string().uuid("Select a valid college").optional().nullable(),
  status: z.string().trim().max(50).optional(),
  is_active: z.boolean().optional(),
  student_identifier: z.string().trim().max(100).optional().nullable(),
  phone_number: z.string().trim().max(30).optional().nullable(),
  degree: z.string().trim().max(150).optional().nullable(),
  specialization: z.string().trim().max(150).optional().nullable(),
  passing_year: passingYear,
  cgpa,
});
