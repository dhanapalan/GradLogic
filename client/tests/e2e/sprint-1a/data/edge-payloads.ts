/**
 * Edge-case payloads for Sprint 1A business negative / boundary tests.
 * Does not alter framework architecture — data only.
 */
import { buildCollege, buildStudent, type CollegePayload, type StudentPayload } from "./factories";

export const MAX_NAME = "A".repeat(255);
export const MIN_NAME = "A";
export const TAMIL_NAME = "அண்ணா பல்கலைக்கழகம்";
export const UNICODE_NAME = "École Polytechnique — 清华大学";
export const EMOJI_NAME = "Grad College 🎓✨";
export const LARGE_ADDRESS = ("Block A, Cross Street, Ward 12, Landmark near metro, ").repeat(40);

export function collegeValid(overrides: Partial<CollegePayload> = {}): CollegePayload {
  return buildCollege(overrides);
}

export function collegeBlankMandatory(): CollegePayload {
  return {
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    tpoName: "",
    tpoEmail: "",
    studentLimit: 100,
  };
}

export function collegeOnlySpaces(): CollegePayload {
  return {
    name: "   ",
    email: "   ",
    phone: "   ",
    address: "   ",
    city: "   ",
    state: "   ",
    tpoName: "   ",
    tpoEmail: "   ",
    studentLimit: 100,
  };
}

export function collegeInvalidEmail(base?: CollegePayload): CollegePayload {
  return collegeValid({ ...base, email: "not-an-email", tpoEmail: "also-bad@" });
}

export function collegeInvalidPhone(base?: CollegePayload): CollegePayload {
  return collegeValid({ ...base, phone: "123" });
}

export function collegeLeadingTrailingSpaces(): CollegePayload {
  const c = collegeValid();
  return {
    ...c,
    name: `  ${c.name}  `,
    city: `  ${c.city}  `,
    tpoName: `  ${c.tpoName}  `,
  };
}

export function studentValid(overrides: Partial<StudentPayload> = {}): StudentPayload {
  return buildStudent(overrides);
}

export const FUTURE_DOB = "2099-01-01";
export const INVALID_DOB = "not-a-date";
export const UNDERAGE_DOB = new Date().toISOString().slice(0, 10); // today — typically underage for college
