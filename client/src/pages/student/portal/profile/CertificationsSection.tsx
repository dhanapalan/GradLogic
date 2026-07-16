import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Plus, Trash2, Loader2 } from "lucide-react";
import studentProfileService from "../../../../services/studentProfileService";

export default function CertificationsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-profile-certs"],
    queryFn: () => studentProfileService.getCertifications(),
  });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", provider: "", issue_date: "", expiry_date: "", credential_id: "", verification_url: "" });
  const [file, setFile] = useState<File | undefined>();

  const create = useMutation({
    mutationFn: () => studentProfileService.createCertification(form, file),
    onSuccess: () => {
      toast.success("Certification added");
      setOpen(false);
      setForm({ name: "", provider: "", issue_date: "", expiry_date: "", credential_id: "", verification_url: "" });
      setFile(undefined);
      qc.invalidateQueries({ queryKey: ["student-profile-certs"] });
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => studentProfileService.deleteCertification(id),
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["student-profile-certs"] });
    },
  });

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-900">Certifications</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold">
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
          {(["name", "provider", "issue_date", "expiry_date", "credential_id", "verification_url"] as const).map((k) => (
            <input
              key={k}
              type={k.includes("date") ? "date" : "text"}
              placeholder={k.replace(/_/g, " ")}
              value={form[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          ))}
          <input type="file" accept=".pdf,image/*" onChange={(e) => setFile(e.target.files?.[0])} className="text-xs" />
          <button type="button" disabled={create.isPending || !form.name} onClick={() => create.mutate()} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            {create.isPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Save certification"}
          </button>
        </div>
      )}
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-sm text-slate-400">No certifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {[c.provider, c.issue_date, c.credential_id].filter(Boolean).join(" · ")}
                </p>
                {c.verification_url && (
                  <a href={c.verification_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:underline">
                    Verify
                  </a>
                )}
              </div>
              <button type="button" onClick={() => del.mutate(c.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg p-2" aria-label="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
