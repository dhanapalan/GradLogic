// =============================================================================
// Recruitment Management (superadmin) — hiring drives across companies.
// Reuses GET /api/analytics/drives?drive_type=hiring (extended this session
// with company_name + pipeline-stage counts) — no new backend aggregation.
// =============================================================================

import { useQuery } from "@tanstack/react-query";
import { Briefcase, Building2, Users } from "lucide-react";
import api from "../../../lib/api";

interface HiringDrive {
  id: string;
  name: string;
  status: string;
  drive_type: string;
  scheduled_at: string;
  cutoff_score: number | null;
  company_name: string | null;
  total_students: number;
  submitted_count: number;
  avg_score: number | null;
  pass_rate: number | null;
  pipeline_pending: number;
  pipeline_shortlisted: number;
  pipeline_offered: number;
}

export default function RecruitmentManagementPage() {
  const { data: drives, isLoading } = useQuery({
    queryKey: ["superadmin-recruitment-drives"],
    queryFn: async () =>
      (await api.get("/analytics/drives", { params: { drive_type: "hiring" } })).data.data as HiringDrive[],
  });

  const totalOffered = (drives || []).reduce((sum, d) => sum + (d.pipeline_offered || 0), 0);
  const totalShortlisted = (drives || []).reduce((sum, d) => sum + (d.pipeline_shortlisted || 0), 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-navy-900/[0.06] rounded-lg">
          <Briefcase className="w-5 h-5 text-navy-900" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Recruitment Management</h1>
          <p className="text-sm text-gray-500">Hiring drives and candidate pipelines across companies.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-2xl font-bold text-gray-900">{drives?.length ?? 0}</p>
          <p className="text-xs text-gray-500">Hiring drives</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-2xl font-bold text-gray-900">{totalShortlisted}</p>
          <p className="text-xs text-gray-500">Shortlisted candidates</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card p-4">
          <p className="text-2xl font-bold text-gray-900">{totalOffered}</p>
          <p className="text-xs text-gray-500">Offers extended</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
        {isLoading ? (
          <p className="p-6 text-sm text-gray-400">Loading…</p>
        ) : !drives || drives.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No hiring drives yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {drives.map((d) => (
              <div key={d.id} className="p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-navy-900/[0.06] text-navy-900 capitalize">
                      {d.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" /> {d.company_name || "Unknown company"}
                    </span>
                    <span>{new Date(d.scheduled_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" /> {d.submitted_count}/{d.total_students} submitted
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs text-gray-600 space-y-0.5">
                  <p>Pending: <span className="font-medium text-gray-800">{d.pipeline_pending}</span></p>
                  <p>Shortlisted: <span className="font-medium text-amber-700">{d.pipeline_shortlisted}</span></p>
                  <p>Offered: <span className="font-medium text-green-700">{d.pipeline_offered}</span></p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
