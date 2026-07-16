import { useEffect, useState } from "react";
import { Layers, Loader2, Plus } from "lucide-react";
import toast from "react-hot-toast";
import collegeService from "../../../services/collegeService";
import superadminFeaturesService, { type BatchRow } from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader } from "./FeatureUi";

interface College {
  id: string;
  name: string;
}

export default function BatchesPage() {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ college_id: "", name: "", academic_year: "", program_label: "" });
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      superadminFeaturesService.listBatches(),
      collegeService.getAllColleges(undefined, undefined, 1, 200).then((res) => res.colleges || []).catch(() => [] as College[]),
    ])
      .then(([batches, cols]) => {
        setRows(batches);
        setColleges(cols.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => toast.error("Failed to load batches"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!form.college_id || !form.name.trim()) return toast.error("College and name are required");
    setBusy(true);
    try {
      await superadminFeaturesService.createBatch({
        college_id: form.college_id,
        name: form.name.trim(),
        academic_year: form.academic_year || undefined,
        program_label: form.program_label || undefined,
      });
      toast.success("Batch created");
      setCreating(false);
      setForm({ college_id: "", name: "", academic_year: "", program_label: "" });
      load();
    } catch {
      toast.error("Create failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={Layers}
        title="Batches"
        description="Student cohorts within each college."
        action={
          <button type="button" onClick={() => setCreating((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white">
            <Plus className="w-4 h-4" /> New batch
          </button>
        }
      />

      {creating && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 grid sm:grid-cols-2 gap-3">
          <select
            value={form.college_id}
            onChange={(e) => setForm({ ...form, college_id: e.target.value })}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Select college…</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Batch name" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="Academic year (e.g. 2026-27)" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input value={form.program_label} onChange={(e) => setForm({ ...form, program_label: e.target.value })} placeholder="Program (e.g. B.Tech CSE)" className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="sm:col-span-2">
            <button type="button" disabled={busy} onClick={create} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="No batches yet. Create the first cohort." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">College</th>
                <th className="px-4 py-3">Year</th>
                <th className="px-4 py-3">Students</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.college_name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.academic_year || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{b.student_count}</td>
                  <td className="px-4 py-3 text-gray-600">{b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
