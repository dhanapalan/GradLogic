import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Trash2, Upload, Loader2, ExternalLink } from "lucide-react";
import studentProfileService, { DOC_TYPES } from "../../../../services/studentProfileService";

export default function DocumentsSection() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-profile-docs"],
    queryFn: () => studentProfileService.getDocuments(),
  });
  const [docType, setDocType] = useState(DOC_TYPES[0].id);

  const upload = useMutation({
    mutationFn: (file: File) => studentProfileService.uploadDocument(docType, file),
    onSuccess: () => {
      toast.success("Document uploaded");
      qc.invalidateQueries({ queryKey: ["student-profile-docs"] });
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Upload failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => studentProfileService.deleteDocument(id),
    onSuccess: () => {
      toast.success("Document removed");
      qc.invalidateQueries({ queryKey: ["student-profile-docs"] });
    },
  });

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900">Documents</h2>
        <p className="text-xs text-slate-500">Upload ID proofs, mark sheets, and certificates (PDF/images, max 5MB).</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-1 block font-bold uppercase tracking-wider text-slate-500">Document type</span>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {DOC_TYPES.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">
          {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Upload
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) {
                toast.error("File must be 5MB or smaller");
                return;
              }
              upload.mutate(f);
            }}
          />
        </label>
      </div>
      {q.isLoading ? (
        <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
      ) : !q.data?.length ? (
        <p className="py-6 text-center text-sm text-slate-400">No documents uploaded.</p>
      ) : (
        <ul className="space-y-2">
          {q.data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{d.original_name}</p>
                <p className="text-xs capitalize text-slate-500">
                  {d.doc_type.replace(/_/g, " ")} · {(d.file_size / 1024).toFixed(0)} KB
                </p>
              </div>
              <div className="flex gap-1">
                <a href={d.storage_url} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50" aria-label="Preview">
                  <ExternalLink className="h-4 w-4" />
                </a>
                <button type="button" onClick={() => del.mutate(d.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
