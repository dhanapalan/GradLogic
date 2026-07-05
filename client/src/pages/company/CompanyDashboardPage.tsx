import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import api from "../../lib/api";
import {
  Briefcase, Users, Star, Gift, TrendingUp,
  Plus, ChevronRight, Clock, CheckCircle2, Circle, AlertCircle,
  GraduationCap,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Stats {
  active_drives: number;
  total_drives: number;
  total_candidates: number;
  shortlisted: number;
  offers_made: number;
  avg_score: number | null;
}

interface Drive {
  id: string;
  name: string;
  status: string;
  scheduled_start: string | null;
  completed_count: number;
  shortlisted_count: number;
  rule_name: string | null;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  draft:          { label: "Draft",     color: "text-slate-400 bg-slate-100",   icon: Circle },
  generating:     { label: "Generating",color: "text-amber-500 bg-amber-50",    icon: Clock },
  scheduled:      { label: "Scheduled", color: "text-indigo-500 bg-indigo-50",  icon: Clock },
  active:         { label: "Live",      color: "text-emerald-600 bg-emerald-50",icon: CheckCircle2 },
  pool_approved:  { label: "Ready",     color: "text-blue-500 bg-blue-50",      icon: CheckCircle2 },
  completed:      { label: "Completed", color: "text-slate-500 bg-slate-100",   icon: CheckCircle2 },
  cancelled:      { label: "Cancelled", color: "text-rose-400 bg-rose-50",      icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status.toLowerCase()] ?? STATUS_CONFIG.draft;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </span>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function CompanyDashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["company-stats"],
    queryFn: () => api.get("/company/stats").then(r => r.data.data as Stats),
  });

  const { data: drivesData, isLoading: drivesLoading } = useQuery({
    queryKey: ["company-drives"],
    queryFn: () => api.get("/company/drives").then(r => r.data.data as Drive[]),
  });

  const stats = statsData;
  const drives = drivesData ?? [];

  const statCards = [
    { label: "Active Drives",    value: stats?.active_drives   ?? "—", icon: Briefcase,  color: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-100" },
    { label: "Total Candidates", value: stats?.total_candidates ?? "—", icon: Users,      color: "text-violet-600", bg: "bg-violet-50",  border: "border-violet-100" },
    { label: "Shortlisted",      value: stats?.shortlisted      ?? "—", icon: Star,       color: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100"  },
    { label: "Offers Made",      value: stats?.offers_made      ?? "—", icon: Gift,       color: "text-emerald-600",bg: "bg-emerald-50", border: "border-emerald-100"},
    { label: "Avg Score",        value: stats?.avg_score != null ? `${stats.avg_score}%` : "—", icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-slate-900">Company Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your hiring drives and candidate pipeline</p>
        </div>
        <Link
          to="/app/drives/create"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Drive
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`${bg} ${border} border rounded-2xl p-4`}>
            <div className={`${color} mb-2`}><Icon className="h-5 w-5" /></div>
            <div className="text-2xl font-black text-slate-900">{statsLoading ? "…" : value}</div>
            <div className="text-xs text-slate-500 font-semibold mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Pipeline progress bar */}
      {stats && stats.total_candidates > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Hiring Funnel</h2>
          <div className="space-y-3">
            {[
              { label: "Candidates assessed", value: stats.total_candidates, max: stats.total_candidates, color: "bg-slate-300" },
              { label: "Shortlisted",          value: stats.shortlisted,      max: stats.total_candidates, color: "bg-amber-400" },
              { label: "Offers made",          value: stats.offers_made,      max: stats.total_candidates, color: "bg-emerald-500" },
            ].map(({ label, value, max, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-40 shrink-0">{label}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div
                    className={`${color} h-2 rounded-full transition-all duration-700`}
                    style={{ width: `${max > 0 ? Math.round((value / max) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-slate-700 w-8 text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Register a college */}
        <Link
          to="/app/company/campus-setup"
          className="group flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-100 transition-all"
        >
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition-colors shrink-0">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-slate-900 group-hover:text-indigo-700 transition-colors">Register a College</p>
            <p className="text-xs text-slate-400 mt-0.5">Add a college and import students for campus hiring</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-indigo-400 shrink-0" />
        </Link>

        {/* New Drive */}
        <Link
          to="/app/drives/create"
          className="group flex items-center gap-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 hover:shadow-md hover:border-emerald-100 transition-all"
        >
          <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors shrink-0">
            <Plus className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-sm text-slate-900 group-hover:text-emerald-700 transition-colors">Create Assessment Drive</p>
            <p className="text-xs text-slate-400 mt-0.5">Set up a hiring drive with AI-generated questions</p>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-emerald-400 shrink-0" />
        </Link>
      </div>

      {/* Recent drives */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-sm font-black text-slate-900">Your Drives</h2>
          <Link to="/app/drives" className="text-xs text-indigo-600 font-semibold hover:underline flex items-center gap-1">
            All drives <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {drivesLoading ? (
          <div className="px-5 pb-5 text-sm text-slate-400">Loading…</div>
        ) : drives.length === 0 ? (
          <div className="px-5 pb-8 text-center">
            <Briefcase className="h-10 w-10 text-slate-200 mx-auto mb-2 mt-4" />
            <p className="text-sm text-slate-400">No drives yet.</p>
            <Link to="/app/drives/create" className="text-indigo-600 text-sm font-semibold hover:underline mt-1 inline-block">
              Create your first drive →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {drives.slice(0, 8).map(d => (
              <Link
                key={d.id}
                to={`/app/drives/${d.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate group-hover:text-indigo-600 transition-colors">{d.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {d.rule_name && <span>{d.rule_name} · </span>}
                    {d.scheduled_start ? fmt(d.scheduled_start) : "No date set"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-slate-500 font-medium hidden md:block">
                    {d.completed_count} completed · {d.shortlisted_count} shortlisted
                  </span>
                  <StatusBadge status={d.status} />
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
