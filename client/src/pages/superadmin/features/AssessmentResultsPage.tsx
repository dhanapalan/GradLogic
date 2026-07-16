// =============================================================================
// Assessment Hub · Results & Evaluation
// Student attempt insights + AI Learning Journey auto-update.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  Award,
  Search,
  Loader2,
  BarChart3,
  Layers,
  Crosshair,
  Clock,
  TrendingDown,
  TrendingUp,
  Lightbulb,
  Compass,
  Route,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import assessmentHubService, {
  type AttemptEvaluation,
} from "../../../services/assessmentHubService";

const STUDENT_GETS = [
  {
    title: "Overall Score",
    description: "Marks from auto-graded attempt vs rule total.",
    icon: Award,
    accent: "bg-sky-50 text-sky-700",
  },
  {
    title: "Section Score",
    description: "Breakdown by skill / section on the paper.",
    icon: Layers,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    title: "Accuracy",
    description: "Correct ÷ attempted across the attempt.",
    icon: Crosshair,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "Time analysis",
    description: "Spent vs allotted, pace, avg seconds per question.",
    icon: Clock,
    accent: "bg-amber-50 text-amber-700",
  },
  {
    title: "Weak Topics",
    description: "Sections under 50% accuracy (or Adaptive fallback).",
    icon: TrendingDown,
    accent: "bg-rose-50 text-rose-700",
  },
  {
    title: "Strong Topics",
    description: "Sections at 70%+ — maintain and advance.",
    icon: TrendingUp,
    accent: "bg-teal-50 text-teal-700",
  },
  {
    title: "AI recommendations",
    description: "Coaching from score, topics, pace — LLM-enriched on detail.",
    icon: Lightbulb,
    accent: "bg-yellow-50 text-yellow-800",
  },
  {
    title: "Related lessons",
    description: "Knowledge Library / Adaptive lesson matched to weak skills.",
    icon: Layers,
    accent: "bg-teal-50 text-teal-800",
  },
  {
    title: "Suggested practice",
    description: "Next topic + practice set for the continuous learning loop.",
    icon: Compass,
    accent: "bg-indigo-50 text-indigo-700",
  },
] as const;

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function EvaluationDetail({ ev }: { ev: AttemptEvaluation }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Student</p>
        <p className="text-sm font-semibold text-gray-900 mt-0.5">
          {ev.student_name || "Student"}
        </p>
        <p className="text-xs text-gray-500">{ev.student_email}</p>
        <p className="text-xs text-gray-500 mt-1">
          {ev.drive_name} · {ev.drive_type || "assessment"}
          {ev.completed_at
            ? ` · ${new Date(ev.completed_at).toLocaleString()}`
            : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric
          label="Overall"
          value={
            ev.overall_score != null
              ? `${ev.overall_score}${ev.total_marks != null ? ` / ${ev.total_marks}` : ""}`
              : "—"
          }
          sub={ev.score_percent != null ? `${ev.score_percent}%` : undefined}
        />
        <Metric
          label="Accuracy"
          value={pct(ev.accuracy)}
          sub={`${ev.questions_correct}/${ev.questions_attempted} correct`}
        />
        <Metric
          label="Time"
          value={ev.time_analysis?.spent_label || ev.time_spent_label || "—"}
          sub={
            ev.time_analysis?.percent_used != null
              ? `${ev.time_analysis.percent_used}% of allotted`
              : undefined
          }
        />
        <Metric
          label="Questions"
          value={`${ev.questions_total}`}
          sub={`${ev.questions_attempted} attempted`}
        />
      </div>

      {ev.time_analysis ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 px-3 py-3">
          <h3 className="text-xs font-semibold text-amber-900 mb-1">Time analysis</h3>
          <p className="text-xs text-amber-900/90">
            {ev.time_analysis.pace_label || "—"}
          </p>
          <p className="text-[11px] text-amber-800/80 mt-1">
            Allotted {ev.time_analysis.allotted_label || "—"}
            {ev.time_analysis.avg_seconds_per_question != null
              ? ` · ~${ev.time_analysis.avg_seconds_per_question}s / question`
              : ""}
          </p>
        </div>
      ) : null}

      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-2">Section scores</h3>
        {ev.section_scores.length === 0 ? (
          <p className="text-xs text-gray-400">No skill-tagged sections on this paper.</p>
        ) : (
          <ul className="space-y-1.5">
            {ev.section_scores.map((s) => (
              <li
                key={s.section}
                className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs"
              >
                <span className="font-medium text-gray-800 truncate">{s.section}</span>
                <span className="text-gray-500 shrink-0">
                  {s.marks_earned}/{s.marks_available} · {pct(s.accuracy)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TopicList title="Weak topics" items={ev.weak_topics} tone="weak" />
        <TopicList title="Strong topics" items={ev.strong_topics} tone="strong" />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
          AI recommendations
          {ev.ai_recommendations_enriched ? (
            <span className="text-[10px] font-bold uppercase text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
              LLM
            </span>
          ) : null}
        </h3>
        <ul className="space-y-1.5">
          {ev.recommendations.map((r) => (
            <li key={r} className="text-xs text-gray-600 flex gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
        <p className="text-xs font-semibold text-indigo-900">Next practice</p>
        <p className="text-sm text-indigo-800 mt-1">
          {ev.next_practice.topic || "General practice"}
          {ev.next_practice.difficulty ? ` · ${ev.next_practice.difficulty}` : ""}
          {ev.next_practice.estimated_minutes != null
            ? ` · ~${ev.next_practice.estimated_minutes} min`
            : ""}
        </p>
        {ev.next_practice.question_preview ? (
          <p className="text-xs text-indigo-700/80 mt-1 line-clamp-2">
            {ev.next_practice.question_preview}
          </p>
        ) : null}
        <Link
          to={ev.next_practice.practice_href}
          className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-indigo-700 hover:underline"
        >
          Open practice set
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {ev.recommended_lesson?.title || ev.learning_loop ? (
        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-teal-900">Continuous learning loop</p>
            <p className="text-[11px] text-teal-800/80 mt-0.5">
              Learn → Practice → Assess → AI Feedback → Improve → Reassess
            </p>
          </div>
          {ev.learning_loop ? (
            <ul className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ["evaluated", "AI evaluated"],
                  ["weak_skills_detected", "Weak skills"],
                  ["lesson_recommended", "KL lesson"],
                  ["practice_assigned", "Practice assigned"],
                  ["journey_updated", "Journey updated"],
                  ["readiness_recalculated", "Readiness score"],
                ] as const
              ).map(([key, label]) => (
                <li key={key} className="flex items-center gap-1.5 text-[11px] text-teal-900">
                  <CheckCircle2
                    className={`w-3 h-3 shrink-0 ${
                      ev.learning_loop?.[key] ? "text-teal-600" : "text-gray-300"
                    }`}
                  />
                  {label}
                </li>
              ))}
            </ul>
          ) : null}
          {ev.recommended_lesson?.title ? (
            <div>
              <p className="text-xs font-medium text-teal-900">
                Recommended lesson: {ev.recommended_lesson.title}
              </p>
              {ev.recommended_lesson.href ? (
                <Link
                  to={ev.recommended_lesson.href}
                  className="inline-flex items-center gap-1 mt-1 text-xs font-medium text-teal-800 hover:underline"
                >
                  Open Adaptive Learning
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
        <div className="flex items-start gap-2">
          <Route className="w-4 h-4 text-emerald-700 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-emerald-900">AI Learning Journey</p>
            <p className="text-xs text-emerald-800 mt-1">
              {ev.learning_journey.updated
                ? "This attempt auto-updated the student’s journey (placement readiness)."
                : "Submit emits ExamSubmitted → journeys blend score into placement readiness."}
            </p>
            <p className="text-[11px] text-emerald-700/80 mt-1">
              Journeys touched: {ev.learning_journey.journeys_touched}
              {ev.learning_journey.avg_readiness != null
                ? ` · readiness ~${ev.learning_journey.avg_readiness}%`
                : ""}
            </p>
            <Link
              to="/app/superadmin/learning-journey"
              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-emerald-800 hover:underline"
            >
              Open AI Learning Journey
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <Link
        to={`/app/superadmin/drives/${ev.drive_id}`}
        className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline"
      >
        Open assessment
        <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
      {sub ? <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function TopicList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "weak" | "strong";
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${
        tone === "weak"
          ? "border-rose-100 bg-rose-50/40"
          : "border-teal-100 bg-teal-50/40"
      }`}
    >
      <p className="text-xs font-semibold text-gray-800">{title}</p>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-400 mt-1">None yet</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {items.map((t) => (
            <li
              key={t}
              className={`text-[11px] px-1.5 py-0.5 rounded ${
                tone === "weak"
                  ? "bg-white text-rose-700"
                  : "bg-white text-teal-700"
              }`}
            >
              {t.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AssessmentResultsPage() {
  const [searchParams] = useSearchParams();
  const driveFilter = searchParams.get("drive_id") || undefined;
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: overview } = useQuery({
    queryKey: ["assessment-hub-eval-overview"],
    queryFn: () => assessmentHubService.getEvaluationOverview(),
  });

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["assessment-hub-evaluations", debounced, driveFilter],
    queryFn: () =>
      assessmentHubService.listEvaluations({
        search: debounced || undefined,
        driveId: driveFilter,
        limit: 40,
      }),
  });

  useEffect(() => {
    if (!selectedId && attempts.length) setSelectedId(attempts[0].session_id);
    if (
      selectedId &&
      attempts.length &&
      !attempts.some((a) => a.session_id === selectedId)
    ) {
      setSelectedId(attempts[0]?.session_id ?? null);
    }
  }, [attempts, selectedId]);

  const { data: selectedDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["assessment-hub-evaluation-detail", selectedId],
    queryFn: () => assessmentHubService.getEvaluation(selectedId!),
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  const selected = useMemo(
    () =>
      selectedDetail ||
      attempts.find((a) => a.session_id === selectedId) ||
      null,
    [selectedDetail, attempts, selectedId]
  );

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Assessment Hub · Evaluation
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-navy-900" />
                Results & Evaluation
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Students get overall / section score, accuracy, time, weak & strong topics,
                recommendations, and next practice — AI automatically updates Learning Journey
                readiness on submit.
              </p>
            </div>
            <Link
              to="/app/superadmin/learning-journey"
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900"
            >
              <CheckCircle2 className="w-4 h-4" />
              Journey auto-update
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
            <p className="text-[10px] uppercase text-gray-400">Completed attempts</p>
            <p className="text-2xl font-semibold mt-1">
              {overview?.completedAttempts ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
            <p className="text-[10px] uppercase text-gray-400">Students evaluated</p>
            <p className="text-2xl font-semibold mt-1">
              {overview?.studentsEvaluated ?? "—"}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
            <p className="text-[10px] uppercase text-gray-400">Avg score</p>
            <p className="text-2xl font-semibold mt-1">
              {overview?.averageScore != null ? overview.averageScore : "—"}
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Student gets</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {STUDENT_GETS.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="rounded-xl border border-gray-200/70 bg-white p-3.5 shadow-admin-card"
                >
                  <div className={`inline-flex rounded-lg p-2 ${f.accent}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-gray-900">{f.title}</p>
                  <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">
                    {f.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-100 bg-white p-4 shadow-admin-card">
          <div className="flex flex-wrap items-start gap-3">
            <div className="rounded-lg bg-emerald-50 p-2.5 text-emerald-700">
              <Route className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-gray-900">
                AI automatically updates Learning Journey
              </h2>
              <p className="text-xs text-gray-500 mt-1 max-w-3xl">
                On exam submit, the Learning module blends overall score into{" "}
                <code className="text-[11px]">placement_readiness</code>, bumps progress, and
                logs an <code className="text-[11px]">assessment_evaluated</code> journey event
                (creates a Phase-1 journey if the student has none).
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 rounded-xl border border-gray-200/70 bg-white p-4 shadow-admin-card">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or assessment…"
                className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm"
              />
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16 text-gray-300">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : attempts.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center">
                <p className="text-sm text-gray-500">No completed attempts yet.</p>
                <Link
                  to="/app/superadmin/drives"
                  className="inline-flex items-center gap-1 mt-2 text-sm text-admin-accent hover:underline"
                >
                  Open Assessment Builder
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[32rem] overflow-y-auto">
                {attempts.map((a) => {
                  const active = a.session_id === selectedId;
                  return (
                    <li key={a.session_id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(a.session_id)}
                        className={`w-full text-left py-3 px-2 rounded-lg transition-colors ${
                          active ? "bg-navy-900/[0.06]" : "hover:bg-gray-50"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {a.student_name || a.student_email || "Student"}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                          {a.drive_name}
                          {a.overall_score != null ? ` · score ${a.overall_score}` : ""}
                          {a.accuracy != null ? ` · ${pct(a.accuracy)}` : ""}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="lg:col-span-3 rounded-xl border border-gray-200/70 bg-white p-5 shadow-admin-card min-h-[24rem]">
            {loadingDetail && selectedId ? (
              <div className="flex justify-center py-20 text-gray-300">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : selected ? (
              <EvaluationDetail ev={selected} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-20">
                Select an attempt to view evaluation.
              </p>
            )}
          </div>
        </section>

        <p className="text-xs text-gray-400">
          Pipeline: Attempt → Auto-grade →{" "}
          <strong className="font-medium text-gray-500">Results & Evaluation</strong> → AI
          Learning Journey readiness.
        </p>
      </div>
    </div>
  );
}
