import api from "../lib/api";

export const COLLEGE_TYPES = [
  "Engineering",
  "Arts & Science",
  "Polytechnic",
  "Management",
  "Other",
] as const;

export type CollegeType = (typeof COLLEGE_TYPES)[number];

export interface CollegeProfile {
  id: string;
  college_code: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  university: string | null;
  college_type: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pin_code: string | null;
  placement_officer_name: string | null;
  placement_officer_email: string | null;
  placement_officer_mobile: string | null;
  can_edit?: boolean;
  created_at?: string;
  updated_at?: string;
}

export type CollegeProfileForm = {
  name: string;
  college_code: string;
  short_name: string;
  university: string;
  college_type: string;
  email: string;
  phone: string;
  website: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  pin_code: string;
  placement_officer_name: string;
  placement_officer_email: string;
  placement_officer_mobile: string;
};

export function profileToForm(p: CollegeProfile): CollegeProfileForm {
  return {
    name: p.name ?? "",
    college_code: p.college_code ?? "",
    short_name: p.short_name ?? "",
    university: p.university ?? "",
    college_type: p.college_type ?? "",
    email: p.email ?? "",
    phone: p.phone ?? "",
    website: p.website ?? "",
    address_line1: p.address_line1 ?? "",
    address_line2: p.address_line2 ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    country: p.country ?? "India",
    pin_code: p.pin_code ?? "",
    placement_officer_name: p.placement_officer_name ?? "",
    placement_officer_email: p.placement_officer_email ?? "",
    placement_officer_mobile: p.placement_officer_mobile ?? "",
  };
}

const collegeProfileService = {
  async get(): Promise<CollegeProfile> {
    const { data } = await api.get("/college/profile");
    return data.data;
  },

  async update(payload: CollegeProfileForm): Promise<CollegeProfile> {
    const { data } = await api.put("/college/profile", payload);
    return data.data;
  },

  async uploadLogo(file: File): Promise<CollegeProfile> {
    const fd = new FormData();
    fd.append("logo", file);
    const { data } = await api.post("/college/profile/logo", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data.data;
  },
};

export default collegeProfileService;
