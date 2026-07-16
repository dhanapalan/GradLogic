import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Download, Trash2, Upload, Loader2, FileText } from "lucide-react";
import studentProfileService from "../../../../services/studentProfileService";

export default function ResumeSection() {
  const qc = useQueryClient();
  const profileQ = useQuery({
    queryKey: ["student-profile-full"],
    queryFn: () => studentProfileService.getProfile(),
  });
  const resumeQ = useQuery({
    queryKey: ["student-profile-resume"],
    queryFn: () => studentProfileService.getResume(),
  });

  const upload = useMutation({
    mutationFn: (file: File) => studentProfileService.uploadResume(file),
    onSuccess: () => {
      toast.success("Resume uploaded");
      qc.invalidateQueries({ queryKey: ["student-profile-resume"] });
      qc.invalidateQueries({ queryKey: ["student-profile-full"] });
      qc.invalidateQueries({ queryKey: ["student-profile-completion"] });
    },
    onError: () => toast.error("Resume upload failed"),
  });

  const del = useMutation({
    mutationFn: () => studentProfileService.deleteResume(),
    onSuccess: () => {
      toast.success("Resume removed");
      qc.invalidateQueries({ queryKey: ["student-profile-resume"] });
      qc.invalidateQueries({ queryKey: ["student-profile-full"] });
      qc.invalidateQueries({ queryKey: ["student-profile-completion"] });
    },
  });

  const url = resumeQ.data?.url || (profileQ.data?.resume_url as string | undefined);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-black text-slate-900">Resume management</h2>
        <p className="text-xs text-slate-500">PDF or DOCX, max 2MB. Future: AI parsing, ATS score, skill extraction.</p>
      </div>
      {url ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-indigo-500" />
            <div>
              <p className="text-sm font-bold text-slate-900">Current resume</p>
              <p className="text-xs text-slate-500">
                {resumeQ.data?.uploaded_at
                  ? `Updated ${new Date(resumeQ.data.uploaded_at).toLocaleString()}`
                  : "On file"}
                {resumeQ.data?.version ? ` · v${resumeQ.data.version}` : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <button type="button" onClick={() => del.mutate()} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">No resume uploaded yet.</p>
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700">
        {upload.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        {url ? "Replace resume" : "Upload resume"}
        <input
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 2 * 1024 * 1024) {
              toast.error("Resume must be 2MB or smaller");
              return;
            }
            upload.mutate(f);
          }}
        />
      </label>
    </section>
  );
}
