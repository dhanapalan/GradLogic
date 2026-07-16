import { useEffect, useState } from "react";
import { Route as RouteIcon, Plus, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import superadminFeaturesService, { type JourneyTemplate } from "../../../services/superadminFeaturesService";
import { EmptyState, PageHeader } from "./FeatureUi";

export default function JourneyTemplatesPage() {
  const [rows, setRows] = useState<JourneyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    setLoading(true);
    superadminFeaturesService
      .listJourneyTemplates()
      .then(setRows)
      .catch(() => toast.error("Failed to load journey templates"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const create = async () => {
    if (!title.trim()) return toast.error("Title required");
    setBusy(true);
    try {
      await superadminFeaturesService.createJourneyTemplate({
        title: title.trim(),
        description: description.trim() || undefined,
        target_role: targetRole.trim() || undefined,
      });
      toast.success("Template created");
      setCreating(false);
      setTitle("");
      setDescription("");
      setTargetRole("");
      load();
    } catch {
      toast.error("Create failed");
    } finally {
      setBusy(false);
    }
  };

  const publish = async (id: string) => {
    try {
      await superadminFeaturesService.updateJourneyTemplate(id, { status: "published" });
      toast.success("Published");
      load();
    } catch {
      toast.error("Publish failed");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <PageHeader
        icon={RouteIcon}
        title="AI Learning Journey Templates"
        description="Reusable AI-powered placement roadmaps (redirects to AI Learning Journey)."
        action={
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="w-4 h-4" /> New template
          </button>
        }
      />

      {creating && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Target role (e.g. software_engineer)" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <button type="button" disabled={busy} onClick={create} className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            Save draft
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
      ) : rows.length === 0 ? (
        <EmptyState message="No journey templates yet." />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-medium text-gray-900">{p.title}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  {p.status} · {p.course_count} courses
                  {p.target_role ? ` · ${p.target_role}` : ""}
                  {p.duration_days ? ` · ${p.duration_days} days` : ""}
                </p>
                {p.description ? <p className="text-sm text-gray-600 mt-2">{p.description}</p> : null}
              </div>
              {p.status !== "published" ? (
                <button type="button" onClick={() => publish(p.id)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">
                  Publish
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
