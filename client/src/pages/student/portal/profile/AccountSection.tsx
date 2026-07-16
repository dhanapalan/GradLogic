import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { KeyRound, Shield, MonitorSmartphone } from "lucide-react";
import type { StudentProfile } from "../../../../services/studentProfileService";
import studentAuthService from "../../../../services/studentAuthService";
import api from "../../../../lib/api";

export function AccountSection({ profile }: { profile?: StudentProfile }) {
  const sessionsQ = useQuery({
    queryKey: ["student-sessions-preview"],
    queryFn: () => studentAuthService.listSessions(),
    staleTime: 30_000,
  });

  const mfaQ = useQuery({
    queryKey: ["student-2fa-status"],
    queryFn: async () => (await api.get("/auth/2fa/status")).data.data as { enabled?: boolean },
    staleTime: 60_000,
  });

  return (
    <section className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" aria-label="Account information">
      <h2 className="text-sm font-black text-slate-900">Account information</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Student ID</dt>
          <dd className="font-medium text-slate-800">{String(profile?.student_identifier || "—")}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Registered email</dt>
          <dd className="font-medium text-slate-800">{String(profile?.email || "—")}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">MFA status</dt>
          <dd className="font-medium text-slate-800">{mfaQ.data?.enabled ? "Enabled" : "Not configured"}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active sessions</dt>
          <dd className="font-medium text-slate-800">{sessionsQ.data?.length ?? "—"}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2 pt-2">
        <Link to="/auth/change-password" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <KeyRound className="h-3.5 w-3.5" /> Change password
        </Link>
        <Link
          to="/app/security"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <Shield className="h-3.5 w-3.5" /> Configure MFA
        </Link>
        <Link to="/app/student-portal/sessions" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
          <MonitorSmartphone className="h-3.5 w-3.5" /> View active sessions
        </Link>
      </div>
    </section>
  );
}
