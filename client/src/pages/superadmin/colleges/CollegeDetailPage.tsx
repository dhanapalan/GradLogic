import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, MagnifyingGlassIcon, PencilIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import collegeService, { College, CollegeStudent } from "../../../services/collegeService";

export default function CollegeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [college, setCollege] = useState<College | null>(null);
  const [students, setStudents] = useState<CollegeStudent[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loadingCollege, setLoadingCollege] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
  }, [id]);

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

  const toggleCollegeActive = async () => {
    if (!id || !college) return;
    const deactivate = college.status === "active";
    if (
      !confirm(
        deactivate
          ? "Deactivate this college? It can be reactivated later."
          : "Activate this college?"
      )
    ) {
      return;
    }
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
  };

  return (
    <div className="p-8">
      <Link
        to="/app/superadmin/colleges"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to All Colleges
      </Link>

      {loadingCollege ? (
        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-8" />
      ) : college ? (
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3 max-w-xl">
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full text-xl font-bold px-3 py-2 border rounded-lg"
                    placeholder="College name"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm"
                      placeholder="Email"
                    />
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm"
                      placeholder="Phone"
                    />
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm"
                      placeholder="City"
                    />
                    <input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      className="px-3 py-2 border rounded-lg text-sm"
                      placeholder="State"
                    />
                  </div>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    placeholder="Address"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveCollege}
                      disabled={saving}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="text-3xl font-bold text-gray-900">{college.name}</h2>
                  <p className="text-gray-600 mt-1">
                    {college.email || "No email on file"} {college.city ? `· ${college.city}` : ""}
                  </p>
                </>
              )}
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={college.status} />
              {!editing && (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <PencilIcon className="w-5 h-5" />
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
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-600 mb-8">
          College not found
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Students {total > 0 && <span className="text-gray-500 font-normal">({total})</span>}
        </h3>
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search students by name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Student ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Degree</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Passing Year</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">CGPA</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingStudents ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    Loading students...
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No students found
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.student_identifier || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.degree || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.passing_year ?? "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{student.cgpa ?? "—"}</td>
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
    </div>
  );
}
