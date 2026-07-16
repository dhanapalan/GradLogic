/**
 * Module 08 — Gradlogic AI Learning Coach (single entry point).
 */
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Dumbbell,
  Flame,
  Loader2,
  MessageSquare,
  RefreshCw,
  Route,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import studentAiCoachService, {
  type ChatTurn,
  type LiCard,
} from "../../../../services/studentAiCoachService";
import studentResultsAnalyticsService from "../../../../services/studentResultsAnalyticsService";
import {
  CoachCard,
  CoachMarkdown,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PriorityBadge,
  RecommendationCard,
} from "./components";
import ChatPanel from "./ChatPanel";

const PlacementCoachLegacy = lazy(() => import("../../PlacementCoachPage"));

type TabId =
  | "home"
  | "learn"
  | "practice"
  | "plan"
  | "explain"
  | "weak"
  | "progress"
  | "ask"
  | "journey"
  | "interview";

const TABS: { id: TabId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "learn", label: "Learn" },
  { id: "practice", label: "Practice" },
  { id: "plan", label: "Study Plan" },
  { id: "explain", label: "Explain Results" },
  { id: "weak", label: "Weak Areas" },
  { id: "progress", label: "Progress" },
  { id: "ask", label: "Ask AI" },
  { id: "journey", label: "Continue" },
  { id: "interview", label: "Interview Prep" },
];

function Widget({
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
        message={(query.error as { message?: string })?.message || `Failed to load ${title}`}
        onRetry={() => query.refetch()}
      />
    );
  }
  return (
    <CoachCard title={title} subtitle={subtitle}>
      {children}
    </CoachCard>
  );
}

export default function AiCoachPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabId) || "home";
  const setTab = (id: TabId) => {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };

  const dashQ = useQuery({
    queryKey: ["m08-dashboard"],
    queryFn: () => studentAiCoachService.getDashboard(),
    staleTime: 45_000,
  });
  const recsQ = useQuery({
    queryKey: ["m08-recs"],
    queryFn: () => studentAiCoachService.getRecommendations(),
    staleTime: 60_000,
    enabled: tab === "home" || tab === "learn" || tab === "journey",
  });
  const practiceQ = useQuery({
    queryKey: ["m08-practice"],
    queryFn: () => studentAiCoachService.getPracticeRecommendations(),
    staleTime: 60_000,
    enabled: tab === "practice" || tab === "home",
  });
  const planQ = useQuery({
    queryKey: ["m08-plan"],
    queryFn: () => studentAiCoachService.getStudyPlan(),
    staleTime: 60_000,
    enabled: tab === "plan",
  });
  const weakQ = useQuery({
    queryKey: ["m08-weak"],
    queryFn: () => studentAiCoachService.getWeakAreas(),
    staleTime: 60_000,
    enabled: tab === "weak" || tab === "home",
  });
  const progressQ = useQuery({
    queryKey: ["m08-progress"],
    queryFn: () => studentAiCoachService.getProgress(),
    staleTime: 60_000,
    enabled: tab === "progress",
  });
  const historyQ = useQuery({
    queryKey: ["m08-history"],
    queryFn: () => studentResultsAnalyticsService.getHistory({ status: "completed", limit: 20 }),
    staleTime: 60_000,
    enabled: tab === "explain",
  });

  const [attemptId, setAttemptId] = useState("");
  const [explainText, setExplainText] = useState("");
  const [explainPending, setExplainPending] = useState("");
  const [explainBusy, setExplainBusy] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainHistory, setExplainHistory] = useState<ChatTurn[]>([]);
  const abortExplain = useRef<AbortController | null>(null);

  const contextQ = useQuery({
    queryKey: ["m08-explain-ctx", attemptId],
    queryFn: () => studentAiCoachService.getExplainResultContext(attemptId),
    enabled: !!attemptId && tab === "explain",
    retry: false,
  });

  const regenPlan = useMutation({
    mutationFn: () => studentAiCoachService.generateStudyPlan(5),
    onSuccess: () => planQ.refetch(),
  });

  useEffect(() => () => abortExplain.current?.abort(), []);

  const dash = dashQ.data as {
    greeting?: string;
    todays_goal?: string;
    placement_readiness?: { score: number; level: string; improvement: number | null };
    learning_progress?: {
      overall_score: number | null;
      category: string | null;
      assessments_completed: number;
    };
    todays_recommendations?: LiCard[];
    pending_practice?: LiCard | null;
    weakest_skill?: { name: string; percentage: number } | null;
    strongest_skill?: { name: string; percentage: number } | null;
    current_streak?: number;
    estimated_study_minutes?: number | null;
    quick_actions?: Record<string, string>;
    upcoming_assessments?: Array<{ assessment_name?: string; campaign_name?: string }>;
  } | undefined;

  const runExplain = () => {
    if (!attemptId || explainBusy) return;
    setExplainBusy(true);
    setExplainError(null);
    setExplainPending("");
    abortExplain.current?.abort();
    const controller = new AbortController();
    abortExplain.current = controller;
    void studentAiCoachService.streamExplainResult(
      { attempt_id: attemptId, history: explainHistory },
      {
        onDelta: (c) => setExplainPending((p) => p + c),
        onDone: (r) => {
          setExplainText(r.text || "");
          setExplainHistory((h) => [
            ...h,
            { role: "student", text: "Explain my results" },
            { role: "coach", text: r.text || "" },
          ]);
          setExplainPending("");
          setExplainBusy(false);
        },
        onError: (m) => {
          setExplainError(m);
          setExplainBusy(false);
          setExplainPending("");
        },
      },
      controller.signal
    );
  };

  const voiceLessons = useMemo(
    () => ((recsQ.data as { voice_lessons?: LiCard[] })?.voice_lessons || []) as LiCard[],
    [recsQ.data]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in duration-500">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">AI</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">AI Coach</h1>
          <p className="mt-1 text-sm text-slate-500">
            What should you learn and practice next? Guided by Learning Intelligence.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void dashQ.refetch();
            void recsQ.refetch();
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1 shadow-sm"
        aria-label="AI Coach modules"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${
              tab === t.id
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
            aria-current={tab === t.id ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "home" && (
        <div className="space-y-4">
          <Widget title="Today" query={dashQ}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                <p className="text-lg font-black text-slate-900">{dash?.greeting}</p>
                <p className="text-sm text-slate-600">
                  <span className="font-bold text-slate-800">Today&apos;s goal:</span>{" "}
                  {dash?.todays_goal}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat
                    label="Readiness"
                    value={
                      dash?.placement_readiness?.score != null
                        ? `${dash.placement_readiness.score}%`
                        : "—"
                    }
                    hint={dash?.placement_readiness?.level}
                  />
                  <Stat
                    label="Progress"
                    value={
                      dash?.learning_progress?.overall_score != null
                        ? `${dash.learning_progress.overall_score}%`
                        : "—"
                    }
                    hint={dash?.learning_progress?.category || undefined}
                  />
                  <Stat
                    label="Streak"
                    value={`${dash?.current_streak ?? 0}`}
                    hint="days"
                    icon={<Flame className="h-3.5 w-3.5 text-orange-500" />}
                  />
                  <Stat
                    label="Study time"
                    value={
                      dash?.estimated_study_minutes != null
                        ? `${dash.estimated_study_minutes}m`
                        : "—"
                    }
                    hint="estimated today"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Quick actions
                </p>
                {[
                  { label: "Continue Learning", href: dash?.quick_actions?.continue_learning, icon: BookOpenCheck },
                  { label: "Practice Weak Topics", href: dash?.quick_actions?.practice_weak, icon: Dumbbell },
                  { label: "Explain Last Assessment", href: undefined, onClick: () => setTab("explain"), icon: Target },
                  { label: "Ask AI", href: undefined, onClick: () => setTab("ask"), icon: MessageSquare },
                ].map((a) =>
                  a.href ? (
                    <Link
                      key={a.label}
                      to={a.href}
                      className="flex items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      <a.icon className="h-4 w-4 text-indigo-500" />
                      {a.label}
                    </Link>
                  ) : (
                    <button
                      key={a.label}
                      type="button"
                      onClick={a.onClick}
                      className="flex w-full items-center gap-2 rounded-xl border border-slate-100 px-3 py-2 text-left text-xs font-bold text-slate-800 hover:bg-slate-50"
                    >
                      <a.icon className="h-4 w-4 text-indigo-500" />
                      {a.label}
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-emerald-50/60 p-3">
                <p className="text-[10px] font-bold uppercase text-emerald-700">Strongest skill</p>
                <p className="text-sm font-black text-slate-900">
                  {dash?.strongest_skill?.name || "—"}{" "}
                  {dash?.strongest_skill != null ? `(${dash.strongest_skill.percentage}%)` : ""}
                </p>
              </div>
              <div className="rounded-xl bg-rose-50/60 p-3">
                <p className="text-[10px] font-bold uppercase text-rose-700">Weakest skill</p>
                <p className="text-sm font-black text-slate-900">
                  {dash?.weakest_skill?.name || "—"}{" "}
                  {dash?.weakest_skill != null ? `(${dash.weakest_skill.percentage}%)` : ""}
                </p>
              </div>
            </div>
          </Widget>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <Widget title="Today's recommendations" query={recsQ}>
              <div className="space-y-2">
                {(dash?.todays_recommendations || []).map((c) => (
                  <RecommendationCard key={`${c.kind}-${c.title}`} card={c} />
                ))}
                {!dash?.todays_recommendations?.length && (
                  <EmptyBlock title="No recommendations yet" hint="Complete practice or assessments to personalize." />
                )}
              </div>
            </Widget>
            <Widget title="Pending practice" query={dashQ}>
              {dash?.pending_practice ? (
                <RecommendationCard card={dash.pending_practice} />
              ) : (
                <EmptyBlock title="No pending practice" />
              )}
              {(dash?.upcoming_assessments?.length || 0) > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">
                    Upcoming assessments
                  </p>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {dash!.upcoming_assessments!.map((u, i) => (
                      <li key={i}>
                        {u.assessment_name || "Assessment"}
                        {u.campaign_name ? ` · ${u.campaign_name}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Widget>
          </div>
        </div>
      )}

      {tab === "learn" && (
        <Widget
          title="Learning recommendations"
          subtitle="Voice lesson → notes → practice → assessment"
          query={recsQ}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <RecGroup title="Voice lessons" items={voiceLessons} />
            <RecGroup
              title="Practice sets"
              items={((recsQ.data as { practice_sets?: LiCard[] })?.practice_sets || []) as LiCard[]}
            />
            <RecGroup
              title="Question library"
              items={
                ((recsQ.data as { question_library?: LiCard[] })?.question_library || []) as LiCard[]
              }
            />
            <RecGroup
              title="Assessments"
              items={((recsQ.data as { assessments?: LiCard[] })?.assessments || []) as LiCard[]}
            />
          </div>
        </Widget>
      )}

      {tab === "practice" && (
        <Widget title="Practice recommendations" query={practiceQ}>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {(practiceQ.data?.recommendations || []).map((c) => (
              <RecommendationCard key={c.kind} card={c} />
            ))}
          </div>
        </Widget>
      )}

      {tab === "plan" && (
        <Widget title="Study planner" subtitle="Daily · Weekly · Assessment prep" query={planQ}>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              disabled={regenPlan.isPending}
              onClick={() => regenPlan.mutate()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50"
            >
              {regenPlan.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Route className="h-3.5 w-3.5" />
              )}
              Regenerate plan
            </button>
          </div>
          <StudyPlanView data={planQ.data as Record<string, unknown> | undefined} />
        </Widget>
      )}

      {tab === "explain" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <CoachCard title="Explain my results" subtitle="Select a published assessment">
            {historyQ.isLoading ? (
              <LoadingBlock />
            ) : (
              <select
                value={attemptId}
                onChange={(e) => {
                  setAttemptId(e.target.value);
                  setExplainText("");
                  setExplainHistory([]);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                aria-label="Select assessment"
              >
                <option value="">Choose assessment…</option>
                {(historyQ.data?.data || [])
                  .filter((r) => r.evaluation_status === "published")
                  .map((r) => (
                    <option key={r.attempt_id} value={r.attempt_id}>
                      {r.assessment_name} · {r.percentage}%
                    </option>
                  ))}
              </select>
            )}
            {contextQ.isLoading && attemptId && <div className="mt-3"><LoadingBlock /></div>}
            {contextQ.data && (
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <p className="text-sm font-bold text-slate-900">
                  {(contextQ.data as { overall_summary?: { percentage?: number; grade?: string; pass_fail?: string } })
                    .overall_summary?.percentage}
                  % · Grade{" "}
                  {
                    (contextQ.data as { overall_summary?: { grade?: string } }).overall_summary
                      ?.grade
                  }{" "}
                  ·{" "}
                  {
                    (contextQ.data as { overall_summary?: { pass_fail?: string } }).overall_summary
                      ?.pass_fail
                  }
                </p>
                <p>{(contextQ.data as { ai_prompt_context?: string }).ai_prompt_context}</p>
                <button
                  type="button"
                  disabled={explainBusy}
                  onClick={runExplain}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  {explainBusy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Explain with AI
                </button>
              </div>
            )}
            {explainError && <div className="mt-2"><ErrorBlock message={explainError} /></div>}
            {(explainPending || explainText) && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3">
                <CoachMarkdown text={explainPending || explainText} />
              </div>
            )}
          </CoachCard>
          <CoachCard title="Learning Intelligence snapshot">
            {!attemptId ? (
              <EmptyBlock title="Select an assessment" />
            ) : contextQ.isError ? (
              <ErrorBlock
                message="Result not available or not published."
                onRetry={() => contextQ.refetch()}
              />
            ) : (
              <div className="space-y-3 text-xs">
                <SnapList
                  title="Strengths"
                  items={
                    (
                      (contextQ.data as { strengths?: { top_skills?: Array<{ skill_name: string }> } })
                        ?.strengths?.top_skills || []
                    ).map((s) => s.skill_name)
                  }
                />
                <SnapList
                  title="Weak areas"
                  items={
                    (
                      (
                        contextQ.data as {
                          weak_areas?: { weak_skills?: Array<{ skill_name: string; percentage: number }> };
                        }
                      )?.weak_areas?.weak_skills || []
                    ).map((s) => `${s.skill_name} (${s.percentage}%)`)
                  }
                />
              </div>
            )}
          </CoachCard>
        </div>
      )}

      {tab === "weak" && (
        <Widget title="Weak area center" query={weakQ}>
          <div className="space-y-3">
            {(
              (weakQ.data as { weak_skills?: Array<Record<string, unknown>> })?.weak_skills || []
            ).map((w) => (
              <div
                key={String(w.skill)}
                className="rounded-xl border border-slate-100 p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{String(w.skill)}</p>
                  <span className="text-sm font-black">{String(w.percentage)}%</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">{String(w.estimated_improvement)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Link
                    to={String((w.recommended_lesson as { href?: string })?.href || "/app/student-portal/my-learning")}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                  >
                    {(w.recommended_lesson as { title?: string })?.title || "Lesson"}
                  </Link>
                  <Link
                    to={String((w.recommended_practice as { href?: string })?.href || "/app/student-portal/practice")}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                  >
                    Practice
                  </Link>
                </div>
              </div>
            ))}
            {!((weakQ.data as { weak_skills?: unknown[] })?.weak_skills || []).length && (
              <EmptyBlock title="No weak areas flagged" hint="Keep practicing — insights appear after assessments." />
            )}
          </div>
        </Widget>
      )}

      {tab === "progress" && (
        <Widget title="Learning progress" query={progressQ}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Readiness" value={`${(progressQ.data as { current_readiness?: number })?.current_readiness ?? "—"}%`} />
            <Stat label="Performance" value={`${(progressQ.data as { overall_performance?: number })?.overall_performance ?? "—"}%`} />
            <Stat label="Streak" value={`${(progressQ.data as { current_streak?: number })?.current_streak ?? 0}`} />
            <Stat label="Learning hours" value={`${(progressQ.data as { learning_hours?: number })?.learning_hours ?? 0}`} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">Skills improved</p>
            <ul className="space-y-1 text-sm text-slate-700">
              {(
                (progressQ.data as { skills_improved?: Array<{ skill: string; percentage: number }> })
                  ?.skills_improved || []
              ).map((s) => (
                <li key={s.skill}>
                  {s.skill} · {s.percentage}%
                </li>
              ))}
            </ul>
          </div>
        </Widget>
      )}

      {tab === "ask" && <ChatPanel />}

      {tab === "journey" && (
        <CoachCard title="Continue journey" subtitle="Voice → Practice → Assess → Improve">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Continue voice lesson", href: "/app/student-portal/adaptive-learning", icon: BookOpenCheck },
              { label: "Continue practice", href: dash?.quick_actions?.practice_weak || "/app/student-portal/practice", icon: Dumbbell },
              { label: "Recommended assessment", href: "/app/student-portal/my-assessments", icon: Target },
              { label: "Review mistakes", href: "/app/student-portal/results", icon: TrendingUp },
              { label: "Knowledge revision", href: "/app/student-portal/question-bank", icon: RefreshCw },
              { label: "Ask AI Coach", href: undefined, onClick: () => setTab("ask"), icon: MessageSquare },
            ].map((a) =>
              a.href ? (
                <Link
                  key={a.label}
                  to={a.href}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-sm font-bold text-slate-800 hover:bg-indigo-50/40"
                >
                  <a.icon className="h-4 w-4 text-indigo-500" />
                  {a.label}
                </Link>
              ) : (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  className="flex items-center gap-2 rounded-xl border border-slate-100 p-3 text-left text-sm font-bold text-slate-800 hover:bg-indigo-50/40"
                >
                  <a.icon className="h-4 w-4 text-indigo-500" />
                  {a.label}
                </button>
              )
            )}
          </div>
          {voiceLessons[0] && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-bold uppercase text-slate-400">
                Knowledge revision / voice
              </p>
              <RecommendationCard card={voiceLessons[0]} />
            </div>
          )}
        </CoachCard>
      )}

      {tab === "interview" && (
        <Suspense fallback={<LoadingBlock label="Loading interview coach" />}>
          <div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm">
            <p className="mb-2 px-3 pt-2 text-xs text-slate-500">
              Future-ready capability: Interview / Placement Coach plugs into the same AI entry point.
            </p>
            <PlacementCoachLegacy />
          </div>
        </Suspense>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-xl font-black text-slate-900">{value}</p>
      {hint && <p className="text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

function RecGroup({ title, items }: { title: string; items: LiCard[] }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="space-y-2">
        {items.slice(0, 4).map((c) => (
          <RecommendationCard key={`${title}-${c.title}`} card={c} />
        ))}
        {!items.length && <p className="text-xs text-slate-400">None right now</p>}
      </div>
    </div>
  );
}

function SnapList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">{title}</p>
      <ul className="space-y-1 text-slate-700">
        {items.length ? items.map((i) => <li key={i}>{i}</li>) : <li className="text-slate-400">—</li>}
      </ul>
    </div>
  );
}

function StudyPlanView({ data }: { data?: Record<string, unknown> }) {
  if (!data) return <EmptyBlock title="No study plan" />;
  const daily = data.daily_plan as {
    steps?: Array<{ order: number; type: string; title: string; href: string; minutes: number }>;
    estimated_minutes?: number;
  };
  const weekly = data.weekly_plan as {
    days?: Array<{ day: number; skill: string; estimated_minutes: number }>;
    total_estimated_minutes?: number;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-slate-800">Today</p>
          <span className="text-xs font-bold text-slate-500">
            ~{daily?.estimated_minutes ?? 0} min
          </span>
        </div>
        <ol className="space-y-2">
          {(daily?.steps || []).map((s) => (
            <li key={s.order}>
              <Link
                to={s.href}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
              >
                <span className="font-bold text-slate-900">
                  {s.order}. {s.title}
                </span>
                <span className="text-xs text-slate-500">{s.minutes}m · {s.type.replace(/_/g, " ")}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <p className="mb-2 text-xs font-bold text-slate-800">
          Weekly · ~{weekly?.total_estimated_minutes ?? 0} min
        </p>
        <ul className="space-y-1 text-xs text-slate-700">
          {(weekly?.days || []).map((d) => (
            <li key={d.day}>
              Day {d.day}: {String(d.skill).replace(/_/g, " ")} · {d.estimated_minutes}m
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
