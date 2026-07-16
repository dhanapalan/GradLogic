/**
 * Student Portal Module 01 — profile / onboarding API integrations.
 */
import api from "../lib/api";

export type ProfileCompletion = {
  percentage: number;
  completed: number;
  total: number;
  is_profile_complete: boolean;
  missing: string[];
  fields: Record<string, boolean>;
};

export type StudentMe = {
  id: string;
  email: string;
  name: string;
  role: string;
  is_profile_complete?: boolean;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  dob?: string | null;
  phone_number?: string | null;
  degree?: string | null;
  specialization?: string | null;
  passing_year?: number | null;
  cgpa?: number | null;
  percentage?: number | null;
  student_identifier?: string | null;
  skills?: string[] | string | null;
  career_goals?: string | null;
  resume_url?: string | null;
  profile_photo_url?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  policy_accepted_at?: string | null;
  college_name?: string | null;
};

const studentOnboardingService = {
  async getMe(): Promise<StudentMe> {
    const { data } = await api.get("/students/me");
    return data.data;
  },

  async getCompletion(): Promise<ProfileCompletion> {
    const { data } = await api.get("/students/profile-completion");
    return data.data;
  },

  async updateProfile(body: Record<string, unknown> | FormData) {
    const { data } = await api.put("/students/profile", body, {
      headers:
        body instanceof FormData ? { "Content-Type": "multipart/form-data" } : undefined,
    });
    return data.data;
  },

  async uploadPhoto(file: File) {
    const fd = new FormData();
    fd.append("profile_photo", file);
    const { data } = await api.post("/students/photo", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async uploadResume(file: File) {
    const fd = new FormData();
    fd.append("resume", file);
    // Future AI parsing hook — server records STUDENT_RESUME_UPLOADED with ai_parse pending.
    const { data } = await api.post("/students/resume", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },

  async acceptPolicy() {
    const { data } = await api.post("/students/accept-policy");
    return data.data as { accepted: boolean; accepted_at: string };
  },

  async completeOnboarding(payload: FormData) {
    const { data } = await api.put("/students/me/onboarding", payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data as { user?: Record<string, unknown> };
  },
};

export default studentOnboardingService;
