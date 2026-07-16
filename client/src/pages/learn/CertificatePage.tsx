// =============================================================================
// Certificate Page — /app/certificate/:id
// Printable achievement certificate. Students can Ctrl+P / print to PDF.
// =============================================================================

import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";
import { Printer, ArrowLeft, Award, CheckCircle2, Loader2 } from "lucide-react";

interface Certificate {
  id: string;
  student_name: string;
  course_title?: string;
  path_title?: string;
  drive_name?: string;
  title: string;
  cert_type?: string;
  category: string | null;
  difficulty: string | null;
  issued_at: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export default function CertificatePage() {
  const { certId } = useParams<{ certId: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["certificate", certId],
    queryFn: () => api.get(`/lms/certificates/${certId}`).then(r => r.data.data as Certificate),
    enabled: !!certId,
  });

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
    </div>
  );

  if (isError || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Award className="h-12 w-12 text-slate-200" />
      <p className="text-slate-400">Certificate not found</p>
      <Link to="/app/learn" className="text-indigo-600 text-sm font-bold hover:underline">← Back</Link>
    </div>
  );

  const displayTitle = data.course_title || data.path_title || data.drive_name || data.title;

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:bg-white print:p-0">
      {/* Action bar — hidden when printing */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link to="/app/learn" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Back to Learning
        </Link>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>

      {/* Certificate card */}
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden print:shadow-none print:rounded-none">

        {/* Top accent bar */}
        <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600" />

        <div className="px-10 py-12 text-center">

          {/* Logo / Platform */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Award className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-black text-slate-700">TalentSecure AI</span>
          </div>

          {/* Certificate label */}
          <p className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase mb-4">
            Certificate of Completion
          </p>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-indigo-200" />
            <Award className="h-8 w-8 text-indigo-300" />
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-indigo-200" />
          </div>

          {/* "This certifies that" */}
          <p className="text-sm text-slate-400 font-medium mb-2">This certifies that</p>

          {/* Student name */}
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2"
              style={{ fontFamily: "Georgia, serif" }}>
            {data.student_name}
          </h1>

          {/* "has successfully completed" */}
          <p className="text-sm text-slate-400 font-medium mb-6">has successfully completed</p>

          {/* Course name */}
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl px-8 py-5 mb-8">
            <h2 className="text-xl font-black text-indigo-800 leading-tight">{displayTitle}</h2>
            {data.category && (
              <p className="text-sm text-indigo-500 font-medium mt-1 capitalize">{data.category}</p>
            )}
          </div>

          {/* Skills / completion badge */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            <span className="text-sm font-semibold text-slate-500">All modules completed with passing marks</span>
          </div>

          {/* Footer row: date + cert ID */}
          <div className="flex items-center justify-between pt-8 border-t border-slate-100">
            <div className="text-left">
              <p className="text-xs text-slate-400">Date of Issue</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5">{fmt(data.issued_at)}</p>
            </div>
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-lg">
              <Award className="h-8 w-8 text-white" />
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Certificate ID</p>
              <p className="text-xs font-mono text-slate-500 mt-0.5">{certId?.slice(-12).toUpperCase()}</p>
            </div>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600" />
      </div>

      {/* Print instructions */}
      <p className="text-center text-xs text-slate-400 mt-4 print:hidden">
        Use <kbd className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-xs">Ctrl+P</kbd> (or <kbd className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-xs">⌘P</kbd>) → Save as PDF to download
      </p>
    </div>
  );
}
