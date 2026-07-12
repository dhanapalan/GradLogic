import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import ConfirmModal from "../../../components/superadmin/ConfirmModal";
import studentsService, { StudentDetail } from "../../../services/studentsService";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    name: "",
    email: "",
    degree: "",
    specialization: "",
    passing_year: "",
    cgpa: "",
    student_identifier: "",
  });

  const load = () => {
    if (!id) return;
    setLoading(true);
    studentsService
      .getStudentProfile(id)
      .then((d) => {
        setDetail(d);
        setForm({
          name: d.profile.name || "",
          email: d.profile.email || "",
          degree: d.profile.degree || "",
          specialization: d.profile.specialization || "",
          passing_year: d.profile.passing_year != null ? String(d.profile.passing_year) : "",
          cgpa: d.profile.cgpa != null ? String(d.profile.cgpa) : "",
          student_identifier: d.profile.student_identifier || "",
        });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSave = async () => {
    if (!id) return;
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Name is required";
    if (!form.email.trim()) errors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = "Enter a valid email";
    }
    if (form.passing_year.trim()) {
      const year = Number(form.passing_year);
      const maxYear = new Date().getFullYear() + 20;
      if (!Number.isInteger(year) || Number.isNaN(year)) {
        errors.passing_year = "Passing year must be a whole number";
      } else if (year < 1900 || year > maxYear) {
        errors.passing_year = `Enter a valid passing year (1900–${maxYear})`;
      }
    }
    if (form.cgpa.trim()) {
      const gpa = Number(form.cgpa);
      if (Number.isNaN(gpa)) errors.cgpa = "CGPA must be a number";
      else if (gpa < 0 || gpa > 10) errors.cgpa = "CGPA must be between 0 and 10";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      await studentsService.updateStudent(id, {
        name: form.name,
        email: form.email,
        degree: form.degree || null,
        specialization: form.specialization || null,
        passing_year: form.passing_year ? Number(form.passing_year) : null,
        cgpa: form.cgpa ? Number(form.cgpa) : null,
        student_identifier: form.student_identifier || null,
      });
      toast.success("Student updated");
      setFieldErrors({});
      setEditing(false);
      load();
    } catch (e: any) {
      const apiFields = e.response?.data?.fieldErrors as Record<string, string> | undefined;
      if (apiFields && Object.keys(apiFields).length) {
        setFieldErrors(apiFields);
        toast.error(e.response?.data?.message || "Please fix the highlighted fields");
      } else {
        toast.error(e.response?.data?.error || e.response?.data?.message || "Failed to update student");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await studentsService.softDeleteStudent(id);
      toast.success("Student soft-deleted");
      setDeleteOpen(false);
      navigate("/app/superadmin/students");
    } catch {
      toast.error("Failed to delete student");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Link to="/app/superadmin/students" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="w-4 h-4" />
          Back to Students
        </Link>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-600">
          Student not found
        </div>
      </div>
    );
  }

  const { profile, examResults, certifications, moduleProgress } = detail;
  const avgScore =
    examResults.length > 0
      ? Math.round(examResults.reduce((sum, e) => sum + Number(e.final_score), 0) / examResults.length)
      : null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <Link to="/app/superadmin/students" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Students
      </Link>

      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{profile.name}</h2>
          <p className="text-gray-500 mt-1">
            {profile.email} {profile.college_name ? `· ${profile.college_name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={profile.status} />
          <button
            onClick={() => setEditing((v) => !v)}
            className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {editing ? "Cancel edit" : "Edit"}
          </button>
          <button
            onClick={() => setDeleteOpen(true)}
            className="px-3 py-1.5 text-sm font-medium border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Student</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(
              [
                ["name", "Name"],
                ["email", "Email"],
                ["student_identifier", "Student ID"],
                ["degree", "Degree"],
                ["specialization", "Specialization"],
                ["passing_year", "Passing year"],
                ["cgpa", "CGPA"],
              ] as const
            ).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input
                  value={form[key]}
                  onChange={(e) => {
                    setForm({ ...form, [key]: e.target.value });
                    setFieldErrors((prev) => ({ ...prev, [key]: "" }));
                  }}
                  className={`w-full px-3 py-2 border rounded-lg ${
                    fieldErrors[key] ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors[key] && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors[key]}</p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-xs text-gray-500 uppercase">Avg Exam Score</p>
          <p className="text-2xl font-display font-semibold text-gray-900 mt-1">
            {avgScore !== null ? `${avgScore}%` : "N/A"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-xs text-gray-500 uppercase">CGPA</p>
          <p className="text-2xl font-display font-semibold text-gray-900 mt-1">{profile.cgpa ?? "N/A"}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-xs text-gray-500 uppercase">Certifications</p>
          <p className="text-2xl font-display font-semibold text-gray-900 mt-1">{certifications.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-xs text-gray-500 uppercase">Last Active</p>
          <p className="text-2xl font-display font-semibold text-gray-900 mt-1">
            {profile.last_login ? new Date(profile.last_login).toLocaleDateString() : "Never"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500">Student ID</p>
            <p className="text-sm font-medium text-gray-900">{profile.student_identifier || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Degree</p>
            <p className="text-sm font-medium text-gray-900">{profile.degree || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Specialization</p>
            <p className="text-sm font-medium text-gray-900">{profile.specialization || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Passing year</p>
            <p className="text-sm font-medium text-gray-900">{profile.passing_year ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Percentage</p>
            <p className="text-sm font-medium text-gray-900">{profile.percentage ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Exam Results</h3>
          {examResults.length === 0 ? (
            <p className="text-sm text-gray-500">No exam results</p>
          ) : (
            <ul className="space-y-2">
              {examResults.map((e) => (
                <li key={e.id} className="flex justify-between text-sm">
                  <span>{e.title}</span>
                  <span className="font-medium">{e.final_score}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Module Progress</h3>
          {moduleProgress.length === 0 ? (
            <p className="text-sm text-gray-500">No module progress</p>
          ) : (
            <ul className="space-y-2">
              {moduleProgress.map((m) => (
                <li key={m.id} className="flex justify-between text-sm">
                  <span>{m.module_title}</span>
                  <span className="font-medium">{m.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmModal
        open={deleteOpen}
        title="Delete student"
        message={`Soft-delete ${detail.profile.name}? They will be deactivated and hidden from active lists.`}
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={handleSoftDelete}
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
      />
    </div>
  );
}
