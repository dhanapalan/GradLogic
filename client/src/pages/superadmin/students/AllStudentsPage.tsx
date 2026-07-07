import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Search, Bell, Key } from "lucide-react";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import studentsService, { StudentListItem } from "../../../services/studentsService";
import collegeService, { College } from "../../../services/collegeService";

function readinessLabel(score: number): { label: string; status: string } {
  if (score >= 70) return { label: `${score}%`, status: "active" };
  if (score >= 40) return { label: `${score}%`, status: "pending" };
  return { label: `${score}%`, status: "suspended" };
}

export default function AllStudentsPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [acting, setActing] = useState(false);

  const [search, setSearch] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [batch, setBatch] = useState("");
  const [performance, setPerformance] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    collegeService
      .getAllColleges()
      .then((res) => setColleges(res.colleges))
      .catch(() => setColleges([]));
  }, []);

  const load = () => {
    setLoading(true);
    studentsService
      .listStudents({
        search: search || undefined,
        college_id: collegeId || undefined,
        batch: batch || undefined,
        performance: (performance as "high" | "medium" | "low") || undefined,
        status: status || undefined,
        limit: 100,
      })
      .then((res) => {
        setStudents(res.students);
        setTotal(res.total);
        setSelected(new Set());
      })
      .catch(() => {
        setStudents([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, collegeId, batch, performance, status]);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === students.length ? new Set() : new Set(students.map((s) => s.id))));
  };

  const handleSendNotification = async () => {
    if (!notifyMessage.trim()) return;
    setActing(true);
    try {
      const res = await studentsService.sendNotification(
        Array.from(selected),
        "Message from GradLogic Admin",
        notifyMessage.trim()
      );
      toast.success(res.message);
      setNotifyOpen(false);
      setNotifyMessage("");
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setActing(false);
    }
  };

  const handleResetPasswords = async () => {
    if (!confirm(`Reset passwords for ${selected.size} student(s)? They will be required to set a new password on next login.`)) {
      return;
    }
    setActing(true);
    try {
      const res = await studentsService.resetPasswords(Array.from(selected));
      toast.success(res.message);
      setSelected(new Set());
    } catch {
      toast.error("Failed to reset passwords");
    } finally {
      setActing(false);
    }
  };

  const handleBulkStudentStatus = async (action: "deactivate" | "activate") => {
    if (!confirm(`${action === "deactivate" ? "Deactivate" : "Activate"} ${selected.size} student(s)?`)) return;
    setActing(true);
    try {
      const res =
        action === "deactivate"
          ? await studentsService.deactivateStudents(Array.from(selected))
          : await studentsService.activateStudents(Array.from(selected));
      toast.success(res.message);
      setSelected(new Set());
      load();
    } catch {
      toast.error(`Failed to ${action} students`);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Students</h2>
        <p className="text-gray-500 mt-1">
          {total > 0 ? `${total} students across all colleges` : "All students across all colleges"}
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, email, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-admin-accent"
            />
          </div>
          <select
            value={collegeId}
            onChange={(e) => setCollegeId(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-admin-accent"
          >
            <option value="">All Colleges</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Batch (year)"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-admin-accent"
          />
          <select
            value={performance}
            onChange={(e) => setPerformance(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-admin-accent"
          >
            <option value="">All Performance</option>
            <option value="high">High (≥70%)</option>
            <option value="medium">Medium (40–69%)</option>
            <option value="low">Low (&lt;40%)</option>
          </select>
        </div>
        <div className="mt-3 flex gap-2">
          {["", "active", "inactive", "suspended"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatus(s)}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                status === s ? "bg-navy-900/[0.06] text-navy-900" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All Statuses"}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-navy-900/[0.04] border border-navy-900/10 rounded-xl p-3 mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-navy-900">{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => setNotifyOpen(true)}
              disabled={acting}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              Send Notification
            </button>
            <button
              onClick={handleResetPasswords}
              disabled={acting}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              Reset Password
            </button>
            <button
              onClick={() => handleBulkStudentStatus("deactivate")}
              disabled={acting}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              Deactivate
            </button>
            <button
              onClick={() => handleBulkStudentStatus("activate")}
              disabled={acting}
              className="px-3 py-1.5 bg-white border border-green-300 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50 disabled:opacity-50"
            >
              Activate
            </button>
          </div>
        </div>
      )}

      {notifyOpen && (
        <div className="bg-white border border-gray-200/70 rounded-xl shadow-admin-card p-4 mb-4">
          <p className="text-sm font-medium text-gray-900 mb-2">
            Send notification to {selected.size} student(s)
          </p>
          <textarea
            rows={3}
            value={notifyMessage}
            onChange={(e) => setNotifyMessage(e.target.value)}
            placeholder="Message..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-admin-accent focus:border-transparent"
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSendNotification}
              disabled={acting || !notifyMessage.trim()}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              Send
            </button>
            <button
              onClick={() => setNotifyOpen(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50/70 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={students.length > 0 && selected.size === students.length}
                  onChange={toggleAll}
                />
              </th>
              {["Student Name", "College", "Batch/Department", "Email", "Registered", "Readiness", "Last Active"].map((h) => (
                <th key={h} className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-4" colSpan={8}>
                    <div className="h-4 bg-gray-200 rounded w-1/3" />
                  </td>
                </tr>
              ))
            ) : (
              students.map((student) => {
                const readiness = readinessLabel(student.readiness_score);
                return (
                  <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(student.id)}
                        onChange={() => toggleOne(student.id)}
                      />
                    </td>
                    <td
                      className="px-6 py-4 text-sm font-medium text-admin-accent hover:underline cursor-pointer"
                      onClick={() => navigate(`/app/superadmin/students/${student.id}`)}
                    >
                      {student.name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.college_name || "—"}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {[student.department, student.batch].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">{student.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(student.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={readiness.status} label={readiness.label} size="sm" />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {student.last_login ? new Date(student.last_login).toLocaleString() : "Never"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && students.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-12 text-center">
          <p className="text-gray-500">No students match your filters</p>
        </div>
      )}
    </div>
  );
}
