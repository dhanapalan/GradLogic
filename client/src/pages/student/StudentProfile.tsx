import { useState, useRef } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "../../lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, Edit2, Upload, User, Save, Lock, FileText, CheckCircle2, ShieldCheck, Mail, Phone, BookOpen, GraduationCap, Building2, Calendar, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  formatCourseYears,
  getCourseStartYear,
  getDegreeDurationYears,
} from "../../lib/courseYears";

export default function StudentProfile() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [formData, setFormData] = useState<any>({});

  const { data: profile, isLoading } = useQuery({
    queryKey: ["student-profile"],
    queryFn: async () => {
      const { data } = await api.get("/auth/me");
      const profileData = data?.data || {};
      setFormData(profileData);
      return profileData;
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      if (!user?.id) throw new Error("No user ID");
      const { data } = await api.put(`/students/${user.id}`, updatedData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      toast.success("Profile updated successfully");
      setIsEditing(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to update profile");
      setFormData(profile || {});
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const handleSave = () => {
    // Pick only editable fields
    const {
      phone,
      department,
      resume_url,
      avatar_url,
      degree,
      specialization,
      passing_year
    } = formData;

    updateProfileMutation.mutate({ phone, department, resume_url, avatar_url, degree, specialization, passing_year });
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("profile_photo", file);
      const { data } = await api.put(`/students/${user.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updatedUrl = data?.data?.avatar_url;
      if (updatedUrl) {
        setFormData((prev: any) => ({ ...prev, avatar_url: updatedUrl }));
      }
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      toast.success("Profile photo updated.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to upload photo.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
  };

  const handleResumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    const allowed = ["application/pdf", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF or DOC/DOCX files are allowed.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Resume must be under 2 MB.");
      return;
    }
    setUploadingResume(true);
    try {
      const fd = new FormData();
      fd.append("resume", file);
      const { data } = await api.put(`/students/${user.id}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updatedUrl = data?.data?.resume_url;
      if (updatedUrl) {
        setFormData((prev: any) => ({ ...prev, resume_url: updatedUrl }));
      }
      queryClient.invalidateQueries({ queryKey: ["student-profile"] });
      toast.success("Resume uploaded successfully.");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Failed to upload resume.");
    } finally {
      setUploadingResume(false);
      e.target.value = "";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">

      {/* ── Navigation & Header ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/app/student-portal")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData(profile || {});
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateProfileMutation.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
              >
                {updateProfileMutation.isPending ? "Saving..." : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-semibold hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

        {/* ── Left Column: Identity & Photo ── */}
        <div className="md:col-span-1 space-y-6">

          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm relative">
            <div className="h-24 bg-gradient-to-r from-indigo-500 to-indigo-700 absolute top-0 left-0 w-full" />

            <div className="p-8 pt-12 relative z-10 flex flex-col items-center text-center">
              <div className="h-28 w-28 rounded-full bg-white p-1.5 shadow-xl mb-4 relative group">
                <div className="h-full w-full rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200">
                  {formData.avatar_url ? (
                    <img src={formData.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                {isEditing && (
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    className="absolute bottom-0 right-0 h-8 w-8 bg-indigo-600 text-white rounded-full flex items-center justify-center border-2 border-white shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-60"
                  >
                    {uploadingPhoto
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Upload className="w-3.5 h-3.5" />}
                  </button>
                )}
                <input
                  type="file"
                  ref={photoInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoChange}
                />
              </div>

              <h2 className="text-xl font-bold text-slate-900 group flex items-center gap-1.5 justify-center">
                {profile?.name || user?.name}
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">{profile?.college_name || "N/A"}</p>

              <div className="w-full mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-sm text-slate-600 text-left bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-1">Candidate ID</p>
                    <p className="font-semibold text-slate-900 truncate">{user?.id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Resume Section */}
          <div className="bg-white rounded-[1.5rem] p-6 border border-slate-200 shadow-sm transition-all hover:border-indigo-100">
            <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" /> Professional
            </h3>

            <div className="border border-dashed border-slate-300 rounded-xl p-5 text-center bg-slate-50/50">
              <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
                <FileText className="w-5 h-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">Resume / CV</p>
              <p className="text-xs text-slate-400 mt-1 mb-4">PDF, DOCX up to 2MB</p>

              {isEditing ? (
                <>
                  <button
                    onClick={() => resumeInputRef.current?.click()}
                    disabled={uploadingResume}
                    className="w-full text-sm font-semibold text-indigo-600 bg-white border border-indigo-100 rounded-lg py-2 hover:bg-indigo-50 transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {uploadingResume
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                      : <><Upload className="w-4 h-4" /> Upload Resume</>}
                  </button>
                  <input
                    type="file"
                    ref={resumeInputRef}
                    className="hidden"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeChange}
                  />
                </>
              ) : (
                <button disabled className="w-full text-sm font-semibold text-slate-400 bg-slate-100 border border-slate-200 rounded-lg py-2 flex items-center justify-center gap-1.5">
                  {formData.resume_url ? <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Uploaded</> : "No file uploaded"}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ── Right Column: Form Data ── */}
        <div className="md:col-span-2 space-y-6">

          <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm relative overflow-hidden">

            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2 pb-5 border-b border-slate-100">
              <User className="w-5 h-5 text-indigo-500" /> Basic Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5 opacity-70">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">Full Name <Lock className="w-3 h-3 text-slate-400" /></label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={profile?.name || user?.name || ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 cursor-not-allowed pl-10"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>
              <div className="space-y-1.5 opacity-70">
                <label className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">Email Address <Lock className="w-3 h-3 text-slate-400" /></label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={profile?.email || user?.email || ""}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 cursor-not-allowed pl-10"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    disabled={!isEditing}
                    value={formData.phone || ""}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 pl-10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors ${!isEditing ? "bg-slate-50/50 border-slate-200" : "bg-white border-slate-300"}`}
                    placeholder="+91 "
                  />
                  <Phone className={`w-4 h-4 absolute left-3.5 top-3 ${isEditing ? 'text-indigo-400' : 'text-slate-400'}`} />
                </div>
              </div>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-6 mt-10 flex items-center gap-2 pb-5 border-b border-slate-100">
              <BookOpen className="w-5 h-5 text-indigo-500" /> Academic Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Degree</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.degree || ""}
                    onChange={(e) => {
                      const degree = e.target.value;
                      const end = Number(formData.passing_year);
                      setFormData({
                        ...formData,
                        degree,
                        course_start_year: Number.isFinite(end)
                          ? end - getDegreeDurationYears(degree)
                          : formData.course_start_year,
                      });
                    }}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 pl-10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors ${!isEditing ? "bg-slate-50/50 border-slate-200" : "bg-white border-slate-300"}`}
                    placeholder="e.g. B.Tech"
                  />
                  <GraduationCap className={`w-4 h-4 absolute left-3.5 top-3 ${isEditing ? 'text-indigo-400' : 'text-slate-400'}`} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Specialization / Department</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={!isEditing}
                    value={formData.specialization || formData.department || ""}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value, department: e.target.value })}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 pl-10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors ${!isEditing ? "bg-slate-50/50 border-slate-200" : "bg-white border-slate-300"}`}
                    placeholder="e.g. Computer Science"
                  />
                  <Building2 className={`w-4 h-4 absolute left-3.5 top-3 ${isEditing ? 'text-indigo-400' : 'text-slate-400'}`} />
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700">Academic Year</label>
                {!isEditing ? (
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={formatCourseYears(formData.degree, formData.passing_year, "")}
                      className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 pl-10 bg-slate-50/50 border-slate-200"
                      placeholder="—"
                    />
                    <Calendar className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        value={
                          formData.course_start_year ??
                          getCourseStartYear(formData.degree, formData.passing_year) ??
                          ""
                        }
                        onChange={(e) => {
                          const start = parseInt(e.target.value, 10);
                          const duration = getDegreeDurationYears(formData.degree);
                          setFormData({
                            ...formData,
                            course_start_year: start,
                            passing_year: Number.isFinite(start) ? start + duration : formData.passing_year,
                          });
                        }}
                        className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 pl-10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white border-slate-300"
                        placeholder="Start e.g. 2002"
                      />
                      <Calendar className="w-4 h-4 absolute left-3.5 top-3 text-indigo-400" />
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.passing_year || ""}
                        onChange={(e) => {
                          const end = parseInt(e.target.value, 10);
                          setFormData({
                            ...formData,
                            passing_year: end,
                            course_start_year: Number.isFinite(end)
                              ? end - getDegreeDurationYears(formData.degree)
                              : formData.course_start_year,
                          });
                        }}
                        className="w-full border rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 pl-10 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white border-slate-300"
                        placeholder="End e.g. 2006"
                      />
                      <Calendar className="w-4 h-4 absolute left-3.5 top-3 text-indigo-400" />
                    </div>
                  </div>
                )}
                {isEditing && (
                  <p className="text-[11px] text-slate-500">
                    Academic Year for {formData.degree || "this program"} (
                    {getDegreeDurationYears(formData.degree)} yrs), e.g. B.E. → 2002 - 2006
                  </p>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>

    </div>
  );
}
