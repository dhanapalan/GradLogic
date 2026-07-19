/**
 * Module 01 — Multi-step Student Onboarding Wizard
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { authActions, useAuthStore } from "../stores/authStore";
import { getDegreeDurationYears } from "../lib/courseYears";
import studentOnboardingService from "../services/studentOnboardingService";
import { parseApiError } from "../services/studentAuthService";
import { getLandingPath } from "./ProtectedRoute";

type OnboardingForm = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  dob: string;
  gender?: "male" | "female" | "non_binary" | "prefer_not_to_say";
  phone_number: string;
  alternate_email?: string;
  alternate_phone?: string;
  degree: string;
  specialization: string;
  course_start_year: string;
  passing_year: string;
  cgpa?: string;
  percentage?: string;
  roll_number: string;
  class_name?: string;
  section?: string;
  skills?: string;
  career_goals?: string;
  linkedin_url?: string;
  github_url?: string;
  accept_terms: boolean;
};

const STEPS = [
  { key: "welcome", title: "Welcome" },
  { key: "personal", title: "Personal Information" },
  { key: "academic", title: "Academic Information" },
  { key: "skills", title: "Skills" },
  { key: "career", title: "Career Goals" },
  { key: "resume", title: "Resume Upload" },
  { key: "terms", title: "Terms & Privacy" },
  { key: "success", title: "Success" },
] as const;

const inputCls =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";

export default function StudentOnboardingWizard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [completionPct, setCompletionPct] = useState(0);

  const form = useForm<OnboardingForm>({
    defaultValues: {
      course_start_year: String(new Date().getFullYear() - 4),
      passing_year: String(new Date().getFullYear()),
      accept_terms: false,
    },
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    getValues,
    formState: { errors },
  } = form;

  const watchedDegree = watch("degree");
  const watchedStart = watch("course_start_year");

  useEffect(() => {
    if (!user) return;
    if (user.role !== "student") {
      navigate("/", { replace: true });
      return;
    }
    if (user.is_profile_complete !== false) {
      navigate(getLandingPath(user), { replace: true });
    }
  }, [navigate, user]);

  useEffect(() => {
    if (!watchedDegree) return;
    const duration = getDegreeDurationYears(watchedDegree);
    const start = parseInt(watchedStart, 10);
    if (Number.isFinite(start)) {
      setValue("passing_year", String(start + duration));
    }
  }, [watchedDegree, watchedStart, setValue]);

  useEffect(() => {
    studentOnboardingService
      .getCompletion()
      .then((c) => setCompletionPct(c.percentage))
      .catch(() => setCompletionPct(Math.round((step / (STEPS.length - 1)) * 100)));
  }, [step]);

  const progress = useMemo(
    () => Math.max(completionPct, Math.round((step / (STEPS.length - 1)) * 100)),
    [completionPct, step]
  );

  const validateStep = async () => {
    if (step === 1) {
      return trigger(["first_name", "last_name", "dob", "phone_number"]);
    }
    if (step === 2) {
      const ok = await trigger([
        "degree",
        "specialization",
        "passing_year",
        "roll_number",
        "cgpa",
        "percentage",
      ]);
      const v = getValues();
      if (!v.cgpa?.trim() && !v.percentage?.trim()) {
        toast.error("Provide either CGPA/GPA or Percentage");
        return false;
      }
      return ok;
    }
    if (step === 3) {
      return trigger(["skills"]);
    }
    if (step === 4) {
      return trigger(["career_goals"]);
    }
    if (step === 5) {
      // Optional — a resume-writing service (with ATS support) is offered
      // separately, so students without one yet shouldn't be blocked here.
      if (!resumeFile) return true;
      const okType = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].includes(resumeFile.type);
      if (!okType) {
        toast.error("Resume must be PDF or DOC/DOCX");
        return false;
      }
      if (resumeFile.size > 2 * 1024 * 1024) {
        toast.error("Resume must be 2MB or less");
        return false;
      }
      return true;
    }
    if (step === 6) {
      const ok = await trigger(["accept_terms"]);
      if (!getValues("accept_terms")) {
        toast.error("Please accept the Terms & Privacy Policy");
        return false;
      }
      return ok;
    }
    return true;
  };

  const next = async () => {
    const ok = await validateStep();
    if (!ok) return;
    if (step === 6) {
      await submitOnboarding();
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const submitOnboarding = handleSubmit(async (values) => {
    setLoading(true);
    try {
      await studentOnboardingService.acceptPolicy();

      const payload = new FormData();
      payload.append("first_name", values.first_name);
      if (values.middle_name?.trim()) payload.append("middle_name", values.middle_name.trim());
      payload.append("last_name", values.last_name);
      payload.append("dob", values.dob);
      if (values.gender) payload.append("gender", values.gender);
      payload.append("phone_number", values.phone_number);
      if (values.alternate_email?.trim())
        payload.append("alternate_email", values.alternate_email.trim());
      if (values.alternate_phone?.trim())
        payload.append("alternate_phone", values.alternate_phone.trim());
      payload.append("degree", values.degree);
      payload.append("specialization", values.specialization);
      payload.append("passing_year", values.passing_year);
      if (values.cgpa?.trim()) payload.append("cgpa", values.cgpa.trim());
      if (values.percentage?.trim()) payload.append("percentage", values.percentage.trim());
      payload.append("roll_number", values.roll_number);
      if (values.class_name?.trim()) payload.append("class_name", values.class_name.trim());
      if (values.section?.trim()) payload.append("section", values.section.trim());
      if (values.skills?.trim()) payload.append("skills", values.skills.trim());
      if (values.linkedin_url?.trim()) payload.append("linkedin_url", values.linkedin_url.trim());
      if (values.github_url?.trim()) payload.append("github_url", values.github_url.trim());
      if (photoFile) payload.append("profile_photo", photoFile);
      if (resumeFile) payload.append("resume", resumeFile);

      const result = await studentOnboardingService.completeOnboarding(payload);

      if (values.career_goals?.trim()) {
        await studentOnboardingService
          .updateProfile({ career_goals: values.career_goals.trim() })
          .catch(() => {});
      }

      const updatedUser = result?.user as
        | {
            id: string;
            role: string;
            name: string;
            email: string;
            is_profile_complete?: boolean;
            phone_number?: string | null;
            dob?: string | null;
            college_id?: string | null;
          }
        | undefined;

      if (updatedUser) {
        authActions.setUser({
          id: updatedUser.id,
          role: updatedUser.role,
          name: updatedUser.name,
          email: updatedUser.email,
          college_id: updatedUser.college_id,
          phone_number: updatedUser.phone_number,
          dob: updatedUser.dob,
          is_profile_complete: true,
        });
      } else if (user) {
        authActions.setUser({
          ...user,
          name: `${values.first_name} ${values.last_name}`.trim(),
          phone_number: values.phone_number,
          dob: values.dob,
          is_profile_complete: true,
        });
      }

      setStep(7);
      toast.success("Profile completed successfully");
    } catch (err) {
      toast.error(parseApiError(err).message || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  });

  const goDashboard = () => {
    navigate(getLandingPath(user), { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Student onboarding
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {STEPS[step].title}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Step {step + 1} of {STEPS.length}
            </p>
          </div>
          <div className="w-full max-w-xs">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>Profile completion</span>
              <span className="font-semibold text-slate-700">{progress}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-indigo-600 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <ol className="mb-6 flex gap-1 overflow-x-auto pb-1" aria-label="Onboarding steps">
          {STEPS.map((s, i) => (
            <li
              key={s.key}
              className={`h-1.5 min-w-[2rem] flex-1 rounded-full ${i <= step ? "bg-indigo-600" : "bg-slate-200"}`}
              title={s.title}
            />
          ))}
        </ol>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {step === 0 && (
            <div className="space-y-4 text-center sm:text-left">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 sm:mx-0">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">
                Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Complete your profile so we can personalize assessments, learning journeys, and
                placement readiness. This takes a few minutes and you can update details later.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" error={errors.first_name?.message}>
                <input
                  className={inputCls}
                  {...register("first_name", { required: "First name is required" })}
                />
              </Field>
              <Field label="Middle name (optional)">
                <input className={inputCls} {...register("middle_name")} />
              </Field>
              <Field label="Last name" error={errors.last_name?.message}>
                <input
                  className={inputCls}
                  {...register("last_name", { required: "Last name is required" })}
                />
              </Field>
              <Field label="Date of birth" error={errors.dob?.message}>
                <input
                  type="date"
                  className={inputCls}
                  {...register("dob", { required: "Date of birth is required" })}
                />
              </Field>
              <Field label="Gender (optional)">
                <select className={inputCls} {...register("gender")}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </Field>
              <Field label="Mobile number" error={errors.phone_number?.message}>
                <input
                  className={inputCls}
                  {...register("phone_number", {
                    required: "Mobile number is required",
                    minLength: { value: 7, message: "Enter a valid mobile number" },
                  })}
                />
              </Field>
              <Field label="Alternate email (optional)">
                <input type="email" className={inputCls} {...register("alternate_email")} />
              </Field>
              <Field label="Profile photo (optional)">
                <input
                  type="file"
                  accept="image/*"
                  className={inputCls}
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Degree" error={errors.degree?.message}>
                <input
                  className={inputCls}
                  placeholder="B.Tech / B.E / MCA…"
                  {...register("degree", { required: "Degree is required" })}
                />
              </Field>
              <Field label="Specialization / Branch" error={errors.specialization?.message}>
                <input
                  className={inputCls}
                  {...register("specialization", { required: "Specialization is required" })}
                />
              </Field>
              <Field label="Course start year">
                <input type="number" className={inputCls} {...register("course_start_year")} />
              </Field>
              <Field label="Passing year" error={errors.passing_year?.message}>
                <input
                  type="number"
                  className={inputCls}
                  {...register("passing_year", { required: "Passing year is required" })}
                />
              </Field>
              <Field label="CGPA / GPA">
                <input type="number" step="0.01" className={inputCls} {...register("cgpa")} />
              </Field>
              <Field label="Percentage">
                <input type="number" step="0.01" className={inputCls} {...register("percentage")} />
              </Field>
              <Field label="Roll number / Student ID" error={errors.roll_number?.message}>
                <input
                  className={inputCls}
                  {...register("roll_number", { required: "Student ID is required" })}
                />
              </Field>
              <Field label="Class (optional)">
                <input className={inputCls} {...register("class_name")} />
              </Field>
              <Field label="Section (optional)">
                <input className={inputCls} {...register("section")} />
              </Field>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Field
                label="Skills (comma-separated)"
                error={errors.skills?.message}
                hint="e.g. Python, SQL, Communication, Data Structures"
              >
                <textarea
                  rows={4}
                  className={inputCls}
                  {...register("skills", { required: "Add at least one skill" })}
                />
              </Field>
              <Field label="LinkedIn URL (optional)">
                <input className={inputCls} {...register("linkedin_url")} />
              </Field>
              <Field label="GitHub URL (optional)">
                <input className={inputCls} {...register("github_url")} />
              </Field>
            </div>
          )}

          {step === 4 && (
            <Field
              label="Career goals"
              error={errors.career_goals?.message}
              hint="Roles, industries, or companies you are targeting"
            >
              <textarea
                rows={5}
                className={inputCls}
                {...register("career_goals", {
                  required: "Share your career goals",
                  minLength: { value: 10, message: "Please add a bit more detail" },
                })}
              />
            </Field>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center">
                <Upload className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Upload resume (PDF or DOCX) — optional
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Max 2MB · AI parsing will be enabled later. Don't have one yet? Skip this — resume
                  writing with ATS support is available separately.
                </p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="mx-auto mt-4 block text-sm"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
                {resumeFile && (
                  <p className="mt-2 text-xs font-semibold text-emerald-700">{resumeFile.name}</p>
                )}
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-800">Terms of Use & Privacy Policy</p>
                <p className="mt-2">
                  By continuing you agree that GradLogic may process your academic profile, assessment
                  attempts, and resume for placement readiness, learning recommendations, and college
                  reporting. You can request data updates through your college admin.
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600"
                  {...register("accept_terms", { required: true })}
                />
                I accept the Terms of Use and Privacy Policy
              </label>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900">You&apos;re all set</h2>
              <p className="text-sm text-slate-600">
                Your student profile is complete. Head to your portal to start assessments and
                learning journeys.
              </p>
              <button
                type="button"
                onClick={goDashboard}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
              >
                Go to Student Portal <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {step < 7 && (
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
              <button
                type="button"
                onClick={back}
                disabled={step === 0 || loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                type="button"
                onClick={() => void next()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : step === 6 ? (
                  <>
                    Finish <CheckCircle2 className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-rose-600" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}
