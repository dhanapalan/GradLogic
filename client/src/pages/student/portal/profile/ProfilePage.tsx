import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Save,
  Shield,
  User,
} from "lucide-react";
import studentProfileService, {
  type ProfileCompletion,
  type StudentProfile,
} from "../../../../services/studentProfileService";
import { PersonalAcademicForm } from "./PersonalAcademicForm";
import { SkillsSection } from "./SkillsSection";
import { PreferencesSection } from "./PreferencesSection";
import { AccountSection } from "./AccountSection";

const CertificationsSection = lazy(() => import("./CertificationsSection"));
const ProjectsSection = lazy(() => import("./ProjectsSection"));
const ExperienceSection = lazy(() => import("./ExperienceSection"));
const ResumeSection = lazy(() => import("./ResumeSection"));
const DocumentsSection = lazy(() => import("./DocumentsSection"));

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "personal", label: "Personal" },
  { id: "academic", label: "Academic" },
  { id: "skills", label: "Skills" },
  { id: "certifications", label: "Certifications" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "resume", label: "Resume" },
  { id: "career", label: "Career" },
  { id: "social", label: "Social" },
  { id: "documents", label: "Documents" },
  { id: "privacy", label: "Privacy" },
  { id: "account", label: "Account" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const DRAFT_KEY = "student-profile-draft-v1";
/** Session-only draft of editable fields — never persist tokens or secrets. */
const DRAFT_KEYS = [
  "first_name", "middle_name", "last_name", "preferred_name", "gender", "dob", "blood_group",
  "phone_number", "alternate_phone", "alternate_email", "nationality",
  "address_line1", "address_line2", "city", "district", "state", "country", "postal_code",
  "emergency_name", "emergency_relationship", "emergency_phone",
  "degree", "specialization", "class_name", "section", "passing_year", "admission_year",
  "cgpa", "percentage", "roll_number", "academic_advisor", "current_backlogs", "academic_status",
  "linkedin_url", "github_url", "portfolio_url", "kaggle_url", "hackerrank_url",
  "leetcode_url", "codechef_url", "other_links", "career_goals",
] as const;

function isEditable(profile: StudentProfile | undefined, key: string) {
  const meta = profile?.field_metadata?.fields?.find((f) => f.key === key);
  if (meta) return meta.editable;
  const readOnly = new Set([
    "email",
    "institutional_email",
    "student_identifier",
    "register_number",
    "category",
    "college_name",
  ]);
  return !readOnly.has(key);
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const section = (params.get("section") as SectionId) || "overview";

  const profileQ = useQuery({
    queryKey: ["student-profile-full"],
    queryFn: () => studentProfileService.getProfile(),
    staleTime: 30_000,
  });
  const completionQ = useQuery({
    queryKey: ["student-profile-completion"],
    queryFn: () => studentProfileService.getCompletion(),
    staleTime: 30_000,
  });

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState(false);
  const [draftNote, setDraftNote] = useState(false);

  const setSection = (id: SectionId) => {
    if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
    if (dirty && profileQ.data) {
      setForm(profileQ.data as Record<string, unknown>);
      sessionStorage.removeItem(DRAFT_KEY);
      setDraftNote(false);
    }
    setDirty(false);
    setParams(id === "overview" ? {} : { section: id });
  };

  useEffect(() => {
    if (profileQ.data) {
      setForm(profileQ.data as Record<string, unknown>);
      setDirty(false);
    }
  }, [profileQ.data]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const patch = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
    setDraftNote(false);
  }, []);

  const saveMut = useMutation({
    mutationFn: () => studentProfileService.saveProfile(form),
    onSuccess: (data) => {
      toast.success("Profile saved");
      setDirty(false);
      setDraftNote(false);
      sessionStorage.removeItem("student-profile-draft-v1");
      qc.setQueryData(["student-profile-full"], data);
      qc.invalidateQueries({ queryKey: ["student-profile-completion"] });
      qc.invalidateQueries({ queryKey: ["student-dash-shell"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Could not save profile";
      toast.error(msg);
    },
  });

  const photoMut = useMutation({
    mutationFn: (file: File) => studentProfileService.uploadPhoto(file),
    onSuccess: () => {
      toast.success("Photo updated");
      qc.invalidateQueries({ queryKey: ["student-profile-full"] });
      qc.invalidateQueries({ queryKey: ["student-dash-shell"] });
    },
    onError: () => toast.error("Photo upload failed"),
  });

  const profile = profileQ.data;
  const completion = completionQ.data as ProfileCompletion | undefined;
  const editable = (key: string) => isEditable(profile, key);

  const onSaveDraft = () => {
    const draft: Record<string, unknown> = {};
    for (const k of DRAFT_KEYS) {
      if (form[k] !== undefined) draft[k] = form[k];
    }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setDraftNote(true);
    toast.success("Draft saved for this browser session");
  };

  useEffect(() => {
    if (!profileQ.data) return;
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Record<string, unknown>;
      if (!draft || typeof draft !== "object") return;
      toast(
        (t) => (
          <span className="text-sm">
            Unsaved draft found.{" "}
            <button
              type="button"
              className="font-bold underline"
              onClick={() => {
                setForm((prev) => ({ ...prev, ...draft }));
                setDirty(true);
                setDraftNote(true);
                toast.dismiss(t.id);
              }}
            >
              Restore
            </button>
          </span>
        ),
        { duration: 8000, id: "profile-draft-restore" }
      );
    } catch {
      /* ignore corrupt draft */
    }
  }, [profileQ.data?.id]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name && !form.name) {
      toast.error("First name is required");
      setSection("personal");
      return;
    }
    saveMut.mutate();
  };

  const headerName =
    String(form.preferred_name || form.first_name || profile?.name || "Student");

  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-in fade-in duration-500">
      {/* Completion bar */}
      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">My Profile</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage personal, academic, and career information for placement readiness.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-2xl font-black text-indigo-600">{completion?.percentage ?? 0}%</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Complete
              </p>
            </div>
            <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-100">
              <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" className="stroke-slate-100" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-indigo-500"
                  strokeWidth="3"
                  strokeDasharray={`${((completion?.percentage ?? 0) / 100) * 94} 94`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
        {completion?.sections && (
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {completion.sections.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSection(s.href as SectionId)}
                  className={`flex w-full items-center gap-1.5 rounded-xl border px-2.5 py-2 text-left text-[11px] font-bold ${
                    s.complete
                      ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                      : "border-amber-100 bg-amber-50 text-amber-700"
                  }`}
                >
                  {s.complete ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {completion?.missing_links && completion.missing_links.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Missing:{" "}
            {completion.missing_links.slice(0, 6).map((m, i) => (
              <span key={m.field}>
                {i > 0 ? ", " : ""}
                <button
                  type="button"
                  onClick={() => setSection(m.section as SectionId)}
                  className="font-semibold text-indigo-600 hover:underline"
                >
                  {m.field.replace(/_/g, " ")}
                </button>
              </span>
            ))}
          </p>
        )}
      </div>

      {dirty && (
        <div
          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800"
          role="status"
        >
          <span className="font-medium">You have unsaved changes.</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveDraft}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-bold"
            >
              Save draft
            </button>
            <button
              type="button"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending}
              className="rounded-lg bg-amber-700 px-3 py-1 text-xs font-bold text-white"
            >
              Save changes
            </button>
          </div>
        </div>
      )}
      {draftNote && (
        <p className="text-xs text-slate-500">Draft stored locally until you save changes to the server.</p>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
        {/* Left nav */}
        <nav
          className="h-fit rounded-2xl border border-slate-100 bg-white p-2 shadow-sm lg:sticky lg:top-4"
          aria-label="Profile sections"
        >
          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => setSection(s.id)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                    section === s.id
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                  aria-current={section === s.id ? "page" : undefined}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          {profileQ.isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-100 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-label="Loading profile" />
            </div>
          ) : profileQ.isError ? (
            <div className="rounded-2xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700" role="alert">
              Couldn’t load your profile.{" "}
              <button type="button" className="font-bold underline" onClick={() => profileQ.refetch()}>
                Retry
              </button>
            </div>
          ) : (
            <>
              {(section === "overview" || section === "personal" || section === "academic" || section === "social") && (
                <form onSubmit={onSubmit} className="space-y-4" noValidate>
                  {section === "overview" && (
                    <OverviewCard
                      profile={profile}
                      form={form}
                      headerName={headerName}
                      onPhoto={(f) => photoMut.mutate(f)}
                      uploading={photoMut.isPending}
                    />
                  )}
                  <PersonalAcademicForm
                    mode={section === "overview" ? "personal" : section}
                    form={form}
                    patch={patch}
                    editable={editable}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={onSaveDraft}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Save draft
                    </button>
                    <button
                      type="submit"
                      disabled={saveMut.isPending || !dirty}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saveMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      Save changes
                    </button>
                  </div>
                </form>
              )}

              {section === "skills" && <SkillsSection />}
              {section === "career" || section === "privacy" ? (
                <PreferencesSection mode={section === "privacy" ? "privacy" : "career"} />
              ) : null}
              {section === "account" && <AccountSection profile={profile} />}

              <Suspense
                fallback={
                  <div className="h-40 animate-pulse rounded-2xl bg-slate-100" aria-hidden />
                }
              >
                {section === "certifications" && <CertificationsSection />}
                {section === "projects" && <ProjectsSection />}
                {section === "experience" && <ExperienceSection />}
                {section === "resume" && <ResumeSection />}
                {section === "documents" && <DocumentsSection />}
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewCard({
  profile,
  form,
  headerName,
  onPhoto,
  uploading,
}: {
  profile?: StudentProfile;
  form: Record<string, unknown>;
  headerName: string;
  onPhoto: (f: File) => void;
  uploading: boolean;
}) {
  const photo =
    (form.profile_photo_url as string) ||
    profile?.profile_photo_url ||
    null;

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Profile overview">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative">
          {photo ? (
            <img src={photo} alt="" className="h-20 w-20 rounded-2xl object-cover border border-slate-100" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white">
              {(headerName[0] || "S").toUpperCase()}
            </div>
          )}
          <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50">
            <Camera className="h-3.5 w-3.5 text-slate-600" />
            <span className="sr-only">Upload profile photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 2 * 1024 * 1024) {
                  toast.error("Photo must be 2MB or smaller");
                  return;
                }
                onPhoto(f);
              }}
            />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-black text-slate-900">{headerName}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-400">Student ID</dt>
              <dd>{String(form.student_identifier || form.register_number || "—")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Department</dt>
              <dd>{String(form.specialization || "—")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Program</dt>
              <dd>{String(form.degree || "—")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Semester / Class</dt>
              <dd>{String(form.class_name || form.section || "—")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Batch</dt>
              <dd>{form.passing_year != null ? String(form.passing_year) : "—"}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">College</dt>
              <dd>{String(form.college_name || "—")}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Readiness</dt>
              <dd>
                {form.readiness_score != null
                  ? `${form.readiness_score}% (${form.readiness_level || "—"})`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-400">Last updated</dt>
              <dd>
                {form.last_updated
                  ? new Date(String(form.last_updated)).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-[11px] font-bold text-slate-600">
            <User className="h-3.5 w-3.5" /> Profile summary
          </span>
          <Link
            to="/app/student-portal/workflow"
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
          >
            <Shield className="h-3.5 w-3.5" /> View readiness
          </Link>
        </div>
      </div>
    </section>
  );
}
