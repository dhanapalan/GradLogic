// =============================================================================
// Placement Analytics (superadmin) — platform-wide placement drive outcomes.
// Reuses existing analytics.routes.ts endpoints (/drives, /cohort) —
// no new backend aggregation needed, just a dedicated page for it.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { Target, TrendingUp, Building2 } from "lucide-react";
import api from "../../../lib/api";

interface Drive {
  id: string;
  name: string;
  status: string;
  scheduled_at: string;
  total_students: number;
  submitted_count: number;
  avg_score: number | null;
  pass_rate: number | null;
}

interface CohortRow {
  label: string;
  student_count: number;
  avg_drive_score: number | null;
  pass_rate: number | null;
}

export default function PlacementAnalyticsPage() {
  const { data: drives, isLoading: loadingDrives } = useQuery({
    queryKey: ["superadmin-placement-drives"],
    queryFn: async () => (await api.get("/analytics/drives")).data.data as Drive[],
  });

  const { data: cohorts, isLoading: loadingCohorts } = useQuery({
    queryKey: ["superadmin-placement-cohort"],
    queryFn: async () => (await api.get("/analytics/cohort", { params: { group_by: "college" } })).data.data as CohortRow[],
  });

  const totalSubmitted = (drives || []).reduce((sum, d) => sum + (d.submitted_count || 0), 0);
  const overallPassRate = drives?.length
    ? Math.round(
        drives.reduce((sum, d) => sum + (Number(d.pass_rate) || 0) * (d.submitted_count || 0), 0) /
          Math.max(totalSubmitted, 1),
      )
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Target className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Placement Analytics</h1>
          <p className="text-sm text-gray-500">Placement drive outcomes across the platform.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-2xl font-bold text-gray-900">{drives?.length ?? 0}</p>
          <p className="text-xs text-gray-500">Total drives</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-2xl font-bold text-gray-900">{totalSubmitted}</p>
          <p className="text-xs text-gray-500">Submissions across all drives</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-2xl font-bold text-gray-900">{overallPassRate}%</p>
          <p className="text-xs text-gray-500">Weighted pass rate</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-navy-900" /> Drive performance
        </h2>
        {loadingDrives ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !drives || drives.length === 0 ? (
          <p className="text-sm text-gray-400">No drives yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {drives.slice(0, 15).map((d) => (
              <div key={d.id} className="py-2.5 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-800">{d.name}</p>
                  <p className="text-xs text-gray-400 capitalize">{d.status} · {new Date(d.scheduled_at).toLocaleDateString()}</p>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <p>{d.submitted_count}/{d.total_students} submitted</p>
                  <p>{d.avg_score !== null ? `avg ${d.avg_score}` : "—"} · {d.pass_rate !== null ? `${d.pass_rate}% pass` : "—"}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-navy-900" /> By college
        </h2>
        {loadingCohorts ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !cohorts || cohorts.length === 0 ? (
          <p className="text-sm text-gray-400">No cohort data yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {cohorts.slice(0, 15).map((c, i) => (
              <div key={i} className="py-2.5 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{c.label}</span>
                <span className="text-xs text-gray-500">
                  {c.student_count} students · {c.avg_drive_score ?? "—"} avg score · {c.pass_rate !== null ? `${c.pass_rate}% pass` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
