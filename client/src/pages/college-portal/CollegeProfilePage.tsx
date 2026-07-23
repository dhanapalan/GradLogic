import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  MapPin,
  Briefcase,
  Save,
  ImagePlus,
  Target,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import api from "../../lib/api";
import collegeProfileService, {
  COLLEGE_TYPES,
  profileToForm,
  type CollegeProfileForm,
} from "../../services/collegeProfile";
import { useAuthStore } from "../../stores/authStore";

const EMPTY: CollegeProfileForm = {
  name: "",
  college_code: "",
  short_name: "",
  university: "",
  college_type: "",
  email: "",
  phone: "",
  website: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  country: "India",
  pin_code: "",
  placement_officer_name: "",
  placement_officer_email: "",
  placement_officer_mobile: "",
};

function clientValidate(form: CollegeProfileForm): string | null {
  if (!form.name.trim()) return "College Name is required.";
  if (!form.college_code.trim()) return "College Code is required.";
  if (!/^[A-Za-z0-9_.\-]{2,50}$/.test(form.college_code.trim())) {
    return "College Code must be 2–50 characters (letters, numbers, dot, hyphen, underscore).";
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Enter a valid college email address.";
  }
  if (
    form.placement_officer_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.placement_officer_email.trim())
  ) {
    return "Enter a valid placement officer email address.";
  }
  const phoneOk = (v: string) => !v || /^\d{7,15}$/.test(v.replace(/[\s\-()+]/g, ""));
  if (!phoneOk(form.phone)) return "Enter a valid phone number (7–15 digits).";
  if (!phoneOk(form.placement_officer_mobile)) {
    return "Enter a valid placement officer mobile (7–15 digits).";
  }
  if (form.website.trim()) {
    try {
      const u = new URL(
        form.website.startsWith("http") ? form.website : `https://${form.website}`
      );
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return "Enter a valid website URL.";
      }
    } catch {
      return "Enter a valid website URL (e.g. https://college.edu).";
    }
  }
  return null;
}

export default function CollegeProfilePage() {
  const role = useAuthStore((s) => s.user?.role ?? "");
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading, isError } = useQuery({
    queryKey: ["college-profile"],
    queryFn: () => collegeProfileService.get(),
    staleTime: 30_000,
  });

  const canEdit = Boolean(profile?.can_edit);
  const [form, setForm] = useState<CollegeProfileForm>(EMPTY);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm(profileToForm(profile));
      setLogoPreview(profile.logo_url);
    }
  }, [profile]);

  const saveMutation = useMutation({
    mutationFn: () => collegeProfileService.update(form),
    onSuccess: (data) => {
      queryClient.setQueryData(["college-profile"], data);
      toast.success("College profile saved.");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Failed to save college profile.");
    },
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => collegeProfileService.uploadLogo(file),
    onSuccess: (data) => {
      queryClient.setQueryData(["college-profile"], data);
      setLogoPreview(data.logo_url);
      toast.success("College logo updated.");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      toast.error(err?.response?.data?.error ?? "Failed to upload logo.");
    },
  });

  // Existing campus engagement setting (admin edit only)
  const isAdmin = ["college_admin", "college"].includes(role.toLowerCase());
  const { data: dailyTarget } = useQuery<{ daily_practice_target: number }>({
    queryKey: ["college-daily-target"],
    queryFn: async () => (await api.get("/college/dashboard/daily-target")).data.data,
    enabled: isAdmin,
  });
  const [target, setTarget] = useState("");
  useEffect(() => {
    if (dailyTarget) setTarget(String(dailyTarget.daily_practice_target));
  }, [dailyTarget]);
  const targetMutation = useMutation({
    mutationFn: (value: number) =>
      api.put("/college/dashboard/daily-target", { daily_practice_target: value }),
    onSuccess: () => toast.success("Daily practice target updated."),
    onError: (err: { response?: { data?: { error?: string } } }) =>
      toast.error(err?.response?.data?.error ?? "Failed to update daily target."),
  });

  const set =
    (key: keyof CollegeProfileForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
    };

  const onCancel = () => {
    if (profile) {
      setForm(profileToForm(profile));
      setLogoPreview(profile.logo_url);
    }
  };

  const onSave = () => {
    const msg = clientValidate(form);
    if (msg) {
      toast.error(msg);
      return;
    }
    saveMutation.mutate();
  };

  const onLogoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Logo must be an image file (JPEG, PNG, WebP, or GIF).");
      e.target.value = "";
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo file size must be 2MB or less.");
      e.target.value = "";
      return;
    }
    logoMutation.mutate(file);
    e.target.value = "";
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-admin-accent border-t-transparent" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load college profile. Confirm your account is linked to a campus.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">College Profile</h1>
          <p className="mt-1 text-sm text-gray-500">
            Master record for your campus — used across the College Portal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/app/college-portal/settings/departments">
            <Button type="button" variant="outline" size="sm">
              Manage Departments
            </Button>
          </Link>
          {isAdmin && (
            <Link to="/app/college-portal/campus-admins">
              <Button type="button" variant="outline" size="sm">
                Manage Staff &amp; Faculty
              </Button>
            </Link>
          )}
          {!canEdit && (
            <span className="rounded-md bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              View only
            </span>
          )}
        </div>
      </div>

      {/* Logo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">College Logo</CardTitle>
          <CardDescription>JPEG, PNG, WebP, or GIF · max 2MB</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-slate-50">
            {logoPreview ? (
              <img src={logoPreview} alt="College logo" className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-8 w-8 text-gray-300" />
            )}
          </div>
          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onLogoPick}
              />
              <Button
                type="button"
                variant="outline"
                disabled={logoMutation.isPending}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
                {logoMutation.isPending ? "Uploading…" : logoPreview ? "Change Logo" : "Upload Logo"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Basic */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-admin-accent" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="College Name *" required value={form.name} onChange={set("name")} disabled={!canEdit} />
          <Field
            label="College Code *"
            required
            value={form.college_code}
            onChange={set("college_code")}
            disabled={!canEdit}
          />
          <Field label="Short Name" value={form.short_name} onChange={set("short_name")} disabled={!canEdit} />
          <Field
            label="University / Institution"
            value={form.university}
            onChange={set("university")}
            disabled={!canEdit}
          />
          <label className="block text-xs font-medium text-gray-600 sm:col-span-2">
            College Type
            <select
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:bg-gray-50"
              value={form.college_type}
              disabled={!canEdit}
              onChange={set("college_type")}
            >
              <option value="">Select type</option>
              {COLLEGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-admin-accent" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" type="email" value={form.email} onChange={set("email")} disabled={!canEdit} />
          <Field label="Phone Number" value={form.phone} onChange={set("phone")} disabled={!canEdit} />
          <Field
            label="Website"
            value={form.website}
            onChange={set("website")}
            disabled={!canEdit}
            className="sm:col-span-2"
            placeholder="https://"
          />
          <Field
            label="Address Line 1"
            value={form.address_line1}
            onChange={set("address_line1")}
            disabled={!canEdit}
            className="sm:col-span-2"
          />
          <Field
            label="Address Line 2"
            value={form.address_line2}
            onChange={set("address_line2")}
            disabled={!canEdit}
            className="sm:col-span-2"
          />
          <Field label="City" value={form.city} onChange={set("city")} disabled={!canEdit} />
          <Field label="State" value={form.state} onChange={set("state")} disabled={!canEdit} />
          <Field label="Country" value={form.country} onChange={set("country")} disabled={!canEdit} />
          <Field label="PIN Code" value={form.pin_code} onChange={set("pin_code")} disabled={!canEdit} />
        </CardContent>
      </Card>

      {/* Placement */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="h-4 w-4 text-admin-accent" />
            Placement Information
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Placement Officer Name"
            value={form.placement_officer_name}
            onChange={set("placement_officer_name")}
            disabled={!canEdit}
            className="sm:col-span-2"
          />
          <Field
            label="Placement Officer Email"
            type="email"
            value={form.placement_officer_email}
            onChange={set("placement_officer_email")}
            disabled={!canEdit}
          />
          <Field
            label="Placement Officer Mobile"
            value={form.placement_officer_mobile}
            onChange={set("placement_officer_mobile")}
            disabled={!canEdit}
          />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saveMutation.isPending}>
            <X className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}

      {/* Keep existing daily target for campus admins (settings route) */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-admin-accent" />
              Student Engagement
            </CardTitle>
            <CardDescription>Daily practice target for students on this campus</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              min={0}
              max={20}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-28 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <span className="text-sm text-gray-500">sets / student / day</span>
            <Button
              type="button"
              className="ml-auto"
              disabled={targetMutation.isPending}
              onClick={() => {
                const v = parseInt(target, 10);
                if (Number.isNaN(v) || v < 0 || v > 20) {
                  toast.error("Enter a whole number between 0 and 20.");
                  return;
                }
                targetMutation.mutate(v);
              }}
            >
              <Save className="h-4 w-4" />
              Save Target
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  className = "",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  type?: string;
  className?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className={`block text-xs font-medium text-gray-600 ${className}`}>
      {label}
      <input
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 disabled:bg-gray-50"
      />
    </label>
  );
}
