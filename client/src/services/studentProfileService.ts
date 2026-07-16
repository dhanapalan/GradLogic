/**
 * Student Portal Module 03 — My Profile API integrations.
 */
import api from "../lib/api";

export type FieldMeta = { key: string; editable: boolean; approval_required: boolean };

export type ProfileCompletion = {
  percentage: number;
  completed: number;
  total: number;
  is_profile_complete: boolean;
  missing: string[];
  fields: Record<string, boolean>;
  sections?: Array<{ id: string; label: string; complete: boolean; href: string }>;
  missing_links?: Array<{ field: string; section: string }>;
};

export type StudentProfile = Record<string, unknown> & {
  id: string;
  name: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  gender?: string | null;
  dob?: string | null;
  blood_group?: string | null;
  phone_number?: string | null;
  alternate_phone?: string | null;
  alternate_email?: string | null;
  institutional_email?: string | null;
  nationality?: string | null;
  category?: string | null;
  student_identifier?: string | null;
  register_number?: string | null;
  roll_number?: string | null;
  degree?: string | null;
  specialization?: string | null;
  class_name?: string | null;
  section?: string | null;
  passing_year?: number | null;
  admission_year?: number | null;
  cgpa?: number | null;
  percentage?: number | null;
  academic_advisor?: string | null;
  academic_status?: string | null;
  current_backlogs?: number | null;
  college_name?: string | null;
  profile_photo_url?: string | null;
  resume_url?: string | null;
  readiness_score?: number | null;
  readiness_level?: string | null;
  profile_completion?: ProfileCompletion;
  field_metadata?: { fields: FieldMeta[] };
  last_updated?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  kaggle_url?: string | null;
  hackerrank_url?: string | null;
  leetcode_url?: string | null;
  codechef_url?: string | null;
  other_links?: string | null;
  career_goals?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  emergency_name?: string | null;
  emergency_relationship?: string | null;
  emergency_phone?: string | null;
};

export type ProfileSkill = {
  id?: string;
  category: string;
  name: string;
  proficiency: string;
  years_experience?: number | null;
};

export type ProfileCertification = {
  id: string;
  name: string;
  provider: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  credential_id: string | null;
  verification_url: string | null;
  certificate_url: string | null;
};

export type ProfileProject = {
  id: string;
  name: string;
  description: string | null;
  technologies: string[] | null;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  github_url: string | null;
  live_url: string | null;
  document_url: string | null;
};

export type ProfileExperience = {
  id: string;
  experience_type: string;
  organization: string;
  role: string | null;
  start_date: string | null;
  end_date: string | null;
  responsibilities: string | null;
  technologies: string[] | null;
  certificate_url: string | null;
};

export type ProfilePreferences = {
  preferred_roles?: string[];
  preferred_industries?: string[];
  preferred_locations?: string[];
  expected_salary?: string | null;
  willing_to_relocate?: boolean;
  higher_studies_interest?: boolean;
  government_jobs_interest?: boolean;
  entrepreneurship_interest?: boolean;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  push_notifications?: boolean;
  placement_visibility?: boolean;
  resume_visibility?: boolean;
  profile_visibility?: boolean;
  marketing_preferences?: boolean;
};

export type ProfileDocument = {
  id: string;
  doc_type: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  storage_url: string;
  created_at: string;
};

export const SKILL_CATEGORIES = [
  { id: "programming_languages", label: "Programming Languages" },
  { id: "frameworks", label: "Frameworks" },
  { id: "databases", label: "Databases" },
  { id: "cloud_platforms", label: "Cloud Platforms" },
  { id: "devops_tools", label: "DevOps Tools" },
  { id: "testing_tools", label: "Testing Tools" },
  { id: "ai_ml", label: "AI/ML Skills" },
  { id: "soft_skills", label: "Soft Skills" },
  { id: "spoken_languages", label: "Spoken Languages" },
  { id: "other", label: "Other" },
] as const;

export const DOC_TYPES = [
  { id: "aadhaar", label: "Aadhaar" },
  { id: "pan", label: "PAN" },
  { id: "passport", label: "Passport" },
  { id: "driving_license", label: "Driving License" },
  { id: "community_certificate", label: "Community Certificate" },
  { id: "transfer_certificate", label: "Transfer Certificate" },
  { id: "marksheet", label: "Mark Sheet" },
  { id: "degree_certificate", label: "Degree Certificate" },
  { id: "other", label: "Other" },
] as const;

const studentProfileService = {
  getProfile: async () => {
    const { data } = await api.get("/students/profile");
    return data.data as StudentProfile;
  },

  getCompletion: async () => {
    const { data } = await api.get("/students/profile-completion");
    return data.data as ProfileCompletion;
  },

  saveProfile: async (body: Record<string, unknown>) => {
    const { data } = await api.put("/students/profile", body);
    return data.data as StudentProfile;
  },

  uploadPhoto: async (file: File) => {
    const fd = new FormData();
    fd.append("profile_photo", file);
    const { data } = await api.post("/students/photo", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  deletePhoto: async () => {
    await api.delete("/students/photo");
  },

  uploadResume: async (file: File) => {
    const fd = new FormData();
    fd.append("resume", file);
    const { data } = await api.post("/students/resume", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  getResume: async () => {
    const { data } = await api.get("/students/resume");
    return data.data as { url: string; uploaded_at: string; file_size: number | null; version: number } | null;
  },

  deleteResume: async () => {
    await api.delete("/students/resume");
  },

  getSkills: async () => {
    const { data } = await api.get("/students/skills");
    return data.data as ProfileSkill[];
  },

  saveSkills: async (skills: ProfileSkill[]) => {
    const { data } = await api.put("/students/skills", { skills });
    return data.data as ProfileSkill[];
  },

  getCertifications: async () => {
    const { data } = await api.get("/students/certifications");
    return data.data as ProfileCertification[];
  },

  createCertification: async (body: Record<string, unknown>, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v != null && v !== "") fd.append(k, String(v));
    });
    if (file) fd.append("certificate", file);
    const { data } = await api.post("/students/certifications", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileCertification;
  },

  updateCertification: async (id: string, body: Record<string, unknown>, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (v != null && v !== "") fd.append(k, String(v));
    });
    if (file) fd.append("certificate", file);
    const { data } = await api.put(`/students/certifications/${id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileCertification;
  },

  deleteCertification: async (id: string) => {
    await api.delete(`/students/certifications/${id}`);
  },

  getProjects: async () => {
    const { data } = await api.get("/students/projects");
    return data.data as ProfileProject[];
  },

  createProject: async (body: Record<string, unknown>, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (Array.isArray(v)) fd.append(k, v.join(","));
      else if (v != null && v !== "") fd.append(k, String(v));
    });
    if (file) fd.append("document", file);
    const { data } = await api.post("/students/projects", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileProject;
  },

  updateProject: async (id: string, body: Record<string, unknown>, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (Array.isArray(v)) fd.append(k, v.join(","));
      else if (v != null && v !== "") fd.append(k, String(v));
    });
    if (file) fd.append("document", file);
    const { data } = await api.put(`/students/projects/${id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileProject;
  },

  deleteProject: async (id: string) => {
    await api.delete(`/students/projects/${id}`);
  },

  getExperience: async () => {
    const { data } = await api.get("/students/experience");
    return data.data as ProfileExperience[];
  },

  createExperience: async (body: Record<string, unknown>, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (Array.isArray(v)) fd.append(k, v.join(","));
      else if (v != null && v !== "") fd.append(k, String(v));
    });
    if (file) fd.append("certificate", file);
    const { data } = await api.post("/students/experience", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileExperience;
  },

  updateExperience: async (id: string, body: Record<string, unknown>, file?: File) => {
    const fd = new FormData();
    Object.entries(body).forEach(([k, v]) => {
      if (Array.isArray(v)) fd.append(k, v.join(","));
      else if (v != null && v !== "") fd.append(k, String(v));
    });
    if (file) fd.append("certificate", file);
    const { data } = await api.put(`/students/experience/${id}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileExperience;
  },

  deleteExperience: async (id: string) => {
    await api.delete(`/students/experience/${id}`);
  },

  getPreferences: async () => {
    const { data } = await api.get("/students/preferences");
    return data.data as ProfilePreferences;
  },

  savePreferences: async (body: ProfilePreferences) => {
    const { data } = await api.put("/students/preferences", body);
    return data.data as ProfilePreferences;
  },

  getDocuments: async () => {
    const { data } = await api.get("/students/documents");
    return data.data as ProfileDocument[];
  },

  uploadDocument: async (docType: string, file: File) => {
    const fd = new FormData();
    fd.append("doc_type", docType);
    fd.append("file", file);
    const { data } = await api.post("/students/documents", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as ProfileDocument;
  },

  deleteDocument: async (id: string) => {
    await api.delete(`/students/documents/${id}`);
  },
};

export default studentProfileService;
