import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { Search, Bell, Key, Upload, UserPlus, X } from "lucide-react";
import StatusBadge from "../../../components/superadmin/StatusBadge";
import studentsService, { StudentListItem } from "../../../services/studentsService";
import collegeService, { College } from "../../../services/collegeService";

function readinessLabel(score: number): { label: string; status: string } {
  if (score >= 70) return { label: `${score}%`, status: "active" };
  if (score >= 40) return { label: `${score}%`, status: "pending" };
  return { label: `${score}%`, status: "suspended" };
}

function parseStudentCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const header = lines[0].toLowerCase();
  const hasHeader =
    header.includes("email") || header.includes("name") || header.includes("student");
  const rows = hasHeader ? lines.slice(1) : lines;

  return rows.map((line, idx) => {
    const cols = line.split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    const [name, email, student_identifier, degree, passing_year, cgpa, phone_number] = cols;
    if (!name || !email) {
      throw new Error(`Row ${idx + 1}: name and email are required (${line})`);
    }
    return {
      name,
      email,
      student_identifier: student_identifier || undefined,
      degree: degree || undefined,
      passing_year: passing_year ? Number(passing_year) : undefined,
      cgpa: cgpa ? Number(cgpa) : undefined,
      phone_number: phone_number || undefined,
    };
  });
}

export default function AllStudentsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState("");
  const [acting, setActing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    email: "",
    college_id: "",
    student_identifier: "",
    phone_number: "",
    degree: "",
    passing_year: "",
    cgpa: "",
  });
  const [importCollegeId, setImportCollegeId] = useState("");
  const [importCsv, setImportCsv] = useState("");
  const [importResult, setImportResult] = useState<{
    created_count: number;
    skipped_count: number;
    skipped: Array<{ email: string; reason: string }>;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [collegeId, setCollegeId] = useState("");
  const [batch, setBatch] = useState("");
  const [performance, setPerformance] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const selectedCollegeId = searchParams.get("collegeId") || "";
    if (selectedCollegeId) {
      setCollegeId(selectedCollegeId);
    }

    if (searchParams.get("action") === "add" && selectedCollegeId) {
      setCreateOpen(true);
      setImportOpen(false);
      setCreateForm((prev) => ({ ...prev, college_id: selectedCollegeId }));

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("action");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
    if (!confirm(`${action === "deactivate" ? "Soft-delete" : "Activate"} ${selected.size} student(s)?`)) return;
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

  const handleCreateStudent = async () => {
    if (!createForm.name.trim() || !createForm.email.trim() || !createForm.college_id) {
      toast.error("Name, email, and college are required");
      return;
    }
    setCreating(true);
    try {
      const res = await studentsService.createStudent({
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        college_id: createForm.college_id,
        student_identifier: createForm.student_identifier || undefined,
        phone_number: createForm.phone_number || undefined,
        degree: createForm.degree || undefined,
        passing_year: createForm.passing_year ? Number(createForm.passing_year) : undefined,
        cgpa: createForm.cgpa ? Number(createForm.cgpa) : undefined,
      });
      const temp = res?.data?.temporary_password;
      toast.success(temp ? `Student created. Temp password: ${temp}` : "Student created");
      setCreateOpen(false);
      setCreateForm({
        name: "",
        email: "",
        college_id: "",
        student_identifier: "",
        phone_number: "",
        degree: "",
        passing_year: "",
        cgpa: "",
      });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.error || e.response?.data?.message || "Failed to create student");
    } finally {
      setCreating(false);
    }
  };

  const handleBulkImport = async () => {
    if (!importCollegeId) {
      toast.error("Select a college for this import");
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const parsed = parseStudentCsv(importCsv);
      if (!parsed.length) {
        toast.error("Paste or upload at least one student row");
        return;
      }
      const res = await studentsService.bulkImport({
        college_id: importCollegeId,
        students: parsed,
      });
      const data = res?.data;
      setImportResult({
        created_count: data?.created_count ?? 0,
        skipped_count: data?.skipped_count ?? 0,
        skipped: data?.skipped ?? [],
      });
      toast.success(res?.message || `Imported ${data?.created_count ?? 0} students`);
      load();
    } catch (e: any) {
      toast.error(e?.message || e.response?.data?.error || e.response?.data?.message || "Bulk import failed");
    } finally {
      setImporting(false);
    }
  };

  const onCsvFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImportCsv(String(reader.result || ""));
    reader.onerror = () => toast.error("Could not read CSV file");
    reader.readAsText(file);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">Students</h2>
          <p className="text-gray-500 mt-1">
            {total > 0 ? `${total} students across all colleges` : "All students across all colleges"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setImportOpen(true);
              setCreateOpen(false);
              setImportResult(null);
              if (collegeId) setImportCollegeId(collegeId);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 bg-white text-gray-800 rounded-lg font-medium hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            Bulk Import
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateOpen(true);
              setImportOpen(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800"
          >
            <UserPlus className="w-4 h-4" />
            Add Student
          </button>
        </div>
      </div>

      {createOpen && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Create Student</h3>
            <button type="button" onClick={() => setCreateOpen(false)} aria-label="Close">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              placeholder="Full name *"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Email *"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
            <select
              value={createForm.college_id}
              onChange={(e) => setCreateForm({ ...createForm, college_id: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="">Select college *</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Student / Roll ID"
              value={createForm.student_identifier}
              onChange={(e) => setCreateForm({ ...createForm, student_identifier: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Phone"
              value={createForm.phone_number}
              onChange={(e) => setCreateForm({ ...createForm, phone_number: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Degree / Department"
              value={createForm.degree}
              onChange={(e) => setCreateForm({ ...createForm, degree: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
            <input
              placeholder="Passing year"
              value={createForm.passing_year}
              onChange={(e) => setCreateForm({ ...createForm, passing_year: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
            <input
              placeholder="CGPA"
              value={createForm.cgpa}
              onChange={(e) => setCreateForm({ ...createForm, cgpa: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2"
            />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            A temporary password is generated if you leave password blank (shown after create).
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCreateStudent}
              disabled={creating}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Bulk Import Students</h3>
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportResult(null);
              }}
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <select
              value={importCollegeId}
              onChange={(e) => setImportCollegeId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="">Target college *</option>
              {colleges.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => onCsvFile(e.target.files?.[0] || null)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <p className="text-sm text-gray-500 mb-2">
            CSV columns:{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">
              name, email, student_id, degree, passing_year, cgpa, phone
            </code>
            . Header row optional. Max 500 rows.
          </p>
          <textarea
            rows={8}
            value={importCsv}
            onChange={(e) => setImportCsv(e.target.value)}
            placeholder={
              "name,email,student_id,degree,passing_year,cgpa,phone\nJane Doe,jane@college.edu,CS21,CSE,2026,8.2,"
            }
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
          />
          {importResult && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">
                Created {importResult.created_count} · Skipped {importResult.skipped_count}
              </p>
              {importResult.skipped.length > 0 && (
                <ul className="mt-2 max-h-28 overflow-auto text-xs text-gray-600 space-y-1">
                  {importResult.skipped.slice(0, 20).map((s) => (
                    <li key={`${s.email}-${s.reason}`}>
                      {s.email}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleBulkImport}
              disabled={importing || !importCsv.trim() || !importCollegeId}
              className="inline-flex items-center gap-2 px-4 py-2 bg-navy-900 text-white rounded-lg font-medium disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {importing ? "Importing..." : "Import"}
            </button>
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportResult(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

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
              type="button"
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
              type="button"
              onClick={() => setNotifyOpen(true)}
              disabled={acting}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Bell className="w-4 h-4" />
              Send Notification
            </button>
            <button
              type="button"
              onClick={handleResetPasswords}
              disabled={acting}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              <Key className="w-4 h-4" />
              Reset Password
            </button>
            <button
              type="button"
              onClick={() => handleBulkStudentStatus("deactivate")}
              disabled={acting}
              className="px-3 py-1.5 bg-white border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            >
              Deactivate
            </button>
            <button
              type="button"
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
              type="button"
              onClick={handleSendNotification}
              disabled={acting || !notifyMessage.trim()}
              className="px-4 py-2 bg-navy-900 text-white rounded-lg font-medium hover:bg-navy-800 disabled:opacity-50"
            >
              Send
            </button>
            <button
              type="button"
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
