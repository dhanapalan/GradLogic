/**
 * Module 07 — Results & Performance Analytics hub.
 * Learning Intelligence dashboard (consume-only).
 */
import { lazy, Suspense, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpenCheck,
  Dumbbell,
  Printer,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import studentResultsAnalyticsService from "../../../services/studentResultsAnalyticsService";
import {
  AnalyticsCard,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  MetricTile,
  PerformanceBadge,
  ProgressBar,
  formatDuration,
  formatWhen,
} from "./results/components";

const SkillRadar = lazy(() =>
  import("./results/Charts").then((m) => ({ default: m.SkillRadar }))
);
const ScoreTrendChart = lazy(() =>
  import("./results/Charts").then((m) => ({ default: m.ScoreTrendChart }))
);
const DifficultyBars = lazy(() =>
  import("./results/Charts").then((m) => ({ default: m.DifficultyBars }))
);

const BASE = "/app/student-portal";

function WidgetShell({
  title,
  subtitle,
  query,
  children,
}: {
  title: string;
  subtitle?: string;
  query: { isLoading: boolean; isError: boolean; refetch: () => void; error?: unknown };
  children: ReactNode;
}) {
  if (query.isLoading) return <LoadingBlock label={`Loading ${title}`} />;
  if (query.isError) {
    return (
      <ErrorBlock
        message={(query.error as { message?: string })?.message || `Failed to load ${title}.`}
        onRetry={() => query.refetch()}
      />
    );
  }
  return (
    <AnalyticsCard title={title} subtitle={subtitle}>
      {children}
    </AnalyticsCard>
  );
}

export default function ResultsAnalyticsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const historyQ = useQuery({
    queryKey: ["m07-history", search, status, type],
    queryFn: () =>
      studentResultsAnalyticsService.getHistory({
        search: search || undefined,
        status: status || undefined,
        assessment_type: type || undefined,
        limit: 30,
        page: 1,
      }),
    staleTime: 30_000,
  });

  const performanceQ = useQuery({
    queryKey: ["m07-performance"],
    queryFn: () => studentResultsAnalyticsService.getPerformance(),
    staleTime: 60_000,
  });

  const skillsQ = useQuery({
    queryKey: ["m07-skills"],
    queryFn: () => studentResultsAnalyticsService.getSkills(),
    staleTime: 60_000,
  });

  const topicsQ = useQuery({
    queryKey: ["m07-topics"],
    queryFn: () => studentResultsAnalyticsService.getTopics(),
    staleTime: 60_000,
  });

  const difficultyQ = useQuery({
    queryKey: ["m07-difficulty"],
    queryFn: () => studentResultsAnalyticsService.getDifficulty(),
    staleTime: 60_000,
  });

  const bloomQ = useQuery({
    queryKey: ["m07-bloom"],
    queryFn: () => studentResultsAnalyticsService.getBloom(),
    staleTime: 120_000,
  });

  const outcomesQ = useQuery({
    queryKey: ["m07-outcomes"],
    queryFn: () => studentResultsAnalyticsService.getLearningOutcomes(),
    staleTime: 60_000,
  });

  const trendsQ = useQuery({
    queryKey: ["m07-trends"],
    queryFn: () => studentResultsAnalyticsService.getTrends(),
    staleTime: 60_000,
  });

  const readinessQ = useQuery({
    queryKey: ["m07-readiness"],
    queryFn: () => studentResultsAnalyticsService.getReadiness(),
    staleTime: 60_000,
  });

  const recsQ = useQuery({
    queryKey: ["m07-recs"],
    queryFn: () => studentResultsAnalyticsService.getRecommendations(),
    staleTime: 60_000,
  });

  const strengthsQ = useQuery({
    queryKey: ["m07-strengths"],
    queryFn: () => studentResultsAnalyticsService.getStrengths(),
    staleTime: 60_000,
  });

  const perf = performanceQ.data as {
    overall_performance_score?: number | null;
    overall_grade?: string | null;
    performance_category?: string;
    assessments_completed?: number;
    learning_outcomes_achieved?: number;
    learning_outcomes_total?: number;
    strongest_skill?: { name: string; percentage: number } | null;
    weakest_skill?: { name: string; percentage: number } | null;
  } | undefined;

  const radarData = useMemo(
    () =>
      (skillsQ.data?.skills || []).slice(0, 8).map((s) => ({
        skill: s.skill_name,
        percentage: s.percentage || 0,
      })),
    [skillsQ.data]
  );

  const handlePrint = () => window.print();

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-500 print:max-w-none">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assessments</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Results</h1>
          <p className="mt-1 text-sm text-slate-500">
            Learning Intelligence — skills, topics, difficulty, outcomes, and AI-guided next steps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print / PDF
          </button>
        </div>
      </header>

      {/* Performance overview */}
      <WidgetShell
        title="Performance overview"
        subtitle="Across published assessments"
        query={performanceQ}
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Overall score"
            value={perf?.overall_performance_score != null ? `${perf.overall_performance_score}%` : "—"}
            hint={perf?.overall_grade ? `Grade ${perf.overall_grade}` : undefined}
          />
          <MetricTile
            label="Category"
            value={perf?.performance_category || "—"}
            hint={`${perf?.assessments_completed ?? 0} assessments`}
          />
          <MetricTile
            label="Strongest skill"
            value={perf?.strongest_skill?.name || "—"}
            hint={
              perf?.strongest_skill != null ? `${perf.strongest_skill.percentage}%` : undefined
            }
          />
          <MetricTile
            label="Weakest skill"
            value={perf?.weakest_skill?.name || "—"}
            hint={perf?.weakest_skill != null ? `${perf.weakest_skill.percentage}%` : undefined}
          />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Learning outcomes achieved: {perf?.learning_outcomes_achieved ?? 0} /{" "}
          {perf?.learning_outcomes_total ?? 0}
        </p>
      </WidgetShell>

      {/* Continue learning */}
      <AnalyticsCard title="Continue learning" subtitle="Turn insights into action">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Learning Hub", href: `${BASE}/my-learning`, icon: BookOpenCheck },
            { label: "Practice Hub", href: `${BASE}/practice`, icon: Dumbbell },
            {
              label: "Weak topics",
              href: skillsQ.data?.weakest_skill
                ? `${BASE}/practice?topic=${encodeURIComponent(skillsQ.data.weakest_skill.name)}`
                : `${BASE}/practice`,
              icon: Target,
            },
            { label: "My Assessments", href: `${BASE}/my-assessments`, icon: TrendingUp },
            { label: "Question Library", href: `${BASE}/question-bank`, icon: Search },
          ].map((a) => (
            <Link
              key={a.label}
              to={a.href}
              className="flex flex-col items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-indigo-100 hover:bg-indigo-50/40"
            >
              <a.icon className="h-4 w-4 text-indigo-500" aria-hidden />
              <span className="text-xs font-bold text-slate-800">{a.label}</span>
            </Link>
          ))}
        </div>
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WidgetShell title="Skill analysis" query={skillsQ}>
          {!skillsQ.data?.skills?.length ? (
            <EmptyBlock title="No skill analytics yet" hint="Published assessment results unlock skill breakdowns." />
          ) : (
            <ul className="space-y-3">
              {skillsQ.data.skills.map((s) => (
                <li key={s.skill_name} className="rounded-xl border border-slate-50 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-900">{s.skill_name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-slate-800">{s.percentage}%</span>
                      <PerformanceBadge label={s.performance} />
                    </div>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={s.percentage} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">{s.recommended_improvement}</p>
                </li>
              ))}
            </ul>
          )}
          {radarData.length > 0 && (
            <Suspense fallback={<LoadingBlock label="Loading chart" />}>
              <div className="mt-4">
                <SkillRadar data={radarData} />
              </div>
            </Suspense>
          )}
        </WidgetShell>

        <WidgetShell title="Difficulty analysis" subtitle={difficultyQ.data?.headline} query={difficultyQ}>
          {!difficultyQ.data?.available ? (
            <EmptyBlock title="No difficulty insights yet" />
          ) : (
            <>
              <ul className="space-y-2">
                {difficultyQ.data.levels
                  .filter((l) => l.questions > 0)
                  .map((l) => (
                    <li
                      key={l.difficulty}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-900">{l.difficulty}</p>
                        <p className="text-[11px] text-slate-500">{l.insight}</p>
                      </div>
                      <span className="text-sm font-black text-slate-800">
                        {l.accuracy != null ? `${l.accuracy}%` : "—"}
                      </span>
                    </li>
                  ))}
              </ul>
              <Suspense fallback={null}>
                <div className="mt-3">
                  <DifficultyBars data={difficultyQ.data.levels} />
                </div>
              </Suspense>
            </>
          )}
        </WidgetShell>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WidgetShell title="Topic analysis" query={topicsQ}>
          {!topicsQ.data?.flat?.length ? (
            <EmptyBlock title="No topic breakdown yet" />
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {topicsQ.data.flat.map((t) => (
                <div
                  key={t.topic}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">{t.topic}</p>
                    <p className="text-[11px] text-slate-500">
                      {t.correct}/{t.questions} correct · {t.recommendation}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-black">
                    {t.accuracy != null ? `${t.accuracy}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </WidgetShell>

        <WidgetShell title="Learning outcomes" query={outcomesQ}>
          {!outcomesQ.data?.items?.length ? (
            <EmptyBlock title="No learning outcomes mapped yet" />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                <span>Achieved {outcomesQ.data.summary.achieved}</span>
                <span>· Partial {outcomesQ.data.summary.partially_achieved}</span>
                <span>· Needs work {outcomesQ.data.summary.needs_improvement}</span>
              </div>
              <ul className="max-h-80 space-y-2 overflow-y-auto">
                {outcomesQ.data.items.map((o) => (
                  <li key={o.learning_outcome} className="rounded-xl border border-slate-50 px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900">{o.learning_outcome}</p>
                      <PerformanceBadge label={o.status} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {o.mapped_skill} · {o.recommendation}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </WidgetShell>
      </div>

      <WidgetShell
        title="Bloom's taxonomy"
        subtitle={bloomQ.data?.available ? undefined : bloomQ.data?.message}
        query={bloomQ}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(bloomQ.data?.levels || []).map((l) => (
            <div key={l.bloom_level} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {l.bloom_level}
              </p>
              <p className="mt-1 text-lg font-black text-slate-900">
                {l.percentage != null ? `${l.percentage}%` : "N/A"}
              </p>
            </div>
          ))}
        </div>
      </WidgetShell>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <WidgetShell title="Strengths & improvement areas" query={strengthsQ}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
                Strengths
              </p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {(strengthsQ.data?.strengths.top_skills || []).map((s) => (
                  <li key={s.skill_name}>
                    {s.skill_name} · {s.percentage}%
                  </li>
                ))}
                {!strengthsQ.data?.strengths.top_skills?.length && (
                  <li className="text-slate-400">No strengths identified yet</li>
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-rose-600">
                Improvement areas
              </p>
              <ul className="space-y-1.5 text-sm text-slate-700">
                {(strengthsQ.data?.improvement_areas.weak_skills || []).map((s) => (
                  <li key={s.skill_name}>
                    {s.skill_name} · {s.percentage}%
                  </li>
                ))}
                {!strengthsQ.data?.improvement_areas.weak_skills?.length && (
                  <li className="text-slate-400">No weak skills flagged</li>
                )}
              </ul>
            </div>
          </div>
        </WidgetShell>

        <WidgetShell title="Placement readiness" query={readinessQ}>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current</p>
              <p className="text-4xl font-black text-slate-900">
                {readinessQ.data?.current_readiness ?? readinessQ.data?.score ?? "—"}
                <span className="text-lg text-slate-400">%</span>
              </p>
              {readinessQ.data?.level && (
                <div className="mt-1">
                  <PerformanceBadge label={readinessQ.data.level} />
                </div>
              )}
            </div>
            <div className="text-sm text-slate-600">
              <p>
                Previous:{" "}
                <span className="font-bold">
                  {readinessQ.data?.previous_readiness ?? "—"}
                  {readinessQ.data?.previous_readiness != null ? "%" : ""}
                </span>
              </p>
              <p className="mt-1">
                Improvement:{" "}
                <span className="font-bold">
                  {readinessQ.data?.improvement != null
                    ? `${readinessQ.data.improvement > 0 ? "+" : ""}${readinessQ.data.improvement}`
                    : "—"}
                </span>
              </p>
            </div>
          </div>
        </WidgetShell>
      </div>

      <WidgetShell title="Performance trends" query={trendsQ}>
        <div className="mb-3 flex flex-wrap gap-4 text-xs font-bold text-slate-600">
          <span>Assessments: {trendsQ.data?.assessments_completed ?? 0}</span>
          <span>
            Improvement:{" "}
            {trendsQ.data?.improvement_pct != null
              ? `${trendsQ.data.improvement_pct > 0 ? "+" : ""}${trendsQ.data.improvement_pct}%`
              : "—"}
          </span>
          <span>Time spent: {formatDuration(trendsQ.data?.time_spent_seconds)}</span>
        </div>
        {(trendsQ.data?.score_trend?.length || 0) > 0 ? (
          <Suspense fallback={<LoadingBlock label="Loading trend chart" />}>
            <ScoreTrendChart data={trendsQ.data!.score_trend} />
          </Suspense>
        ) : (
          <EmptyBlock title="Not enough history for trends" />
        )}
      </WidgetShell>

      <WidgetShell title="AI recommendations" subtitle="Consumed from Learning Intelligence — not generated in the browser" query={recsQ}>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(
            [
              ["Practice sets", recsQ.data?.panels.recommended_practice_sets],
              ["Learning paths", recsQ.data?.panels.recommended_learning_path],
              ["Next assessments", recsQ.data?.panels.recommended_next_assessment],
              ["Question library", recsQ.data?.panels.recommended_question_library],
            ] as const
          ).map(([label, items]) => (
            <div key={label} className="rounded-xl border border-slate-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <ul className="space-y-2">
                {(items || []).slice(0, 3).map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.href}
                      className="group flex items-start justify-between gap-2 rounded-lg hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 group-hover:text-indigo-700">
                          {item.title}
                        </p>
                        <p className="line-clamp-2 text-[11px] text-slate-500">{item.description}</p>
                      </div>
                      <PerformanceBadge label={item.priority} />
                    </Link>
                  </li>
                ))}
                {!items?.length && <li className="text-xs text-slate-400">None right now</li>}
              </ul>
            </div>
          ))}
        </div>
        {recsQ.data?.panels.study_plan?.steps?.length ? (
          <div className="mt-4 rounded-xl bg-indigo-50/60 p-3">
            <p className="text-xs font-bold text-indigo-800">Study plan</p>
            <ol className="mt-2 space-y-1">
              {recsQ.data.panels.study_plan.steps.map((step, i) => (
                <li key={step.href}>
                  <Link to={step.href} className="text-sm font-medium text-indigo-700 hover:underline">
                    {i + 1}. {step.label}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </WidgetShell>

      {/* Assessment history */}
      <AnalyticsCard
        title="Assessment history"
        subtitle="Published and pending evaluations"
        action={
          <div className="flex flex-wrap gap-2 print:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search"
                className="w-40 rounded-lg border border-slate-200 py-2 pl-8 pr-2 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
                aria-label="Search assessments"
              />
            </div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-2 text-xs"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending_evaluation">Pending evaluation</option>
            </select>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="Assessment type"
              className="w-36 rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-200"
              aria-label="Filter by assessment type"
            />
          </div>
        }
      >
        {historyQ.isLoading ? (
          <LoadingBlock label="Loading history" />
        ) : historyQ.isError ? (
          <ErrorBlock message="Couldn’t load assessment history." onRetry={() => historyQ.refetch()} />
        ) : !historyQ.data?.data?.length ? (
          <EmptyBlock
            title="No results yet"
            hint="Completed assessments appear here when evaluation is published."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2 pr-3">Assessment</th>
                  <th className="py-2 pr-3">Campaign</th>
                  <th className="py-2 pr-3">Attempt</th>
                  <th className="py-2 pr-3">Completed</th>
                  <th className="py-2 pr-3">Score</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyQ.data.data.map((row) => (
                  <tr key={row.attempt_id} className="border-b border-slate-50">
                    <td className="py-3 pr-3">
                      <p className="font-bold text-slate-900">{row.assessment_name}</p>
                      <p className="text-[11px] text-slate-500">{row.subject || row.assessment_type}</p>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">{row.campaign_name}</td>
                    <td className="py-3 pr-3">{row.attempt}</td>
                    <td className="py-3 pr-3 text-slate-600">{formatWhen(row.completed_at)}</td>
                    <td className="py-3 pr-3">
                      <span className="font-black">{row.percentage}%</span>
                      {row.grade && (
                        <span className="ml-1 text-xs text-slate-400">({row.grade})</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <PerformanceBadge label={row.status} />
                    </td>
                    <td className="py-3">
                      {row.evaluation_status === "published" ? (
                        <Link
                          to={`/app/student-portal/results/report/${row.attempt_id}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
                        >
                          View Report <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">{row.action}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}
