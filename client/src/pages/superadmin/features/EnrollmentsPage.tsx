import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import userService from "../../../services/userService";
import superadminFeaturesService, {
  type BatchRow,
  type EnrollmentRow,
} from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader } from "./FeatureUi";

export default function EnrollmentsPage() {
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [batches, setBatches] = useState<BatchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      superadminFeaturesService.listEnrollments({ search: search || undefined }),
      superadminFeaturesService.listBatches(),
    ])
      .then(([enrollments, batchRows]) => {
        setRows(enrollments);
        setBatches(batchRows);
      })
      .catch(() => toast.error("Failed to load enrollments"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enroll = async () => {
    if (!batchId || !studentEmail.trim()) return toast.error("Batch and student email required");
    setBusy(true);
    try {
      const users = await userService.searchUsers(studentEmail.trim(), 5);
      const student = users.find(
        (u: any) => String(u.email || "").toLowerCase() === studentEmail.trim().toLowerCase()
      ) || users[0];
      if (!student?.id) {
        toast.error("Student not found");
        return;
      }
      await superadminFeaturesService.enrollStudent(batchId, student.id);
      toast.success("Enrolled");
      setCreating(false);
      setStudentEmail("");
      load();
    } catch {
      toast.error("Enrollment failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (id: string, status: "active" | "withdrawn" | "completed") => {
    try {
      await superadminFeaturesService.setEnrollmentStatus(id, status);
      toast.success("Updated");
      load();
    } catch {
      toast.error("Update failed");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={ClipboardCheck}
        title="Enrollments"
        description="Assign students to college batches."
        action={
          <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white">
            <Plus className="w-4 h-4" /> Enroll student
          </button>
        }
      />

      <div className="flex gap-2 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          placeholder="Search student…"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button type="button" onClick={load} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </div>

      {creating && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 grid sm:grid-cols-2 gap-3">
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <option value="">Select batch…</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.college_name})</option>
            ))}
          </select>
          <input value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="Student email" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <button type="button" disabled={busy} onClick={enroll} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2 w-fit">
            Enroll
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="No batch enrollments yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">College</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-gray-100">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{e.student_name}</div>
                    <div className="text-xs text-gray-500">{e.student_email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.batch_name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.college_name}</td>
                  <td className="px-4 py-3 text-gray-600">{e.status}</td>
                  <td className="px-4 py-3 space-x-2">
                    {e.status !== "completed" && (
                      <button type="button" className="text-xs text-admin-accent" onClick={() => setStatus(e.id, "completed")}>Complete</button>
                    )}
                    {e.status !== "withdrawn" && (
                      <button type="button" className="text-xs text-red-600" onClick={() => setStatus(e.id, "withdrawn")}>Withdraw</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
