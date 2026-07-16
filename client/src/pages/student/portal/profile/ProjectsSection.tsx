import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import studentProfileService from "../../../../services/studentProfileService";

export default function ProjectsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-profile-projects"],
    queryFn: () => studentProfileService.getProjects(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", technologies: "", role: "", start_date: "", end_date: "", github_url: "", live_url: "",
  });
  const [file, setFile] = useState<File | undefined>();

  const create = useMutation({
    mutationFn: () =>
      studentProfileService.createProject(
        { ...form, technologies: form.technologies.split(",").map((x) => x.trim()).filter(Boolean) },
        file
      ),
    onSuccess: () => {
      toast.success("Project added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["student-profile-projects"] });
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => studentProfileService.deleteProject(id),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["student-profile-projects"] });
    },
  });

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">Projects</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
          <input placeholder="Project name" className="rounded-lg border px-3 py-2 text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Role" className="rounded-lg border px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <textarea placeholder="Description" className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Technologies (comma-separated)" className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm" value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} />
          <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <input placeholder="GitHub URL" className="rounded-lg border px-3 py-2 text-sm" value={form.github_url} onChange={(e) => setForm({ ...form, github_url: e.target.value })} />
          <input placeholder="Live URL" className="rounded-lg border px-3 py-2 text-sm" value={form.live_url} onChange={(e) => setForm({ ...form, live_url: e.target.value })} />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="text-xs" />
          <button type="button" disabled={!form.name || create.isPending} onClick={() => create.mutate()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {create.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save project"}
          </button>
        </div>
      )}
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-sm text-slate-400">No projects yet.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 rounded-xl border border-slate-100 p-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-500">{p.role}{(p.technologies || []).length ? ` · ${(p.technologies || []).join(", ")}` : ""}</p>
              </div>
              <button type="button" onClick={() => del.mutate(p.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
