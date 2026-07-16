// =============================================================================
// Student · Results & Evaluation
// Overall / section / time / weak-strong / AI recs / lessons / practice / journey
// =============================================================================

import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  Layers,
  Lightbulb,
  Loader2,
  Route,
  TrendingDown,
  TrendingUp,
  Crosshair,
} from "lucide-react";
import assessmentHubService, {
  type AttemptEvaluation,
} from "../../services/assessmentHubService";

const BASE = "/app/student-portal";

function pct(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function EvaluationBody({ ev }: { ev: AttemptEvaluation }) {
  const ta = ev.time_analysis;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Metric
          icon={Award}
          label="Overall score"
          value={
            ev.overall_score != null
              ? `${ev.overall_score}${ev.total_marks != null ? ` / ${ev.total_marks}` : ""}`
              : "—"
          }
          sub={ev.score_percent != null ? `${ev.score_percent}%` : undefined}
        />
        <Metric
          icon={Crosshair}
          label="Accuracy"
          value={pct(ev.accuracy)}
          sub={`${ev.questions_correct}/${ev.questions_attempted} correct`}
        />
        <Metric
          icon={Clock}
          label="Time spent"
          value={ta?.spent_label || ev.time_spent_label || "—"}
          sub={
            ta?.allotted_label
              ? `of ${ta.allotted_label}${ta.percent_used != null ? ` · ${ta.percent_used}%` : ""}`
              : undefined
          }
        />
        <Metric
          icon={Layers}
          label="Questions"
          value={`${ev.questions_total}`}
          sub={`${ev.questions_attempted} attempted`}
        />
      </div>

      <section className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4">
        <h2 className="text-sm font-semibold text-amber-900 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time analysis
        </h2>
        <p className="text-sm text-amber-900/90 mt-2">
          {ta?.pace_label || "Time data not available for this attempt."}
        </p>
        <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-amber-700/70">Allotted</dt>
            <dd className="font-semibold text-amber-950">{ta?.allotted_label || "—"}</dd>
          </div>
          <div>
            <dt className="text-amber-700/70">Unused</dt>
            <dd className="font-semibold text-amber-950">
              {ta?.unused_seconds != null
                ? `${Math.floor(ta.unused_seconds / 60)}m ${ta.unused_seconds % 60}s`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-amber-700/70">Avg / question</dt>
            <dd className="font-semibold text-amber-950">
              {ta?.avg_seconds_per_question != null
                ? `${ta.avg_seconds_per_question}s`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
          <Layers className="h-4 w-4 text-violet-600" />
          Section scores
        </h2>
        {ev.section_scores.length === 0 ? (
          <p className="text-sm text-slate-400">No skill-tagged sections on this paper.</p>
        ) : (
          <ul className="space-y-2">
            {ev.section_scores.map((s) => (
              <li
                key={s.section}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3"
              >
                <span className="text-sm font-medium text-slate-800 truncate">
                  {s.section.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-slate-500 shrink-0">
                  {s.marks_earned}/{s.marks_available} · {pct(s.accuracy)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <TopicCard title="Weak topics" items={ev.weak_topics} tone="weak" />
        <TopicCard title="Strong topics" items={ev.strong_topics} tone="strong" />
      </div>

      <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
        <h2 className="text-sm font-semibold text-violet-900 flex items-center gap-2">
          <Lightbulb className="h-4 w-4" />
          AI recommendations
          {ev.ai_recommendations_enriched ? (
            <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-white px-1.5 py-0.5 rounded">
              AI
            </span>
          ) : null}
        </h2>
        <ul className="mt-3 space-y-2">
          {ev.recommendations.map((r) => (
            <li key={r} className="text-sm text-violet-950/90 flex gap-2">
              <Lightbulb className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <section className="rounded-2xl border border-teal-100 bg-teal-50/40 p-4">
          <h2 className="text-sm font-semibold text-teal-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Related lesson
          </h2>
          {ev.recommended_lesson?.title ? (
            <>
              <p className="text-sm text-teal-900 mt-2">{ev.recommended_lesson.title}</p>
              <Link
                to={ev.recommended_lesson.href || `${BASE}/adaptive-learning`}
                className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-teal-800 hover:underline"
              >
                Open lesson
                <ArrowRight className="h-3 w-3" />
              </Link>
            </>
          ) : (
            <p className="text-sm text-teal-800/70 mt-2">
              Complete more attempts to unlock a Knowledge Library lesson match.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
          <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
            <Compass className="h-4 w-4" />
            Suggested practice
          </h2>
          <p className="text-sm text-indigo-900 mt-2">
            {ev.next_practice.topic || "General practice"}
            {ev.next_practice.difficulty ? ` · ${ev.next_practice.difficulty}` : ""}
            {ev.next_practice.estimated_minutes != null
              ? ` · ~${ev.next_practice.estimated_minutes} min`
              : ""}
          </p>
          {ev.next_practice.question_preview ? (
            <p className="text-xs text-indigo-800/70 mt-1 line-clamp-2">
              {ev.next_practice.question_preview}
            </p>
          ) : null}
          <Link
            to={ev.next_practice.practice_href || `${BASE}/practice`}
            className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-indigo-800 hover:underline"
          >
            Start practice
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>
      </div>

      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-4">
        <h2 className="text-sm font-semibold text-emerald-900 flex items-center gap-2">
          <Route className="h-4 w-4" />
          Learning Journey update
        </h2>
        <p className="text-sm text-emerald-900/90 mt-2">
          {ev.learning_journey.updated || ev.learning_loop?.journey_updated
            ? "This attempt updated your Learning Journey and placement readiness."
            : "Your journey updates automatically after submit — refresh in a moment if status is pending."}
        </p>
        <p className="text-xs text-emerald-800/80 mt-1">
          Active journeys: {ev.learning_journey.journeys_touched}
          {ev.learning_journey.avg_readiness != null
            ? ` · readiness ~${ev.learning_journey.avg_readiness}%`
            : ""}
        </p>
        {ev.learning_loop ? (
          <ul className="mt-3 grid grid-cols-2 gap-1.5">
            {(
              [
                ["evaluated", "Evaluated"],
                ["weak_skills_detected", "Weak skills"],
                ["lesson_recommended", "Lesson"],
                ["practice_assigned", "Practice"],
                ["journey_updated", "Journey"],
                ["readiness_recalculated", "Readiness"],
              ] as const
            ).map(([key, label]) => (
              <li key={key} className="flex items-center gap-1.5 text-[11px] text-emerald-900">
                <CheckCircle2
                  className={`h-3 w-3 shrink-0 ${
                    ev.learning_loop?.[key] ? "text-emerald-600" : "text-slate-300"
                  }`}
                />
                {label}
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          to={`${BASE}/adaptive-learning`}
          className="inline-flex items-center gap-1 mt-3 text-xs font-bold text-emerald-800 hover:underline"
        >
          Open Adaptive Learning
          <ArrowRight className="h-3 w-3" />
        </Link>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof Award;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] uppercase tracking-wide text-slate-400 flex items-center gap-1.5">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p className="text-lg font-bold text-slate-900 mt-1">{value}</p>
      {sub ? <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p> : null}
    </div>
  );
}

function TopicCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "weak" | "strong";
}) {
  const Icon = tone === "weak" ? TrendingDown : TrendingUp;
  return (
    <div
      className={`rounded-2xl border px-4 py-3 ${
        tone === "weak"
          ? "border-rose-100 bg-rose-50/50"
          : "border-teal-100 bg-teal-50/50"
      }`}
    >
      <p className="text-sm font-semibold text-slate-800 flex items-center gap-2">
        <Icon
          className={`h-4 w-4 ${tone === "weak" ? "text-rose-600" : "text-teal-600"}`}
        />
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400 mt-2">None flagged yet</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {items.map((t) => (
            <li
              key={t}
              className={`text-xs px-2 py-0.5 rounded-lg bg-white ${
                tone === "weak" ? "text-rose-700" : "text-teal-700"
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

export default function ResultsAnalysisPage() {
  const { driveId } = useParams<{ driveId: string }>();
  const navigate = useNavigate();

  const { data: ev, isLoading, error } = useQuery({
    queryKey: ["student-evaluation", driveId],
    queryFn: () => assessmentHubService.getStudentDriveEvaluation(driveId!),
    enabled: !!driveId,
    retry: 1,
  });

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6 animate-in fade-in duration-300">
      <div>
        <button
          type="button"
          onClick={() => navigate(`${BASE}/tests`)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Tests &amp; Mocks
        </button>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">Results &amp; Evaluation</h1>
        {ev ? (
          <p className="text-sm text-slate-500 mt-1">
            {ev.drive_name}
            {ev.completed_at
              ? ` · ${new Date(ev.completed_at).toLocaleString()}`
              : ""}
          </p>
        ) : (
          <p className="text-sm text-slate-500 mt-1">
            Overall score, sections, time, topics, AI coaching, and journey update.
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : error || !ev ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-600">
            {(error as { response?: { data?: { error?: string } } })?.response?.data
              ?.error || "No completed results found for this assessment."}
          </p>
          <Link
            to={`${BASE}/tests`}
            className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-indigo-600 hover:underline"
          >
            Back to tests
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <EvaluationBody ev={ev} />
      )}
    </div>
  );
}
