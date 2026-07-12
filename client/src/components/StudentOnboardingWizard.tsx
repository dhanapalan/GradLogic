import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import api from "../lib/api";
import { authActions, useAuthStore } from "../stores/authStore";
import { getDegreeDurationYears } from "../lib/courseYears";

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
  linkedin_url?: string;
  github_url?: string;
  profile_photo?: FileList;
  resume: FileList;
};

export default function StudentOnboardingWizard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((s) => s.user);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingForm>({
    defaultValues: {
      course_start_year: String(new Date().getFullYear() - 4),
      passing_year: String(new Date().getFullYear()),
    },
  });

  const watchedDegree = watch("degree");
  const watchedStart = watch("course_start_year");
  const watchedEnd = watch("passing_year");

  useEffect(() => {
    if (!watchedDegree) return;
    const duration = getDegreeDurationYears(watchedDegree);
    const start = parseInt(watchedStart, 10);
    if (Number.isFinite(start)) {
      setValue("passing_year", String(start + duration));
    }
  }, [watchedDegree, watchedStart, setValue]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "student") {
      navigate("/", { replace: true });
      return;
    }
    if (user.is_profile_complete !== false) {
      navigate("/", { replace: true });
    }
  }, [navigate, user]);

  const onSubmit = async (form: OnboardingForm) => {
    if (!form.resume?.[0]) {
      toast.error("Resume/CV upload is required");
      return;
    }
    if (!form.cgpa && !form.percentage) {
      toast.error("Please provide either CGPA/GPA or Percentage");
      return;
    }

    const payload = new FormData();
    payload.append("first_name", form.first_name);
    if (form.middle_name?.trim()) payload.append("middle_name", form.middle_name.trim());
    payload.append("last_name", form.last_name);
    payload.append("dob", form.dob);
    if (form.gender) payload.append("gender", form.gender);
    payload.append("phone_number", form.phone_number);
    if (form.alternate_email?.trim()) payload.append("alternate_email", form.alternate_email.trim());
    if (form.alternate_phone?.trim()) payload.append("alternate_phone", form.alternate_phone.trim());
    payload.append("degree", form.degree);
    payload.append("specialization", form.specialization);
    payload.append("passing_year", form.passing_year);
    if (form.cgpa?.trim()) payload.append("cgpa", form.cgpa.trim());
    if (form.percentage?.trim()) payload.append("percentage", form.percentage.trim());
    payload.append("roll_number", form.roll_number);
    if (form.class_name?.trim()) payload.append("class_name", form.class_name.trim());
    if (form.section?.trim()) payload.append("section", form.section.trim());
    if (form.skills?.trim()) payload.append("skills", form.skills.trim());
    if (form.linkedin_url?.trim()) payload.append("linkedin_url", form.linkedin_url.trim());
    if (form.github_url?.trim()) payload.append("github_url", form.github_url.trim());

    if (form.profile_photo?.[0]) {
      payload.append("profile_photo", form.profile_photo[0]);
    }
    payload.append("resume", form.resume[0]);

    setLoading(true);
    try {
      const { data } = await api.put("/students/me/onboarding", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const updatedUser = data?.data?.user;
      if (updatedUser) {
        authActions.setUser(updatedUser);
      } else if (user) {
        authActions.setUser({
          ...user,
          name: `${form.first_name}${form.last_name ? ` ${form.last_name}` : ""}`.trim(),
          phone_number: form.phone_number,
          dob: form.dob,
          is_profile_complete: true,
        });
      }

      toast.success("Profile completed successfully");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.response?.data?.error || "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const watchCgpa = watch("cgpa");
  const watchPercentage = watch("percentage");

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <div className="card w-full">
        <h1 className="text-2xl font-bold text-gray-900">Complete Student Profile</h1>
        <p className="mt-2 text-sm text-gray-600">
          Fill all required details before accessing your dashboard.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">1. Personal Information</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">First Name</label>
                <input
                  {...register("first_name", { required: "First name is required" })}
                  className="input-field mt-1"
                  placeholder="First name"
                />
                {errors.first_name && <p className="mt-1 text-sm text-red-600">{errors.first_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Middle Name (Optional)</label>
                <input
                  {...register("middle_name")}
                  className="input-field mt-1"
                  placeholder="Middle name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Last Name</label>
                <input
                  {...register("last_name", { required: "Last name is required" })}
                  className="input-field mt-1"
                  placeholder="Last name"
                />
                {errors.last_name && <p className="mt-1 text-sm text-red-600">{errors.last_name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  {...register("dob", { required: "Date of birth is required" })}
                  className="input-field mt-1"
                />
                {errors.dob && <p className="mt-1 text-sm text-red-600">{errors.dob.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Gender (Optional)</label>
                <select {...register("gender")} className="input-field mt-1">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non_binary">Non-binary</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Profile Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  {...register("profile_photo")}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">2. Contact Information</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <input value={user?.email || ""} disabled className="input-field mt-1 bg-gray-100 text-gray-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Mobile Number</label>
                <input
                  {...register("phone_number", { required: "Mobile number is required" })}
                  className="input-field mt-1"
                  placeholder="+91XXXXXXXXXX"
                />
                {errors.phone_number && <p className="mt-1 text-sm text-red-600">{errors.phone_number.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Alternate Email (Optional)</label>
                <input
                  type="email"
                  {...register("alternate_email")}
                  className="input-field mt-1"
                  placeholder="alternate@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Alternate Phone (Optional)</label>
                <input
                  {...register("alternate_phone")}
                  className="input-field mt-1"
                  placeholder="+91XXXXXXXXXX"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">3. Academic Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">College / University</label>
                <input
                  value="Mapped from your registration"
                  disabled
                  className="input-field mt-1 bg-gray-100 text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Degree / Program</label>
                <select
                  {...register("degree", { required: "Degree is required" })}
                  className="input-field mt-1"
                >
                  <option value="">Select degree</option>
                  <option value="B.Tech">B.Tech</option>
                  <option value="B.E.">B.E.</option>
                  <option value="B.Sc">B.Sc</option>
                  <option value="M.Sc">M.Sc</option>
                  <option value="MCA">MCA</option>
                  <option value="M.Tech">M.Tech</option>
                </select>
                {errors.degree && <p className="mt-1 text-sm text-red-600">{errors.degree.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Branch / Specialization</label>
                <input
                  {...register("specialization", { required: "Branch/Specialization is required" })}
                  className="input-field mt-1"
                  placeholder="Computer Science"
                />
                {errors.specialization && <p className="mt-1 text-sm text-red-600">{errors.specialization.message}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Academic Year</label>
                <div className="mt-1 grid grid-cols-2 gap-3">
                  <div>
                    <input
                      type="number"
                      {...register("course_start_year", { required: "Start year is required" })}
                      className="input-field"
                      placeholder="Start e.g. 2002"
                    />
                    {errors.course_start_year && (
                      <p className="mt-1 text-sm text-red-600">{errors.course_start_year.message}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      {...register("passing_year", {
                        required: "End year is required",
                        onChange: (e) => {
                          const end = parseInt(e.target.value, 10);
                          if (Number.isFinite(end) && watchedDegree) {
                            setValue(
                              "course_start_year",
                              String(end - getDegreeDurationYears(watchedDegree)),
                              { shouldValidate: true }
                            );
                          }
                        },
                      })}
                      className="input-field"
                      placeholder="End e.g. 2006"
                    />
                    {errors.passing_year && (
                      <p className="mt-1 text-sm text-red-600">{errors.passing_year.message}</p>
                    )}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Full Academic Year
                  {watchedDegree
                    ? ` (${watchedDegree}, ${getDegreeDurationYears(watchedDegree)} yrs)`
                    : ""}
                  {watchedStart && watchedEnd ? `: ${watchedStart} - ${watchedEnd}` : ", e.g. B.E. → 2002 - 2006"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">CGPA / GPA (0-10)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("cgpa")}
                  className="input-field mt-1"
                  placeholder="8.45"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Percentage (0-100)</label>
                <input
                  type="number"
                  step="0.01"
                  {...register("percentage")}
                  className="input-field mt-1"
                  placeholder="84.5"
                />
              </div>

              {!watchCgpa && !watchPercentage && (
                <div className="md:col-span-2">
                  <p className="text-sm text-amber-600">Provide either CGPA/GPA or Percentage.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Roll Number / Student ID</label>
                <input
                  {...register("roll_number", { required: "Roll number / student ID is required" })}
                  className="input-field mt-1"
                  placeholder="CS22B101"
                />
                {errors.roll_number && <p className="mt-1 text-sm text-red-600">{errors.roll_number.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Class (Optional)</label>
                <input
                  {...register("class_name")}
                  className="input-field mt-1"
                  placeholder="Final Year"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Section (Optional)</label>
                <input
                  {...register("section")}
                  className="input-field mt-1"
                  placeholder="A"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-700">4. Professional / Additional Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Resume / CV (PDF or DOC/DOCX, max 2MB)</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  {...register("resume", { required: "Resume is required" })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {errors.resume && <p className="mt-1 text-sm text-red-600">{errors.resume.message as string}</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Skills / Interests (comma separated)</label>
                <input
                  {...register("skills")}
                  className="input-field mt-1"
                  placeholder="Python, Machine Learning, React"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">LinkedIn URL (Optional)</label>
                <input
                  type="url"
                  {...register("linkedin_url")}
                  className="input-field mt-1"
                  placeholder="https://linkedin.com/in/your-profile"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">GitHub URL (Optional)</label>
                <input
                  type="url"
                  {...register("github_url")}
                  className="input-field mt-1"
                  placeholder="https://github.com/your-profile"
                />
              </div>
            </div>
          </section>

          <div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-50">
              {loading ? "Saving..." : "Save and Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
