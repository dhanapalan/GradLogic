import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Users,
  TrendingUp,
  ShieldCheck,
  Briefcase,
  Download,
  AlertTriangle,
  Ban,
} from "lucide-react";
import StatsCard from "../../components/superadmin/StatsCard";
import ChartCard from "../../components/superadmin/ChartCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import collegePortalMetrics from "../../services/collegePortalMetrics";

/** CSV download helper — quotes any value containing a comma, quote, or newline. */
function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Colour band for a skill strength label. */
function strengthTone(strength: string) {
  const s = strength.toLowerCase();
  if (s === "strong") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "moderate" || s === "average") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

/** Bar tint for a 0–100 skill score. */
function scoreBar(score: number) {
  if (score >= 75) return "bg-emerald-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-rose-500";
}

export default function CollegePortalAnalytics() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["college-portal", "analytics"],
    queryFn: () => collegePortalMetrics.getDashboard(),
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const performance = data?.performance;
  const placement = data?.placement;
  const integrity = data?.integrity;

  const scoreChart =
    performance?.score_distribution?.map((d) => ({ label: d.range, value: d.count })) ?? [];

  const placementChart = placement
    ? [
        { label: "Appeared", value: placement.funnel.appeared },
        { label: "Passed", value: placement.funnel.passed },
        { label: "Shortlisted", value: placement.funnel.shortlisted },
        { label: "Offered", value: placement.funnel.offered },
        { label: "Joined", value: placement.funnel.joined },
      ]
    : [];

  const integrityChart =
    integrity?.trend?.map((d) => ({ label: d.drive_name, value: Math.round(d.avg_integrity) })) ?? [];

  const heatmap = performance?.skill_heatmap ?? [];

  const exportSkillGaps = () =>
    downloadCsv(
      "skill-gaps.csv",
      ["Skill", "Average Score", "Strength"],
      heatmap.map((h) => [h.skill, h.avg_score, h.strength])
    );

  const exportPlacement = () =>
    downloadCsv(
      "placement-funnel.csv",
      ["Stage", "Count"],
      placementChart.map((p) => [p.label, p.value])
    );

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BarChart3 className="h-4 w-4" /> Analytics &amp; Reports
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            Analytics &amp; Reports
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Readiness, placement pipeline, and skill-gap insights for your campus
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" onClick={exportSkillGaps} disabled={heatmap.length === 0}>
            <Download className="h-4 w-4" />
            Skill Gaps CSV
          </Button>
          <Button variant="outline" type="button" onClick={exportPlacement} disabled={placementChart.length === 0}>
            <Download className="h-4 w-4" />
            Placement CSV
          </Button>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load analytics. Please refresh or try again later.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatsCard
          title="Avg. Score"
          value={summary ? `${summary.avg_score.toFixed(1)}%` : "—"}
          subtitle="Campus-wide performance"
          icon={<TrendingUp className="h-4 w-4" />}
          color="emerald"
          loading={isLoading}
        />
        <StatsCard
          title="Placement Rate"
          value={summary ? `${summary.placement_conversion.toFixed(1)}%` : "—"}
          subtitle={`${summary?.placed_students ?? 0} placed`}
          icon={<Briefcase className="h-4 w-4" />}
          color="indigo"
          loading={isLoading}
        />
        <StatsCard
          title="Avg. Integrity"
          value={summary ? `${summary.avg_integrity.toFixed(1)}%` : "—"}
          subtitle="Proctoring trust score"
          icon={<ShieldCheck className="h-4 w-4" />}
          color="cyan"
          loading={isLoading}
        />
        <StatsCard
          title="Avg. Package"
          value={placement && placement.avg_package ? `₹${(placement.avg_package / 100000).toFixed(1)}L` : "—"}
          subtitle="Offered CTC"
          icon={<Users className="h-4 w-4" />}
          color="violet"
          loading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Score Distribution"
          subtitle="Students by performance band"
          data={scoreChart}
          variant="bar"
          color="blue"
          loading={isLoading}
        />
        <ChartCard
          title="Placement Funnel"
          subtitle="Campus hiring pipeline"
          data={placementChart}
          variant="bar"
          color="emerald"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Integrity Trend"
          subtitle="Average proctoring score by drive"
          data={integrityChart}
          variant="area"
          color="cyan"
          loading={isLoading}
        />

        {/* Risk summary */}
        <Card>
          <CardHeader>
            <CardTitle>Integrity Risk Summary</CardTitle>
            <CardDescription>Proctoring flags across your campus</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-3 text-center">
                  <AlertTriangle className="mx-auto h-4 w-4 text-rose-600" />
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                    {integrity?.risk_summary.high_risk_students ?? 0}
                  </p>
                  <p className="text-xs text-gray-500">High-risk students</p>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-3 text-center">
                  <ShieldCheck className="mx-auto h-4 w-4 text-amber-600" />
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                    {integrity?.risk_summary.total_violations ?? 0}
                  </p>
                  <p className="text-xs text-gray-500">Total violations</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-center">
                  <Ban className="mx-auto h-4 w-4 text-gray-500" />
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                    {integrity?.risk_summary.terminations ?? 0}
                  </p>
                  <p className="text-xs text-gray-500">Terminations</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skill heatmap */}
      <Card>
        <CardHeader>
          <CardTitle>Skill Gap Analysis</CardTitle>
          <CardDescription>Average performance by skill area — spot where students need support</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : heatmap.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No skill data yet.</p>
          ) : (
            <div className="space-y-3">
              {heatmap.map((h) => (
                <div key={h.skill} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 truncate text-sm font-medium text-gray-700">{h.skill}</div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full ${scoreBar(h.avg_score)}`}
                      style={{ width: `${Math.max(0, Math.min(100, h.avg_score))}%` }}
                    />
                  </div>
                  <div className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums text-gray-900">
                    {h.avg_score.toFixed(0)}%
                  </div>
                  <span
                    className={`w-24 shrink-0 rounded-full border px-2 py-0.5 text-center text-xs font-medium ${strengthTone(
                      h.strength
                    )}`}
                  >
                    {h.strength}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
