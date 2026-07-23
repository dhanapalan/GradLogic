import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Rocket,
  TrendingUp,
  Briefcase,
  UserPlus,
  Building2,
  CalendarClock,
  ClipboardList,
  BookOpen,
  Gauge,
  ArrowRight,
  FileBarChart,
  Route,
  CheckCircle2,
} from "lucide-react";
import StatsCard from "../../components/superadmin/StatsCard";
import ChartCard from "../../components/superadmin/ChartCard";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import collegePortalMetrics, {
  type DashboardFilters,
} from "../../services/collegePortalMetrics";
import { useAuthStore } from "../../stores/authStore";

const EMPTY_FILTERS: DashboardFilters = {
  academic_year: "",
  department: "",
  batch: "",
  semester: "",
};

function cleanFilters(f: DashboardFilters): DashboardFilters {
  return {
    academic_year: f.academic_year || undefined,
    department: f.department || undefined,
    batch: f.batch || undefined,
    semester: f.semester || undefined,
  };
}

function SectionError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
      {message}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-gray-500">{children}</p>;
}

export default function CollegePortalDashboard() {
  const role = useAuthStore((s) => s.user?.role ?? "");
  const [draft, setDraft] = useState<DashboardFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<DashboardFilters>({});

  const filterKey = useMemo(() => JSON.stringify(applied), [applied]);

  const filterOptionsQ = useQuery({
    queryKey: ["college-portal", "filter-options"],
    queryFn: () => collegePortalMetrics.getFilterOptions(),
    staleTime: 120_000,
  });

  const summaryQ = useQuery({
    queryKey: ["college-portal", "dashboard", "summary", filterKey],
    queryFn: () => collegePortalMetrics.getSummary(applied),
    staleTime: 60_000,
  });

  const chartsQ = useQuery({
    queryKey: ["college-portal", "dashboard", "charts", filterKey],
    queryFn: () => collegePortalMetrics.getCharts(applied),
    staleTime: 60_000,
  });

  const activitiesQ = useQuery({
    queryKey: ["college-portal", "dashboard", "activities", filterKey],
    queryFn: () => collegePortalMetrics.getActivities(applied),
    staleTime: 60_000,
  });

  const pendingQ = useQuery({
    queryKey: ["college-portal", "dashboard", "pending", filterKey],
    queryFn: () => collegePortalMetrics.getPendingActions(applied),
    staleTime: 60_000,
  });

  const summary = summaryQ.data;
  const charts = chartsQ.data;
  const activities = activitiesQ.data;
  const pending = pendingQ.data;
  const opts = filterOptionsQ.data;

  const vis = summary?.visibility ?? {
    placement_kpis: role !== "instructor",
    academic_kpis: role !== "placement_cell",
    full: role !== "instructor" && role !== "placement_cell",
  };

  const isPlacementRole = role === "placement_cell";
  const isFacultyRole = role === "instructor";

  const profileHref =
    isPlacementRole || isFacultyRole
      ? "/app/college-profile"
      : "/app/college-portal/settings";

  const quickActions = [
    {
      label: "College Profile",
      href: profileHref,
      icon: Building2,
      show: true,
    },
    {
      label: "Add Student",
      href: "/app/college-portal/students/new",
      icon: UserPlus,
      show: !isFacultyRole,
    },
    {
      label: "Create Placement Drive",
      href: "/app/college-portal/drives",
      icon: Briefcase,
      show: !isFacultyRole,
    },
    {
      label: "Manage Assessments",
      href: "/app/college-portal/assessments",
      icon: ClipboardList,
      show: !isPlacementRole,
    },
    {
      label: "Assign Learning Path",
      href: "/app/college-portal/workflows",
      icon: Route,
      show: !isPlacementRole,
    },
    {
      label: "View Reports",
      href: "/app/college-portal/analytics",
      icon: FileBarChart,
      show: true,
    },
  ].filter((a) => a.show);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">College Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Campus KPIs, placement pipeline, assessments, and learning progress
          </p>
        </div>
        {!isPlacementRole && (
          <div className="flex flex-wrap gap-2">
            <Link to="/app/college-portal/students">
              <Button variant="outline" type="button">
                <Users className="h-4 w-4" />
                Manage Students
              </Button>
            </Link>
            <Link to="/app/college-portal/students/new">
              <Button type="button">
                <UserPlus className="h-4 w-4" />
                Register Student
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Scope KPIs and charts by academic context</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect
              label="Academic Year"
              value={draft.academic_year || ""}
              options={opts?.academic_years ?? []}
              onChange={(v) => setDraft((d) => ({ ...d, academic_year: v }))}
            />
            <FilterSelect
              label="Department"
              value={draft.department || ""}
              options={opts?.departments ?? []}
              onChange={(v) => setDraft((d) => ({ ...d, department: v }))}
              disabled={Boolean(summary?.filters_applied?.department && isFacultyRole)}
            />
            <FilterSelect
              label="Batch"
              value={draft.batch || ""}
              options={opts?.batches ?? []}
              onChange={(v) => setDraft((d) => ({ ...d, batch: v }))}
            />
            <FilterSelect
              label="Semester"
              value={draft.semester || ""}
              options={opts?.semesters ?? []}
              onChange={(v) => setDraft((d) => ({ ...d, semester: v }))}
            />
            <div className="flex items-end gap-2">
              <Button
                type="button"
                className="flex-1"
                onClick={() => setApplied(cleanFilters(draft))}
              >
                Apply
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setApplied({});
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI grid */}
      {summaryQ.isError && <SectionError message="Could not load summary KPIs." />}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <KpiLink to="/app/college-portal/students">
          <StatsCard
            title="Total Students"
            value={summary?.total_students ?? "—"}
            subtitle={`${summary?.active_students ?? 0} active`}
            icon={<Users className="h-4 w-4" />}
            color="blue"
            loading={summaryQ.isLoading}
          />
        </KpiLink>
        {vis.placement_kpis && (
          <>
            <KpiLink to="/app/college-portal/students?filter=eligible">
              <StatsCard
                title="Placement Eligible"
                value={summary?.placement_eligible ?? "—"}
                subtitle="Ready for hiring"
                icon={<CheckCircle2 className="h-4 w-4" />}
                color="emerald"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            <KpiLink to="/app/college-portal/students?filter=placed">
              <StatsCard
                title="Students Placed"
                value={summary?.students_placed ?? "—"}
                subtitle={`${summary?.placement_conversion ?? 0}% conversion`}
                icon={<Briefcase className="h-4 w-4" />}
                color="indigo"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            <KpiLink to="/app/college-portal/drives">
              <StatsCard
                title="Active Drives"
                value={summary?.active_placement_drives ?? "—"}
                subtitle="Placement / assessment drives"
                icon={<Rocket className="h-4 w-4" />}
                color="violet"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            <KpiLink to="/app/college-portal/workflows">
              <StatsCard
                title="Companies Visiting"
                value={summary?.companies_visiting ?? "—"}
                subtitle="Distinct companies"
                icon={<Building2 className="h-4 w-4" />}
                color="cyan"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            <KpiLink to="/app/college-portal/workflows">
              <StatsCard
                title="Upcoming Interviews"
                value={summary?.upcoming_interviews ?? "—"}
                subtitle="Interview pipeline"
                icon={<CalendarClock className="h-4 w-4" />}
                color="amber"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
          </>
        )}
        {vis.academic_kpis && (
          <>
            <KpiLink to="/app/college-portal/drives">
              <StatsCard
                title="Pending Assessments"
                value={summary?.pending_assessments ?? "—"}
                subtitle="Awaiting completion"
                icon={<ClipboardList className="h-4 w-4" />}
                color="orange"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            <KpiLink to="/app/college-portal/workflows">
              <StatsCard
                title="Learning Completion"
                value={
                  summary?.learning_completion_percent != null
                    ? `${summary.learning_completion_percent.toFixed(1)}%`
                    : "—"
                }
                subtitle="Journey progress"
                icon={<BookOpen className="h-4 w-4" />}
                color="emerald"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            <KpiLink to="/app/college-portal/analytics">
              <StatsCard
                title="Avg Readiness"
                value={
                  summary?.avg_placement_readiness != null
                    ? `${summary.avg_placement_readiness.toFixed(1)}`
                    : "—"
                }
                subtitle="Placement readiness score"
                icon={<Gauge className="h-4 w-4" />}
                color="indigo"
                loading={summaryQ.isLoading}
              />
            </KpiLink>
            {!vis.placement_kpis && (
              <KpiLink to="/app/college-portal/analytics">
                <StatsCard
                  title="Avg Score"
                  value={summary != null ? `${summary.avg_score.toFixed(1)}%` : "—"}
                  subtitle="Assessment performance"
                  icon={<TrendingUp className="h-4 w-4" />}
                  color="blue"
                  loading={summaryQ.isLoading}
                />
              </KpiLink>
            )}
          </>
        )}
      </div>

      {/* Charts */}
      {chartsQ.isError && <SectionError message="Could not load charts." />}
      <div className="grid gap-4 lg:grid-cols-2">
        {charts?.visibility.department_placement !== false && (
          <ChartCard
            title="Department-wise Placement %"
            subtitle="Placed / total by department"
            data={charts?.department_placement_percent ?? []}
            variant="bar"
            color="emerald"
            loading={chartsQ.isLoading}
          />
        )}
        {charts?.visibility.placement_trend !== false && (
          <ChartCard
            title="Placement Trend"
            subtitle="Offers over time"
            data={charts?.placement_trend ?? []}
            variant="area"
            color="indigo"
            loading={chartsQ.isLoading}
          />
        )}
        {charts?.visibility.readiness_distribution !== false && (
          <ChartCard
            title="Student Readiness Distribution"
            subtitle="Placement readiness bands"
            data={charts?.readiness_distribution ?? []}
            variant="bar"
            color="violet"
            loading={chartsQ.isLoading}
          />
        )}
        {charts?.visibility.assessment_completion !== false && (
          <ChartCard
            title="Assessment Completion"
            subtitle="Assigned vs completed"
            data={charts?.assessment_completion ?? []}
            variant="bar"
            color="blue"
            loading={chartsQ.isLoading}
          />
        )}
        {charts?.visibility.learning_progress !== false && (
          <ChartCard
            title="Learning Progress"
            subtitle="Journey completion bands"
            data={charts?.learning_progress ?? []}
            variant="area"
            color="cyan"
            loading={chartsQ.isLoading}
          />
        )}
        {charts?.visibility.offer_stats !== false && (
          <ChartCard
            title="Offer Statistics"
            subtitle="Shortlist → join funnel"
            data={charts?.offer_stats ?? []}
            variant="bar"
            color="emerald"
            loading={chartsQ.isLoading}
          />
        )}
      </div>

      {/* Activities + Pending */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>Latest campus events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activitiesQ.isError && <SectionError message="Could not load activities." />}
            {activitiesQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : (
              <>
                <ActivityBlock
                  title="Recently registered students"
                  empty="No recent students."
                  items={(activities?.recently_registered_students ?? []).map((s) => ({
                    key: s.id,
                    primary: s.name,
                    secondary: s.email,
                    href: `/app/college-portal/students/${s.id}`,
                  }))}
                />
                {(activities?.latest_placement_drives?.length ?? 0) > 0 && (
                  <ActivityBlock
                    title="Latest placement drives"
                    empty="No drives yet."
                    items={(activities?.latest_placement_drives ?? []).map((d) => ({
                      key: d.id,
                      primary: d.name,
                      secondary: d.status,
                      href: `/app/college-portal/drives/${d.id}`,
                    }))}
                  />
                )}
                {(activities?.recent_assessment_results?.length ?? 0) > 0 && (
                  <ActivityBlock
                    title="Recent assessment results"
                    empty="No results yet."
                    items={(activities?.recent_assessment_results ?? []).map((r, i) => ({
                      key: `${r.student_name}-${i}`,
                      primary: r.student_name,
                      secondary: `${r.drive_name}${r.score != null ? ` · ${r.score}%` : ""}`,
                      href: "/app/college-portal/drives",
                    }))}
                  />
                )}
                {(activities?.latest_offers?.length ?? 0) > 0 && (
                  <ActivityBlock
                    title="Latest offers"
                    empty="No offers yet."
                    items={(activities?.latest_offers ?? []).map((o, i) => ({
                      key: `${o.student_name}-offer-${i}`,
                      primary: o.student_name,
                      secondary: [o.company, o.status].filter(Boolean).join(" · "),
                      href: "/app/college-portal/students?filter=placed",
                    }))}
                  />
                )}
                {!activitiesQ.isLoading &&
                  !(activities?.recently_registered_students?.length) &&
                  !(activities?.latest_placement_drives?.length) &&
                  !(activities?.recent_assessment_results?.length) &&
                  !(activities?.latest_offers?.length) && (
                    <EmptyHint>No recent activity for this campus yet.</EmptyHint>
                  )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Actions</CardTitle>
            <CardDescription>Items that need attention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingQ.isError && <SectionError message="Could not load pending actions." />}
            {pendingQ.isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-gray-100" />
                ))}
              </div>
            ) : (pending?.items ?? []).length === 0 ? (
              <EmptyHint>No pending actions.</EmptyHint>
            ) : (
              (pending?.items ?? []).map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2.5 text-sm transition-colors hover:border-gray-200 hover:bg-slate-50"
                >
                  <span className="font-medium text-gray-700">{item.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums font-semibold text-admin-accent">{item.count}</span>
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Navigate to campus workflows (modules may be Coming Soon)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.label}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block transition-opacity hover:opacity-90">
      {children}
    </Link>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-xs font-medium text-gray-600">
      {label}
      <select
        className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-800 disabled:bg-gray-50"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActivityBlock({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ key: string; primary: string; secondary?: string; href: string }>;
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <EmptyHint>{empty}</EmptyHint>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <ul className="space-y-1">
        {items.slice(0, 5).map((item) => (
          <li key={item.key}>
            <Link
              to={item.href}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <span>
                <span className="font-medium text-gray-800">{item.primary}</span>
                {item.secondary && (
                  <span className="ml-2 text-xs text-gray-500">{item.secondary}</span>
                )}
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
