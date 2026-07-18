import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Pencil, Package } from "lucide-react";
import toast from "react-hot-toast";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import ConfirmModal from "../../../components/superadmin/ConfirmModal";
import CollegeModulesPanel from "../../../components/superadmin/CollegeModulesPanel";
import collegeService, { College, CollegeStudent } from "../../../services/collegeService";
import { formatCourseYears } from "../../../lib/courseYears";

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent";

export default function CollegeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [college, setCollege] = useState<College | null>(null);
  const [students, setStudents] = useState<CollegeStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loadingCollege, setLoadingCollege] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"students" | "modules">(
    searchParams.get("tab") === "modules" ? "modules" : "students"
  );
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    tone: "default" | "danger";
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    if (!id) return;
    setLoadingCollege(true);
    collegeService
      .getCollege(id)
      .then((c) => {
        setCollege(c);
        if (searchParams.get("edit") === "1") {
          setEditing(true);
        }
        setForm({
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          address: c.address || "",
          city: c.city || "",
          state: c.state || "",
        });
      })
      .catch(() => setCollege(null))
      .finally(() => setLoadingCollege(false));
  }, [id, searchParams]);

  useEffect(() => {
    if (!id) return;
    setLoadingStudents(true);
    const debounce = setTimeout(() => {
      collegeService
        .getCollegeStudents(id, search || undefined)
        .then((res) => {
          setStudents(res.students);
          setTotal(res.total);
        })
        .catch(() => {
          setStudents([]);
          setTotal(0);
        })
        .finally(() => setLoadingStudents(false));
    }, 300);
    return () => clearTimeout(debounce);
  }, [id, search]);

  const saveCollege = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const updated = await collegeService.updateCollege(id, form);
      setCollege(updated);
      setEditing(false);
      toast.success("College updated");
    } catch {
      toast.error("Failed to update college");
    } finally {
      setSaving(false);
    }
  };

  const runConfirm = async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  const toggleCollegeActive = () => {
    if (!id || !college) return;
    const deactivate = college.status === "active";
    setConfirmDialog({
      title: deactivate ? "Deactivate college" : "Activate college",
      message: deactivate
        ? "Deactivate this college? It can be reactivated later."
        : "Activate this college?",
      confirmLabel: deactivate ? "Deactivate" : "Activate",
      tone: deactivate ? "danger" : "default",
      onConfirm: async () => {
        try {
          if (deactivate) {
            await collegeService.deactivateCollege(id);
            setCollege({ ...college, status: "suspended" });
            toast.success("College deactivated");
          } else {
            const updated = await collegeService.activateCollege(id);
            setCollege(updated);
            toast.success("College activated");
          }
        } catch {
          toast.error("Action failed");
        }
      },
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <Link
        to="/app/superadmin/colleges"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to All Colleges
      </Link>

      {loadingCollege ? (
        <div className="h-8 w-64 bg-gray-100 rounded animate-pulse" />
      ) : college ? (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3 max-w-xl">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`w-full text-xl font-semibold ${inputCls}`}
                    placeholder="College name"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="Email" />
                    <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="Phone" />
                    <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} placeholder="City" />
                    <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={inputCls} placeholder="State" />
                  </div>
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={`w-full ${inputCls}`} placeholder="Address" />
                  <div className="flex gap-2">
                    <button
                      onClick={saveCollege}
                      disabled={saving}
                      className="px-4 py-2 bg-navy-900 text-white rounded-lg text-sm font-medium hover:bg-navy-800 disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold tracking-tight text-gray-900">{college.name}</h2>
                  <p className="text-gray-500 mt-1">
                    {college.email || "No email on file"} {college.city ? `· ${college.city}` : ""}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={college.status} />
              {!editing && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={toggleCollegeActive}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                      college.status === "active"
                        ? "border-red-300 text-red-700 hover:bg-red-50"
                        : "border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {college.status === "active" ? "Deactivate" : "Activate"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center text-gray-500">
          College not found
        </div>
      )}

      {college && (
        <div className="flex gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("students")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "students"
                ? "border-admin-accent text-admin-accent"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            Students
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("modules")}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === "modules"
                ? "border-admin-accent text-admin-accent"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Package className="h-4 w-4" />
            Assign Modules
          </button>
        </div>
      )}

      {college && activeTab === "modules" && (
        <CollegeModulesPanel collegeId={college.id} collegeName={college.name} />
      )}

      {college && activeTab === "students" && (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Students {total > 0 && <span className="text-gray-400 font-normal">({total})</span>}
        </h3>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search students by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-admin-accent"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50/70 border-b border-gray-200">
              <tr>
                {["Name", "Email", "Student ID", "Degree", "Academic Year", "CGPA", "Status"].map((h) => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingStudents ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">Loading students...</td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-400">No students found</td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.student_identifier || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.degree || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatCourseYears(student.degree, student.passing_year)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.cgpa ?? "—"}</td>
                    <td className="px-6 py-4 text-sm">
                      <StatusBadge status={student.is_active ? "active" : "inactive"} size="sm" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title || ""}
        message={confirmDialog?.message || ""}
        confirmLabel={confirmDialog?.confirmLabel}
        tone={confirmDialog?.tone}
        busy={confirmBusy}
        onConfirm={runConfirm}
        onCancel={() => {
          if (!confirmBusy) setConfirmDialog(null);
        }}
      />
    </div>
  );
}
