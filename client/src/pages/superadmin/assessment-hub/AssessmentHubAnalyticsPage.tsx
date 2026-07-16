// =============================================================================
// Assessment Hub · Analytics
// Attempts · Completion · Avg score · Pass rate · Question stats · Weak/Strong
// · Placement readiness trends — uses shared ChartCard (dashboard charts).
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  BarChart3,
  Loader2,
  ClipboardList,
  CheckCircle2,
  Percent,
  TrendingDown,
  TrendingUp,
  Target,
  ListChecks,
  Award,
  ArrowRight,
} from "lucide-react";
import ChartCard from "../../../components/superadmin/ChartCard";
import assessmentHubService, {
  type AssessmentHubAnalytics,
} from "../../../services/assessmentHubService";

type ReportKey =
  | "assessment_attempts"
  | "completion"
  | "average_score"
  | "pass_rate"
  | "question_statistics"
  | "weak_skills"
  | "strong_skills"
  | "placement_readiness";

const REPORT_META: Array<{
  key: ReportKey;
  title: string;
  blurb: string;
  icon: typeof ClipboardList;
  accent: string;
}> = [
  {
    key: "assessment_attempts",
    title: "Attempts",
    blurb: "Volume by type and last 14 days.",
    icon: ClipboardList,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    key: "completion",
    title: "Completion rate",
    blurb: "Started vs completed.",
    icon: CheckCircle2,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    key: "average_score",
    title: "Average score",
    blurb: "Overall and by assessment type.",
    icon: Percent,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    key: "pass_rate",
    title: "Pass rate",
    blurb: "Score ≥ rule cutoff (default 40).",
    icon: Award,
    accent: "bg-indigo-50 text-indigo-700",
  },
  {
    key: "question_statistics",
    title: "Question statistics",
    blurb: "Bank mix, difficulty, category volume.",
    icon: ListChecks,
    accent: "bg-orange-50 text-orange-700",
  },
  {
    key: "weak_skills",
    title: "Weak skills",
    blurb: "Lowest accuracy categories.",
    icon: TrendingDown,
    accent: "bg-rose-50 text-rose-700",
  },
  {
    key: "strong_skills",
    title: "Strong skills",
    blurb: "Highest accuracy categories.",
    icon: TrendingUp,
    accent: "bg-teal-50 text-teal-700",
  },
  {
    key: "placement_readiness",
    title: "Placement readiness",
    blurb: "Journey readiness trends.",
    icon: Target,
    accent: "bg-amber-50 text-amber-700",
  },
];

function pctRatio(n: number) {
  return `${Math.round(n * 100)}%`;
}

function OverviewCharts({
  data,
  loading,
}: {
  data: AssessmentHubAnalytics;
  loading: boolean;
}) {
  const attempts = data.reports.assessment_attempts;
  const avg = data.reports.average_score;
  const pass = data.reports.pass_rate;
  const qs = data.reports.question_statistics;
  const weak = data.reports.weak_skills;
  const strong = data.reports.strong_skills;
  const pr = data.reports.placement_readiness;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard
        title="Assessment Attempts"
        subtitle="Last 14 days"
        variant="area"
        color="blue"
        loading={loading}
        data={attempts.daily.map((r) => ({ label: r.label, value: r.count }))}
      />
      <ChartCard
        title="Average Score Trend"
        subtitle="Daily average on completed attempts"
        variant="area"
        color="emerald"
        loading={loading}
        data={(avg.daily || []).map((r) => ({
          label: r.label,
          value: r.avg_score,
        }))}
      />
      <ChartCard
        title="Attempts by type"
        subtitle="Started / completed volume"
        variant="bar"
        color="violet"
        loading={loading}
        data={attempts.by_type.map((r) => ({
          label: r.label,
          value: r.attempts,
        }))}
      />
      <ChartCard
        title="Pass rate by type"
        subtitle={`Cutoff default ${pass.summary.cutoff_default}%`}
        variant="bar"
        color="indigo"
        loading={loading}
        data={pass.by_type.map((r) => ({
          label: r.label,
          value: r.rate_percent ?? 0,
        }))}
      />
      <ChartCard
        title="Questions by difficulty"
        subtitle="Active bank items"
        variant="bar"
        color="cyan"
        loading={loading}
        data={qs.by_difficulty.map((r) => ({
          label: r.label,
          value: r.count,
        }))}
      />
      <ChartCard
        title="Placement readiness trend"
        subtitle="Avg journey readiness (14 days)"
        variant="area"
        color="emerald"
        loading={loading}
        data={(pr.trend || []).map((r) => ({
          label: r.label,
          value: r.avg_readiness,
        }))}
      />
      <ChartCard
        title="Weak skills"
        subtitle="Accuracy % (lowest)"
        variant="bar"
        color="violet"
        loading={loading}
        data={weak.items.slice(0, 8).map((r) => ({
          label: r.label,
          value: Math.round(r.accuracy * 100),
        }))}
      />
      <ChartCard
        title="Strong skills"
        subtitle="Accuracy % (highest)"
        variant="bar"
        color="indigo"
        loading={loading}
        data={strong.items.slice(0, 8).map((r) => ({
          label: r.label,
          value: Math.round(r.accuracy * 100),
        }))}
      />
    </section>
  );
}

function ReportBody({
  reportKey,
  data,
}: {
  reportKey: ReportKey;
  data: AssessmentHubAnalytics;
}) {
  if (reportKey === "assessment_attempts") {
    const a = data.reports.assessment_attempts;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label="Total rows" value={a.summary.total} />
          <Kpi label="Started" value={a.summary.started} />
          <Kpi label="Completed" value={a.summary.completed} />
          <Kpi label="In progress" value={a.summary.in_progress} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="By type"
            variant="bar"
            color="blue"
            data={a.by_type.map((r) => ({ label: r.label, value: r.attempts }))}
          />
          <ChartCard
            title="Last 14 days"
            variant="area"
            color="blue"
            data={a.daily.map((r) => ({ label: r.label, value: r.count }))}
          />
        </div>
      </div>
    );
  }

  if (reportKey === "completion") {
    const c = data.reports.completion;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Kpi label="Started" value={c.summary.started} />
          <Kpi label="Completed" value={c.summary.completed} />
          <Kpi
            label="Rate"
            value={c.summary.rate_percent != null ? `${c.summary.rate_percent}%` : "—"}
          />
        </div>
        <ChartCard
          title="Completion rate by type"
          variant="bar"
          color="emerald"
          data={c.by_type.map((r) => ({
            label: r.label,
            value: r.rate ?? 0,
          }))}
        />
      </div>
    );
  }

  if (reportKey === "average_score") {
    const s = data.reports.average_score;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Kpi
            label="Overall average"
            value={s.summary.average != null ? s.summary.average : "—"}
          />
          <Kpi label="Scored attempts" value={s.summary.scored_attempts} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard
            title="Average by type"
            variant="bar"
            color="violet"
            data={s.by_type.map((x) => ({
              label: x.label,
              value: x.avg_score ?? 0,
            }))}
          />
          <ChartCard
            title="Daily average (14d)"
            variant="area"
            color="emerald"
            data={(s.daily || []).map((x) => ({
              label: x.label,
              value: x.avg_score,
            }))}
          />
        </div>
      </div>
    );
  }

  if (reportKey === "pass_rate") {
    const p = data.reports.pass_rate;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label="Completed" value={p.summary.completed} />
          <Kpi label="Passed" value={p.summary.passed} />
          <Kpi
            label="Pass rate"
            value={p.summary.rate_percent != null ? `${p.summary.rate_percent}%` : "—"}
          />
          <Kpi label="Default cutoff" value={`${p.summary.cutoff_default}%`} />
        </div>
        <ChartCard
          title="Pass rate by type"
          subtitle="Score ≥ assessment overall_cutoff"
          variant="bar"
          color="indigo"
          data={p.by_type.map((r) => ({
            label: r.label,
            value: r.rate_percent ?? 0,
          }))}
        />
      </div>
    );
  }

  if (reportKey === "question_statistics") {
    const q = data.reports.question_statistics;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Kpi label="Active" value={q.summary.active} />
          <Kpi label="Published" value={q.summary.published} />
          <Kpi label="With attempts" value={q.summary.questions_with_attempts} />
          <Kpi
            label="Avg practice pass"
            value={
              q.summary.avg_practice_pass_rate != null
                ? `${q.summary.avg_practice_pass_rate}%`
                : "—"
            }
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard
            title="By type"
            variant="bar"
            color="cyan"
            data={q.by_type.map((r) => ({ label: r.label, value: r.count }))}
          />
          <ChartCard
            title="By difficulty"
            variant="bar"
            color="violet"
            data={q.by_difficulty.map((r) => ({ label: r.label, value: r.count }))}
          />
          <ChartCard
            title="By category"
            variant="bar"
            color="blue"
            data={q.by_category.map((r) => ({ label: r.label, value: r.count }))}
          />
        </div>
        {q.flags.length > 0 ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4">
            <h3 className="text-xs font-semibold text-orange-900 mb-2">
              Quality flags ({q.summary.flagged_low_pass} low-pass ·{" "}
              {q.summary.missing_explanation} missing explanation)
            </h3>
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {q.flags.slice(0, 8).map((f) => (
                <li key={f.id} className="text-xs text-gray-800">
                  <span className="line-clamp-1">{f.question_text}</span>
                  <span className="text-[11px] text-orange-800 block mt-0.5">
                    {f.category.replace(/_/g, " ")} · {f.reasons.join("; ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Link
          to="/app/superadmin/question-bank"
          className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
        >
          Question Bank <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  if (reportKey === "weak_skills" || reportKey === "strong_skills") {
    const block =
      reportKey === "weak_skills"
        ? data.reports.weak_skills
        : data.reports.strong_skills;
    return (
      <div className="space-y-4">
        <p className="text-[11px] text-gray-400">Source: {block.source}</p>
        <ChartCard
          title={reportKey === "weak_skills" ? "Weak skills" : "Strong skills"}
          subtitle="Accuracy %"
          variant="bar"
          color={reportKey === "weak_skills" ? "violet" : "emerald"}
          data={block.items.map((item) => ({
            label: item.label,
            value: Math.round(item.accuracy * 100),
          }))}
        />
        <ul className="space-y-2">
          {block.items.map((item) => (
            <li
              key={item.skill}
              className="flex items-center justify-between text-xs rounded-lg border border-gray-100 px-3 py-2"
            >
              <span className="font-medium text-gray-800 capitalize">{item.label}</span>
              <span
                className={
                  reportKey === "weak_skills" ? "text-rose-600" : "text-teal-700"
                }
              >
                {pctRatio(item.accuracy)} · {item.attempts} attempts
              </span>
            </li>
          ))}
        </ul>
        <Link
          to="/app/superadmin/assessment-results"
          className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
        >
          Open Results & Evaluation <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    );
  }

  // placement_readiness
  const p = data.reports.placement_readiness;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        <Kpi label="Avg readiness" value={p.average != null ? `${p.average}%` : "—"} />
        <Kpi label="Active journeys" value={p.journeys} />
      </div>
      <ChartCard
        title="Placement readiness trend"
        subtitle="14-day cumulative average"
        variant="area"
        color="emerald"
        data={(p.trend || []).map((r) => ({
          label: r.label,
          value: r.avg_readiness,
        }))}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ChartCard
          title="Buckets"
          variant="bar"
          color="cyan"
          data={p.buckets.map((r) => ({ label: r.bucket, value: r.count }))}
        />
        <ChartCard
          title="By domain"
          variant="bar"
          color="indigo"
          data={p.by_domain.map((r) => ({
            label: r.label,
            value: r.avg_readiness,
          }))}
        />
      </div>
      <Link
        to="/app/superadmin/learning-journey"
        className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
      >
        AI Learning Journey <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

export default function AssessmentHubAnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const initial = (params.get("report") as ReportKey) || "assessment_attempts";
  const [active, setActive] = useState<ReportKey>(
    REPORT_META.some((r) => r.key === initial) ? initial : "assessment_attempts"
  );

  useEffect(() => {
    const r = params.get("report") as ReportKey | null;
    if (r && REPORT_META.some((x) => x.key === r)) setActive(r);
  }, [params]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["assessment-hub-analytics"],
    queryFn: () => assessmentHubService.getAnalytics(),
  });

  const activeMeta = useMemo(
    () => REPORT_META.find((r) => r.key === active)!,
    [active]
  );

  const selectReport = (key: ReportKey) => {
    setActive(key);
    setParams({ report: key });
  };

  const ov = data?.overview;

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · Analytics
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-navy-900" />
                Assessment Analytics
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Attempts, completion rate, average score, pass rate, question statistics, weak /
                strong skills, and placement readiness trends.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {data?.generatedAt ? (
                <p className="text-[11px] text-gray-400">
                  Generated {new Date(data.generatedAt).toLocaleString()}
                </p>
              ) : null}
              <Link
                to="/app/superadmin/assessment-hub"
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Overview</h2>
          {isLoading ? (
            <div className="flex justify-center py-8 text-gray-300">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-rose-600">Couldn&apos;t load analytics.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <Kpi label="Attempts" value={ov?.attempts ?? data.reports.assessment_attempts.summary.started} />
                <Kpi
                  label="Completion rate"
                  value={
                    ov?.completion_rate != null
                      ? `${ov.completion_rate}%`
                      : data.reports.completion.summary.rate_percent != null
                        ? `${data.reports.completion.summary.rate_percent}%`
                        : "—"
                  }
                />
                <Kpi
                  label="Average score"
                  value={
                    ov?.average_score != null
                      ? ov.average_score
                      : data.reports.average_score.summary.average ?? "—"
                  }
                />
                <Kpi
                  label="Pass rate"
                  value={
                    ov?.pass_rate != null
                      ? `${ov.pass_rate}%`
                      : data.reports.pass_rate.summary.rate_percent != null
                        ? `${data.reports.pass_rate.summary.rate_percent}%`
                        : "—"
                  }
                />
                <Kpi
                  label="Questions (active)"
                  value={ov?.questions_active ?? data.reports.question_statistics.summary.active}
                />
                <Kpi label="Weak skills" value={ov?.weak_skills_count ?? data.reports.weak_skills.items.length} />
                <Kpi
                  label="Strong skills"
                  value={ov?.strong_skills_count ?? data.reports.strong_skills.items.length}
                />
                <Kpi
                  label="Placement readiness"
                  value={
                    ov?.placement_readiness_avg != null
                      ? `${ov.placement_readiness_avg}%`
                      : data.reports.placement_readiness.average != null
                        ? `${data.reports.placement_readiness.average}%`
                        : "—"
                  }
                />
              </div>
              <OverviewCharts data={data} loading={false} />
            </>
          )}
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Drill-down reports</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {REPORT_META.map((r) => {
              const Icon = r.icon;
              const on = active === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => selectReport(r.key)}
                  className={`text-left rounded-xl border p-3.5 transition-colors ${
                    on
                      ? "border-navy-900 bg-navy-900/[0.04] shadow-admin-card"
                      : "border-gray-200/70 bg-white hover:border-navy-900/30"
                  }`}
                >
                  <div className={`inline-flex rounded-lg p-2 ${r.accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-900">{r.title}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">{r.blurb}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card min-h-[18rem]">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">{activeMeta.title}</h2>
          {isLoading ? (
            <div className="flex justify-center py-20 text-gray-300">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : error || !data ? (
            <p className="text-sm text-rose-600 py-10 text-center">
              Couldn&apos;t load analytics reports.
            </p>
          ) : (
            <ReportBody reportKey={active} data={data} />
          )}
        </section>

        <p className="text-xs text-gray-400">
          Pipeline: Attempts → Evaluation → Journey →{" "}
          <strong className="font-medium text-gray-500">Analytics</strong>. Charts reuse Dashboard{" "}
          <code className="text-[11px]">ChartCard</code>.
        </p>
      </div>
    </div>
  );
}
