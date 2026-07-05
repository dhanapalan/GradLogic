// =============================================================================
// GradLogic — Analytics Dashboard (Phase 3)
// Drive Trends · Cohort Comparison · Skill Heatmap · Student Readiness
// =============================================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "../../lib/api";

// =============================================================================
// TYPES
// =============================================================================
interface DriveRow {
  id: string; name: string; status: string; scheduled_at: string;
  cutoff_score: number; total_students: number; submitted_count: number;
  avg_score: number | null; pass_rate: number | null;
}
interface CohortRow {
  label: string; student_count: number; avg_drive_score: number | null;
  avg_practice_score: number | null; avg_xp: number; pass_rate: number | null;
}
interface HeatmapData {
  heatmap: Record<string, Record<string, number>>;
  raw: any[];
}
interface ReadinessRow {
  id: string; name: string; degree: string; passing_year: number;
  college_name: string; readiness_score: number; xp_score: number;
  practice_score: number; drive_score: number; level: number;
  total_xp: number; practice_sessions: number; drives_taken: number;
}

// =============================================================================
// STAT CARD
// =============================================================================
function StatCard({ label, value, sub, color = "text-indigo-600" }: {
  label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

// =============================================================================
// PROGRESS BAR
// =============================================================================
function Bar({ pct, color = "bg-indigo-500" }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(100, pct || 0)}%` }} />
    </div>
  );
}

// =============================================================================
// OVERVIEW TAB
// =============================================================================
function OverviewTab() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: () => api.get("/analytics/dashboard").then(r => r.data.data),
  });
  const { data: trend = [] } = useQuery({
    queryKey: ["analytics-trend"],
    queryFn: () => api.get("/analytics/trend").then(r => r.data.data),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const segEntries = Object.entries(metrics?.segmentDistribution || {}) as [string, number][];
  const total = metrics?.totalStudents || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={(metrics?.totalStudents ?? 0).toLocaleString()} color="text-indigo-600" />
        <StatCard label="Completion Rate" value={`${metrics?.assessmentCompletionRate ?? 0}%`} color="text-green-600" />
        <StatCard label="Avg Integrity" value={`${metrics?.avgProctoringIntegrity ?? 0}%`} color="text-purple-600" />
        <StatCard label="Active Months" value={trend.length} color="text-orange-600" />
      </div>

      {/* Registration trend */}
      {trend.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Monthly Activity</h3>
          <div className="flex items-end gap-3 h-32">
            {trend.map((t: any) => {
              const maxStudents = Math.max(...trend.map((x: any) => x.students), 1);
              const maxScreened = Math.max(...trend.map((x: any) => x.screened), 1);
              const maxVal = Math.max(maxStudents, maxScreened);
              return (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex gap-0.5 items-end h-24">
                    <div className="flex-1 bg-indigo-400 rounded-t" style={{ height: `${(t.students / maxVal) * 100}%` }} title={`${t.students} students`} />
                    <div className="flex-1 bg-green-400 rounded-t" style={{ height: `${(t.screened / maxVal) * 100}%` }} title={`${t.screened} screened`} />
                  </div>
                  <span className="text-xs text-gray-400">{t.month}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-gray-500">
            <span><span className="inline-block w-3 h-3 bg-indigo-400 rounded mr-1" />Registrations</span>
            <span><span className="inline-block w-3 h-3 bg-green-400 rounded mr-1" />Screened</span>
          </div>
        </div>
      )}

      {/* Segment breakdown */}
      {segEntries.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Degree Distribution</h3>
          <div className="space-y-3">
            {segEntries.sort((a, b) => (b[1] as number) - (a[1] as number)).map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{name}</span>
                  <span className="text-gray-500">{count} ({((count / total) * 100).toFixed(1)}%)</span>
                </div>
                <Bar pct={(count / total) * 100} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// DRIVES TAB
// =============================================================================
function DrivesTab() {
  const [selectedDrive, setSelectedDrive] = useState<string | null>(null);

  const { data: drives = [], isLoading } = useQuery<DriveRow[]>({
    queryKey: ["analytics-drives"],
    queryFn: () => api.get("/analytics/drives").then(r => r.data.data),
  });

  const { data: driveDetail } = useQuery({
    queryKey: ["analytics-drive-detail", selectedDrive],
    queryFn: () => api.get(`/analytics/drives/${selectedDrive}`).then(r => r.data.data),
    enabled: !!selectedDrive,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const statusColor: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    completed: "bg-blue-100 text-blue-700",
    draft: "bg-gray-100 text-gray-600",
    archived: "bg-red-100 text-red-600",
  };

  return (
    <div className="space-y-4">
      {!selectedDrive ? (
        <>
          <p className="text-sm text-gray-500">Click a drive to see detailed breakdown.</p>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  {["Drive", "Status", "Students", "Submitted", "Avg Score", "Pass Rate"].map(h => (
                    <th key={h} className="px-4 py-3 text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {drives.map(d => (
                  <tr key={d.id} className="hover:bg-indigo-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedDrive(d.id)}>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">{d.name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[d.status] || "bg-gray-100 text-gray-600"}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{d.total_students}</td>
                    <td className="px-4 py-3 text-gray-600">{d.submitted_count}</td>
                    <td className="px-4 py-3 font-medium text-indigo-600">{d.avg_score ?? "—"}</td>
                    <td className="px-4 py-3">
                      {d.pass_rate !== null ? (
                        <span className={`font-medium ${d.pass_rate >= 60 ? "text-green-600" : "text-red-500"}`}>{d.pass_rate}%</span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
                {drives.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">No drives found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <button onClick={() => setSelectedDrive(null)} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
            ← Back to all drives
          </button>

          {!driveDetail ? (
            <div className="text-center py-12 text-gray-400">Loading detail...</div>
          ) : (
            <>
              <h3 className="font-semibold text-gray-800 text-lg">{driveDetail.overview?.name}</h3>

              {/* Overview stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Students" value={driveDetail.overview?.total_students ?? 0} />
                <StatCard label="Avg Score" value={`${driveDetail.overview?.avg_score ?? 0}%`} color="text-indigo-600" />
                <StatCard label="Median" value={`${driveDetail.overview?.median_score ?? 0}%`} color="text-purple-600" />
                <StatCard label="Pass Rate" value={`${driveDetail.overview?.pass_rate ?? 0}%`}
                  color={(driveDetail.overview?.pass_rate ?? 0) >= 60 ? "text-green-600" : "text-red-500"} />
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Score distribution */}
                {driveDetail.score_distribution?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h4 className="font-medium text-gray-700 mb-3 text-sm">Score Distribution</h4>
                    <div className="space-y-2">
                      {driveDetail.score_distribution.map((b: any) => {
                        const maxCount = Math.max(...driveDetail.score_distribution.map((x: any) => x.count), 1);
                        return (
                          <div key={b.range} className="flex items-center gap-2 text-xs">
                            <span className="w-14 text-gray-500 text-right">{b.range}%</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                              <div className="bg-indigo-400 h-4 rounded-full flex items-center justify-end pr-1 text-white text-[10px]"
                                style={{ width: `${(b.count / maxCount) * 100}%` }}>
                                {b.count > 0 ? b.count : ""}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Category performance */}
                {driveDetail.category_performance?.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h4 className="font-medium text-gray-700 mb-3 text-sm">Category Performance</h4>
                    <div className="space-y-2">
                      {driveDetail.category_performance.map((c: any) => (
                        <div key={c.category}>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>{c.category}</span>
                            <span className={Number(c.avg_correct_pct) < 50 ? "text-red-500 font-medium" : "text-green-600 font-medium"}>
                              {c.avg_correct_pct}%
                            </span>
                          </div>
                          <Bar pct={Number(c.avg_correct_pct)}
                            color={Number(c.avg_correct_pct) < 50 ? "bg-red-400" : Number(c.avg_correct_pct) < 70 ? "bg-yellow-400" : "bg-green-400"} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Top students */}
              {driveDetail.top_students?.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h4 className="font-medium text-gray-700 mb-3 text-sm">Top 10 Students</h4>
                  <div className="space-y-1">
                    {driveDetail.top_students.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 py-1.5">
                        <span className="text-xs font-bold text-gray-400 w-5">#{i + 1}</span>
                        <span className="flex-1 text-sm text-gray-700">{s.name}</span>
                        <span className="text-sm font-semibold text-indigo-600">{s.score}%</span>
                        <span className="text-xs text-gray-400">Lv {s.level}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// COHORT TAB
// =============================================================================
function CohortTab() {
  const [groupBy, setGroupBy] = useState("college");

  const { data: rows = [], isLoading } = useQuery<CohortRow[]>({
    queryKey: ["analytics-cohort", groupBy],
    queryFn: () => api.get(`/analytics/cohort?group_by=${groupBy}`).then(r => r.data.data),
  });

  const maxDrive = Math.max(...rows.map(r => Number(r.avg_drive_score) || 0), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Group by:</span>
        {[["college", "College"], ["degree", "Degree"], ["year", "Batch Year"]].map(([val, label]) => (
          <button key={val} onClick={() => setGroupBy(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${groupBy === val ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{groupBy === "college" ? "College" : groupBy === "degree" ? "Degree" : "Batch Year"}</th>
                <th className="px-4 py-3 text-right">Students</th>
                <th className="px-4 py-3 text-right">Avg Drive Score</th>
                <th className="px-4 py-3 text-right">Avg Practice</th>
                <th className="px-4 py-3 text-right">Avg XP</th>
                <th className="px-4 py-3 text-right">Pass Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px]">
                    <div className="truncate">{r.label}</div>
                    <div className="mt-1">
                      <Bar pct={((Number(r.avg_drive_score) || 0) / maxDrive) * 100} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.student_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-indigo-600">{r.avg_drive_score ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.avg_practice_score ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{r.avg_xp?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {r.pass_rate !== null ? (
                      <span className={`font-medium ${Number(r.pass_rate) >= 60 ? "text-green-600" : "text-red-500"}`}>{r.pass_rate}%</span>
                    ) : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">No data yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SKILL HEATMAP TAB
// =============================================================================
function SkillHeatmapTab() {
  const { data, isLoading } = useQuery<HeatmapData>({
    queryKey: ["analytics-skill-heatmap"],
    queryFn: () => api.get("/analytics/skill-heatmap").then(r => r.data.data),
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const heatmap = data?.heatmap || {};
  const categories = Object.keys(heatmap).sort();
  const difficulties = ["easy", "medium", "hard"];

  const cellColor = (val: number | undefined) => {
    if (val === undefined) return "bg-gray-50 text-gray-300";
    if (val >= 80) return "bg-green-500 text-white";
    if (val >= 60) return "bg-yellow-400 text-white";
    if (val >= 40) return "bg-orange-400 text-white";
    return "bg-red-500 text-white";
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Accuracy % by category and difficulty. Red = needs attention, Green = strong.</p>

      {categories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12 text-gray-400">
          No practice attempt data yet. Students need to complete practice sessions first.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Category</th>
                {difficulties.map(d => <th key={d} className="px-4 py-3 text-center capitalize">{d}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map(cat => (
                <tr key={cat}>
                  <td className="px-4 py-3 font-medium text-gray-700">{cat}</td>
                  {difficulties.map(diff => {
                    const val = heatmap[cat]?.[diff];
                    return (
                      <td key={diff} className="px-4 py-3 text-center">
                        <span className={`inline-block px-3 py-1 rounded-lg font-medium text-xs ${cellColor(val)}`}>
                          {val !== undefined ? `${val}%` : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="px-4 py-3 bg-gray-50 flex gap-3 text-xs text-gray-500">
            <span>Legend:</span>
            {[["bg-green-500", "≥ 80%"], ["bg-yellow-400", "60–79%"], ["bg-orange-400", "40–59%"], ["bg-red-500", "< 40%"]].map(([cls, label]) => (
              <span key={label} className="flex items-center gap-1">
                <span className={`inline-block w-3 h-3 rounded ${cls}`} />{label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// READINESS TAB
// =============================================================================
function ReadinessTab() {
  const [page, setPage] = useState(0);
  const PER_PAGE = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics-readiness", page],
    queryFn: () => api.get(`/analytics/readiness?limit=${PER_PAGE}&offset=${page * PER_PAGE}`).then(r => r.data),
  });

  const rows: ReadinessRow[] = data?.data || [];
  const total: number = data?.meta?.total || 0;

  const readinessColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    if (score >= 25) return "text-orange-500";
    return "text-red-500";
  };

  const readinessBg = (score: number) => {
    if (score >= 75) return "bg-green-500";
    if (score >= 50) return "bg-yellow-400";
    if (score >= 25) return "bg-orange-400";
    return "bg-red-500";
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Composite score: 20% XP + 35% Practice avg + 45% Drive avg. Sorted by lowest readiness first (priority view).
      </p>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">College</th>
                  <th className="px-4 py-3 text-center">Readiness</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Practice</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">Drive Avg</th>
                  <th className="px-4 py-3 text-center hidden md:table-cell">XP</th>
                  <th className="px-4 py-3 text-center">Drives</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{r.name}</div>
                      <div className="text-xs text-gray-400">{r.degree} · {r.passing_year}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{r.college_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`font-bold text-sm ${readinessColor(Number(r.readiness_score))}`}>
                          {Number(r.readiness_score).toFixed(0)}
                        </span>
                        <div className="w-16 bg-gray-100 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${readinessBg(Number(r.readiness_score))}`}
                            style={{ width: `${r.readiness_score}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{r.practice_score ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-600 hidden md:table-cell">{r.drive_score ?? "—"}</td>
                    <td className="px-4 py-3 text-center text-gray-500 hidden md:table-cell text-xs">{(r.total_xp || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{r.drives_taken}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">No data found</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > PER_PAGE && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, total)} of {total}</span>
              <div className="flex gap-2">
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">← Prev</button>
                <button disabled={(page + 1) * PER_PAGE >= total} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =============================================================================
// MAIN PAGE
// =============================================================================

type Tab = "overview" | "drives" | "cohort" | "heatmap" | "readiness";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview",  label: "Overview" },
  { id: "drives",    label: "Drive Performance" },
  { id: "cohort",    label: "Cohort Comparison" },
  { id: "heatmap",   label: "Skill Heatmap" },
  { id: "readiness", label: "Student Readiness" },
];

export default function AnalyticsPage() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-500 text-sm mt-1">Recruitment funnel, cohort insights and student readiness</p>
      </div>

      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview"  && <OverviewTab />}
      {tab === "drives"    && <DrivesTab />}
      {tab === "cohort"    && <CohortTab />}
      {tab === "heatmap"   && <SkillHeatmapTab />}
      {tab === "readiness" && <ReadinessTab />}
    </div>
  );
}
