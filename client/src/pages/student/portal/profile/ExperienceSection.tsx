import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import studentProfileService from "../../../../services/studentProfileService";

export default function ExperienceSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-profile-experience"],
    queryFn: () => studentProfileService.getExperience(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    experience_type: "internship",
    organization: "",
    role: "",
    start_date: "",
    end_date: "",
    responsibilities: "",
    technologies: "",
  });
  const [file, setFile] = useState<File | undefined>();

  const create = useMutation({
    mutationFn: () =>
      studentProfileService.createExperience(
        { ...form, technologies: form.technologies.split(",").map((x) => x.trim()).filter(Boolean) },
        file
      ),
    onSuccess: () => {
      toast.success("Experience added");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["student-profile-experience"] });
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => studentProfileService.deleteExperience(id),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["student-profile-experience"] });
    },
  });

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">Internship & experience</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
          <select className="rounded-lg border px-3 py-2 text-sm" value={form.experience_type} onChange={(e) => setForm({ ...form, experience_type: e.target.value })}>
            <option value="internship">Internship</option>
            <option value="freelance">Freelance</option>
            <option value="part_time">Part-time</option>
            <option value="full_time">Full-time</option>
          </select>
          <input placeholder="Organization" className="rounded-lg border px-3 py-2 text-sm" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
          <input placeholder="Role" className="rounded-lg border px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} />
          <input placeholder="Technologies" className="rounded-lg border px-3 py-2 text-sm" value={form.technologies} onChange={(e) => setForm({ ...form, technologies: e.target.value })} />
          <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <textarea placeholder="Responsibilities" className="sm:col-span-2 rounded-lg border px-3 py-2 text-sm" value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })} />
          <input type="file" onChange={(e) => setFile(e.target.files?.[0])} className="text-xs" />
          <button type="button" disabled={!form.organization || create.isPending} onClick={() => create.mutate()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {create.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save experience"}
          </button>
        </div>
      )}
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-sm text-slate-400">No experience entries yet.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((e) => (
            <li key={e.id} className="flex justify-between gap-3 rounded-xl border border-slate-100 p-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{e.organization}</p>
                <p className="text-xs capitalize text-slate-500">
                  {e.experience_type.replace(/_/g, " ")} · {e.role || "—"}
                </p>
              </div>
              <button type="button" onClick={() => del.mutate(e.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
