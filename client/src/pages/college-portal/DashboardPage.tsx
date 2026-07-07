import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Rocket,
  TrendingUp,
  ShieldCheck,
  Briefcase,
  UserPlus,
  Upload,
  ArrowRight,
} from "lucide-react";
import StatsCard from "../../components/superadmin/StatsCard";
import ChartCard from "../../components/superadmin/ChartCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import collegePortalMetrics from "../../services/collegePortalMetrics";

export default function CollegePortalDashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["college-portal", "dashboard"],
    queryFn: () => collegePortalMetrics.getDashboard(),
    staleTime: 60_000,
  });

  const summary = data?.summary;
  const performance = data?.performance;
  const placement = data?.placement;
  const integrity = data?.integrity;
  const topPerformers = data?.topPerformers ?? [];

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Campus hiring overview — students, drives, and placement pipeline
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/college-portal/students">
            <Button variant="outline" type="button">
              <Users className="h-4 w-4" />
              Manage Students
            </Button>
          </Link>
          <Link to="/app/students/new">
            <Button type="button">
              <UserPlus className="h-4 w-4" />
              Register Student
            </Button>
          </Link>
        </div>
      </div>

      {isError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Could not load dashboard metrics. Please refresh or try again later.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatsCard
          title="Total Students"
          value={summary?.total_students ?? "—"}
          subtitle={`${summary?.active_students ?? 0} active`}
          icon={<Users className="h-4 w-4" />}
          color="blue"
          loading={isLoading}
        />
        <StatsCard
          title="Active Drives"
          value={summary?.active_drives ?? "—"}
          subtitle="Assessments in progress"
          icon={<Rocket className="h-4 w-4" />}
          color="violet"
          loading={isLoading}
        />
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
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        <StatsCard
          title="Avg. Integrity"
          value={summary ? `${summary.avg_integrity.toFixed(1)}%` : "—"}
          subtitle="Proctoring trust score"
          icon={<ShieldCheck className="h-4 w-4" />}
          color="cyan"
          loading={isLoading}
        />
        <StatsCard
          title="High Risk"
          value={integrity?.risk_summary.high_risk_students ?? "—"}
          subtitle={`${integrity?.risk_summary.total_violations ?? 0} violations`}
          icon={<ShieldCheck className="h-4 w-4" />}
          color="rose"
          loading={isLoading}
        />
        <StatsCard
          title="Pipeline"
          value={placement?.funnel.shortlisted ?? "—"}
          subtitle="Shortlisted candidates"
          icon={<Briefcase className="h-4 w-4" />}
          color="amber"
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

      {/* Bottom row: quick actions + top performers */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common TPO tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "View all students", href: "/app/college-portal/students", icon: Users },
              { label: "Bulk upload students", href: "/app/students/bulk-import", icon: Upload },
              { label: "Tests & assessments", href: "/app/college-portal/assessments", icon: Rocket },
            ].map((action) => (
              <Link
                key={action.href}
                to={action.href}
                className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-gray-200 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <action.icon className="h-4 w-4 text-admin-accent" />
                  {action.label}
                </span>
                <ArrowRight className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
            <CardDescription>Highest scoring students this cycle</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : topPerformers.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No assessment data yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4 font-semibold">#</th>
                      <th className="pb-2 pr-4 font-semibold">Student</th>
                      <th className="pb-2 pr-4 font-semibold">CGPA</th>
                      <th className="pb-2 pr-4 font-semibold">Score</th>
                      <th className="pb-2 font-semibold">Integrity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topPerformers.slice(0, 5).map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2.5 pr-4 font-medium text-gray-400">{p.rank}</td>
                        <td className="py-2.5 pr-4 font-medium text-gray-900">{p.student}</td>
                        <td className="py-2.5 pr-4 tabular-nums">{p.cgpa?.toFixed(2) ?? "—"}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-emerald-700">
                          {p.avg_score?.toFixed(1)}%
                        </td>
                        <td className="py-2.5 tabular-nums">{p.integrity?.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
