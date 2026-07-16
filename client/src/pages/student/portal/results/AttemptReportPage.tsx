/**
 * Module 07 — Attempt Learning Intelligence report.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Bookmark,
  BookOpenCheck,
  Dumbbell,
  Loader2,
  Printer,
  Sparkles,
  Target,
} from "lucide-react";
import studentResultsAnalyticsService, {
  type ReviewQuestion,
} from "../../../../services/studentResultsAnalyticsService";
import studentAiCoachService from "../../../../services/studentAiCoachService";
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
} from "./components";

const PAGE_SIZE = 20;

function QuestionCard({
  q,
  onBookmark,
  bookmarking,
}: {
  q: ReviewQuestion;
  onBookmark: (id: string) => void;
  bookmarking: boolean;
}) {
  const [aiText, setAiText] = useState("");
  const [aiPending, setAiPending] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const explain = (mode: "explain" | "simplify" | "example" | "again") => {
    setAiBusy(true);
    setAiPending("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void studentAiCoachService.streamExplainQuestion(
      {
        question_id: q.question_id,
        question: q.question,
        student_answer: q.student_answer,
        correct_answer: q.correct_answer,
        skill: q.skill,
        topic: q.topic,
        difficulty: q.difficulty,
        bloom_level: q.bloom_level,
        learning_outcome: q.learning_outcome,
        mode,
      },
      {
        onDelta: (c) => setAiPending((p) => p + c),
        onDone: (r) => {
          setAiText(r.text || "");
          setAiPending("");
          setAiBusy(false);
        },
        onError: () => {
          toast.error("Could not explain question");
          setAiBusy(false);
          setAiPending("");
        },
      },
      controller.signal
    );
  };

  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{q.question}</h3>
        <PerformanceBadge
          label={q.is_correct === true ? "Correct" : q.is_correct === false ? "Wrong" : "Pending"}
        />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-slate-400">Skill</dt>
          <dd className="font-semibold text-slate-800">{q.skill}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Topic</dt>
          <dd className="font-semibold text-slate-800">{q.topic}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Difficulty</dt>
          <dd className="font-semibold text-slate-800">{q.difficulty}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Bloom</dt>
          <dd className="font-semibold text-slate-800">{q.bloom_level || "N/A"}</dd>
        </div>
        <div>
          <dt className="text-slate-400">Marks</dt>
          <dd className="font-semibold text-slate-800">
            {q.marks_awarded}/{q.marks_possible}
          </dd>
        </div>
        <div className="col-span-2 sm:col-span-3">
          <dt className="text-slate-400">Learning outcome</dt>
          <dd className="font-semibold text-slate-800">{q.learning_outcome || "—"}</dd>
        </div>
      </dl>
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="font-bold text-slate-500">Your answer</p>
          <p className="mt-0.5 text-slate-800">
            {q.student_answer?.length ? q.student_answer.join(", ") : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="font-bold text-slate-500">Correct answer</p>
          <p className="mt-0.5 text-slate-800">
            {q.correct_answer?.length ? q.correct_answer.join(", ") : "Hidden / N/A"}
          </p>
        </div>
      </div>
      {q.explanation && (
        <p className="mt-2 text-xs text-slate-600">
          <span className="font-bold">Explanation:</span> {q.explanation}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => explain("explain")}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {aiBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
          Explain with AI
        </button>
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => explain("simplify")}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Simplify
        </button>
        <button
          type="button"
          disabled={aiBusy}
          onClick={() => explain("example")}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Show example
        </button>
        <Link
          to={q.actions.practice_similar_href}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
        >
          <Target className="h-3 w-3" /> Practice similar
        </Link>
        <Link
          to={q.reference_lesson.href}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
        >
          <BookOpenCheck className="h-3 w-3" /> {q.reference_lesson.title}
        </Link>
        {q.actions.bookmarkable && (
          <button
            type="button"
            disabled={bookmarking}
            onClick={() => onBookmark(q.question_id)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Bookmark className="h-3 w-3" /> Bookmark
          </button>
        )}
      </div>
      {(aiPending || aiText) && (
        <div className="mt-3 whitespace-pre-wrap rounded-xl bg-indigo-50/50 p-3 text-xs text-slate-800">
          {aiPending || aiText}
        </div>
      )}
    </article>
  );
}

export default function AttemptReportPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [visible, setVisible] = useState(PAGE_SIZE);

  const summaryQ = useQuery({
    queryKey: ["m07-attempt", attemptId],
    queryFn: () => studentResultsAnalyticsService.getAttempt(attemptId!),
    enabled: !!attemptId,
    retry: false,
  });

  const questionsQ = useQuery({
    queryKey: ["m07-attempt-questions", attemptId],
    queryFn: () => studentResultsAnalyticsService.getAttemptQuestions(attemptId!),
    enabled: !!attemptId && summaryQ.isSuccess,
    staleTime: 60_000,
  });

  const skillsQ = useQuery({
    queryKey: ["m07-attempt-skills", attemptId],
    queryFn: () => studentResultsAnalyticsService.getSkills(attemptId),
    enabled: !!attemptId && summaryQ.isSuccess,
  });

  const bookmarkM = useMutation({
    mutationFn: (qid: string) =>
      studentResultsAnalyticsService.bookmarkQuestion(qid, { attempt_id: attemptId }),
    onSuccess: () => toast.success("Question bookmarked"),
    onError: () => toast.error("Could not bookmark question"),
  });

  const questions = questionsQ.data?.questions ?? [];
  const visibleQuestions = useMemo(() => questions.slice(0, visible), [questions, visible]);

  if (summaryQ.isLoading) return <LoadingBlock label="Loading report" />;
  if (summaryQ.isError || !summaryQ.data) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <ErrorBlock
          message={
            (summaryQ.error as { response?: { data?: { error?: string } } })?.response?.data
              ?.error || "Result not available."
          }
          onRetry={() => summaryQ.refetch()}
        />
        <Link
          to="/app/student-portal/results"
          className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-indigo-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Results
        </Link>
      </div>
    );
  }

  const s = summaryQ.data;

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-500 print:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/student-portal/results"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Results
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" /> Print report
        </button>
      </div>

      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Learning Intelligence</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">{s.assessment_name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {s.campaign_name} · Attempt {s.attempt_number}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricTile
          label="Overall score"
          value={`${s.overall_score}/${s.total_marks}`}
          hint={`${s.percentage}% · Grade ${s.grade || "—"}`}
        />
        <MetricTile label="Pass / Fail" value={s.pass_fail} hint={s.performance_category} />
        <MetricTile
          label="Duration"
          value={formatDuration(s.assessment_duration_seconds)}
          hint={formatWhen(s.submission_time)}
        />
        <MetricTile
          label="Readiness impact"
          value={
            s.placement_readiness_impact?.current != null
              ? `${s.placement_readiness_impact.current}%`
              : "—"
          }
          hint={s.placement_readiness_impact?.level}
        />
      </div>

      <AnalyticsCard title="Continue learning">
        <div className="flex flex-wrap gap-2">
          <Link
            to={s.continue_learning.practice_weak}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white"
          >
            <Dumbbell className="h-3.5 w-3.5" /> Practice weak topics
          </Link>
          <Link
            to={s.continue_learning.learning_hub}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
          >
            <BookOpenCheck className="h-3.5 w-3.5" /> Learning Hub
          </Link>
          <Link
            to={s.continue_learning.ai_coach}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
          >
            <Sparkles className="h-3.5 w-3.5" /> Ask AI Coach
          </Link>
          <Link
            to={s.continue_learning.retry_assessment}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
          >
            Retry assessment
          </Link>
        </div>
      </AnalyticsCard>

      <AnalyticsCard title="Skill breakdown for this attempt">
        {skillsQ.isLoading ? (
          <LoadingBlock />
        ) : !skillsQ.data?.skills?.length ? (
          <EmptyBlock title="No skill metadata on this attempt" />
        ) : (
          <ul className="space-y-3">
            {skillsQ.data.skills.map((sk) => (
              <li key={sk.skill_name}>
                <div className="flex justify-between text-sm">
                  <span className="font-bold">{sk.skill_name}</span>
                  <span className="font-black">{sk.percentage}%</span>
                </div>
                <div className="mt-1">
                  <ProgressBar value={sk.percentage} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </AnalyticsCard>

      <AnalyticsCard
        title="Question review"
        subtitle={`${questions.length} questions · Learning Intelligence metadata`}
      >
        {questionsQ.isLoading ? (
          <LoadingBlock label="Loading questions" />
        ) : questionsQ.isError ? (
          <ErrorBlock message="Couldn’t load question review." onRetry={() => questionsQ.refetch()} />
        ) : !questions.length ? (
          <EmptyBlock title="No question-level results" />
        ) : (
          <div className="space-y-3">
            {visibleQuestions.map((q) => (
              <QuestionCard
                key={q.question_id}
                q={q}
                onBookmark={(id) => bookmarkM.mutate(id)}
                bookmarking={bookmarkM.isPending}
              />
            ))}
            {visible < questions.length && (
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Load more ({questions.length - visible} remaining)
              </button>
            )}
          </div>
        )}
      </AnalyticsCard>
    </div>
  );
}
