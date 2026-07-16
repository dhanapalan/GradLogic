// =============================================================================
// Assessment Hub Dashboard — Super Admin operational overview
// Placement Prep domains: Quantitative Aptitude, Logical Reasoning, Python,
// Java, AI Fundamentals. Navigate-only quick actions; no module builders here.
// =============================================================================

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardList,
  FlaskConical,
  FileStack,
  Code2,
  CheckCircle2,
  FileEdit,
  Users,
  Percent,
  Trophy,
  Loader2,
  Plus,
  BarChart3,
  Search,
  Clock,
  AlertCircle,
  Archive,
  BookOpen,
  PlayCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import ChartCard from "../../../components/superadmin/ChartCard";
import assessmentHubService, {
  type AssessmentHubDashboard,
  type AssessmentHubDashboardFilters,
} from "../../../services/assessmentHubService";
import AssessmentKpiCard from "./AssessmentKpiCard";
import { DASHBOARD_DOMAINS } from "./dashboardDomains";

const EMPTY_FILTERS: AssessmentHubDashboardFilters = {
  domain: "",
  status: "",
  drive_type: "",
  created_by: "",
  from: "",
  to: "",
};

function activityIcon(type: string) {
  switch (type) {
    case "assessment_published":
      return CheckCircle2;
    case "mock_test_created":
      return FileStack;
    case "practice_set_updated":
      return FlaskConical;
    case "student_attempt_completed":
      return PlayCircle;
    case "assessment_archived":
      return Archive;
    default:
      return BookOpen;
  }
}

function activityLabel(type: string) {
  switch (type) {
    case "assessment_published":
      return "Assessment Published";
    case "mock_test_created":
      return "Mock Test Created";
    case "practice_set_updated":
      return "Practice Set Updated";
    case "student_attempt_completed":
      return "Student Attempt Completed";
    case "assessment_archived":
      return "Assessment Archived";
    default:
      return "Assessment Updated";
  }
}

function formatWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export default function AssessmentHubDashboardPage() {
  const [stats, setStats] = useState<AssessmentHubDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<AssessmentHubDashboardFilters>({ ...EMPTY_FILTERS });
  const [searchPlaceholder, setSearchPlaceholder] = useState("");

  const load = useCallback((f: AssessmentHubDashboardFilters) => {
    setLoading(true);
    setError(null);
    const clean: AssessmentHubDashboardFilters = {
      domain: f.domain || undefined,
      status: f.status || undefined,
      drive_type: f.drive_type || undefined,
      created_by: f.created_by || undefined,
      from: f.from || undefined,
      to: f.to || undefined,
    };
    assessmentHubService
      .getDashboard(clean)
      .then(setStats)
      .catch((err) => {
        const msg =
          err?.response?.data?.error || err?.message || "Failed to load dashboard";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(filters);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — initial load only

  const applyFilters = () => load(filters);
  const clearFilters = () => {
    const next = { ...EMPTY_FILTERS };
    setFilters(next);
    load(next);
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-800">
        {error}
      </div>
    );
  }

  if (!stats) return null;

  const { kpis, charts, recentActivity, pending, filterOptions, generatedAt } = stats;
  const domainOptions =
    filterOptions?.domains?.length > 0 ? filterOptions.domains : [...DASHBOARD_DOMAINS];

  const kpiCards = [
    {
      key: "assessments",
      label: "Total Assessments",
      kpi: kpis.assessments,
      icon: ClipboardList,
      accent: "navy" as const,
    },
    {
      key: "practice",
      label: "Practice Sets",
      kpi: kpis.practiceSets,
      icon: FlaskConical,
      accent: "blue" as const,
    },
    {
      key: "mock",
      label: "Mock Tests",
      kpi: kpis.mockTests,
      icon: FileStack,
      accent: "purple" as const,
    },
    {
      key: "coding",
      label: "Coding Assessments",
      kpi: kpis.codingAssessments,
      icon: Code2,
      accent: "amber" as const,
    },
    {
      key: "published",
      label: "Published Assessments",
      kpi: kpis.publishedAssessments,
      icon: CheckCircle2,
      accent: "green" as const,
    },
    {
      key: "draft",
      label: "Draft Assessments",
      kpi: kpis.draftAssessments,
      icon: FileEdit,
      accent: "slate" as const,
    },
    {
      key: "students",
      label: "Active Students",
      kpi: kpis.activeStudents,
      icon: Users,
      accent: "blue" as const,
    },
    {
      key: "score",
      label: "Average Score",
      kpi: kpis.averageScore,
      icon: Percent,
      accent: "green" as const,
      format: (v: number | null) => (v == null ? null : `${v}`),
    },
    {
      key: "readiness",
      label: "Placement Readiness %",
      kpi: kpis.placementReadiness,
      icon: Trophy,
      accent: "amber" as const,
      format: (v: number | null) => (v == null ? null : `${v}%`),
      unavailable: kpis.placementReadiness.value == null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header + search placeholder */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Assessment Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Operational overview for Placement Readiness — Quantitative Aptitude, Logical
            Reasoning, Python, Java, and AI Fundamentals.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={searchPlaceholder}
            onChange={(e) => setSearchPlaceholder(e.target.value)}
            placeholder="Search assessments… (coming soon)"
            className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            title="Global assessment search — placeholder only"
            aria-label="Global assessment search (placeholder)"
          />
        </div>
      </div>

      {/* Filters */}
      <section className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <label className="block text-xs text-gray-500">
            Domain
            <select
              value={filters.domain || ""}
              onChange={(e) => setFilters((f) => ({ ...f, domain: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800"
            >
              <option value="">All domains</option>
              {domainOptions.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-500">
            Status
            <select
              value={filters.status || ""}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800"
            >
              <option value="">All statuses</option>
              {(filterOptions?.statuses || []).map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-500">
            Assessment Type
            <select
              value={filters.drive_type || ""}
              onChange={(e) => setFilters((f) => ({ ...f, drive_type: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800"
            >
              <option value="">All types</option>
              {(filterOptions?.assessmentTypes || []).map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-500">
            Created By
            <select
              value={filters.created_by || ""}
              onChange={(e) => setFilters((f) => ({ ...f, created_by: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800"
            >
              <option value="">Anyone</option>
              {(filterOptions?.createdBy || []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-gray-500">
            From
            <input
              type="date"
              value={filters.from || ""}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800"
            />
          </label>
          <label className="block text-xs text-gray-500">
            To
            <input
              type="date"
              value={filters.to || ""}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-2.5 py-2 text-sm text-gray-800"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            Clear
          </button>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kpiCards.map((card) => (
          <AssessmentKpiCard
            key={card.key}
            label={card.label}
            value={
              "format" in card && card.format
                ? card.format(card.kpi.value)
                : card.kpi.value
            }
            icon={card.icon}
            accent={card.accent}
            trend={card.kpi.trend}
            lastUpdated={generatedAt}
            unavailable={"unavailable" in card ? card.unavailable : false}
          />
        ))}
      </section>

      {/* Quick actions — navigate only */}
      <section className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick actions</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/superadmin/drives/new"
            className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            <Plus className="w-4 h-4" />
            Create Assessment
          </Link>
          <Link
            to="/app/superadmin/practice-sets"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            <FlaskConical className="w-4 h-4" />
            Create Practice Set
          </Link>
          <Link
            to="/app/superadmin/mock-tests"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            <FileStack className="w-4 h-4" />
            Create Mock Test
          </Link>
          <Link
            to="/app/superadmin/assessment-results"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            <ClipboardList className="w-4 h-4" />
            View Results
          </Link>
          <Link
            to="/app/superadmin/analytics/assessments"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:border-navy-900/30"
          >
            <BarChart3 className="w-4 h-4" />
            Analytics
          </Link>
        </div>
      </section>

      {/* Charts */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard
          title="Assessment Attempts"
          subtitle="Last 14 days"
          variant="area"
          color="blue"
          loading={loading}
          data={(charts.assessmentAttempts || []).map((r) => ({
            label: r.label,
            value: r.count,
          }))}
        />
        <ChartCard
          title="Average Score Trend"
          subtitle="Daily average on completed attempts"
          variant="area"
          color="emerald"
          loading={loading}
          data={(charts.averageScoreTrend || []).map((r) => ({
            label: r.label,
            value: r.avg_score,
          }))}
        />
        <ChartCard
          title="Difficulty Distribution"
          subtitle="Pool questions by difficulty"
          variant="bar"
          color="violet"
          loading={loading}
          data={(charts.difficultyDistribution || []).map((r) => ({
            label: r.difficulty,
            value: r.count,
          }))}
        />
        <ChartCard
          title="Assessment Completion"
          subtitle="% completed of started (daily)"
          variant="area"
          color="cyan"
          loading={loading}
          data={(charts.assessmentCompletion || []).map((r) => ({
            label: r.label,
            value: r.value,
          }))}
        />
        <ChartCard
          title="Top Performing Domains"
          subtitle="Highest average scores"
          variant="bar"
          color="indigo"
          loading={loading}
          data={(charts.topPerformingDomains || []).map((r) => ({
            label: r.label,
            value: r.avg_score,
          }))}
        />
        <ChartCard
          title="Weak Domains"
          subtitle="Lowest average scores — focus areas"
          variant="bar"
          color="violet"
          loading={loading}
          data={(charts.weakDomains || []).map((r) => ({
            label: r.label,
            value: r.avg_score,
          }))}
        />
      </section>

      {/* Recent activity + Pending */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Recent activity</h3>
          </div>
          {recentActivity?.length ? (
            <ul className="space-y-3">
              {recentActivity.map((item, idx) => {
                const Icon = activityIcon(item.type);
                return (
                  <li
                    key={`${item.type}-${item.at}-${idx}`}
                    className="flex items-start gap-3"
                  >
                    <div className="shrink-0 rounded-lg bg-slate-100 p-2 text-slate-600">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-500">
                        {activityLabel(item.type)}
                      </p>
                      <p className="text-sm text-gray-900 truncate">{item.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {[item.meta, formatWhen(item.at)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 py-6 text-center">No recent activity yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-gray-900">Pending items</h3>
          </div>
          {pending?.length ? (
            <ul className="space-y-3">
              {pending.map((item, idx) => (
                <li key={`${item.type}-${item.title}-${idx}`}>
                  {item.href ? (
                    <Link
                      to={item.href}
                      className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 hover:border-navy-900/25 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {item.meta || item.type.replace(/_/g, " ")}
                        </p>
                      </div>
                    </Link>
                  ) : (
                    <div className="rounded-lg border border-gray-100 px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.title}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {item.meta || item.type.replace(/_/g, " ")}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 py-6 text-center">
              Nothing pending — drafts and scheduled mocks will appear here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
