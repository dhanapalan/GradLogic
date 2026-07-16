import { lazy, Suspense, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Flame,
  GraduationCap,
  Clock,
  Award,
  TrendingUp,
  Play,
  Search,
  Calendar,
  Bookmark,
  Sparkles,
  Route,
} from "lucide-react";
import studentLearningService, {
  type LearningCourse,
  type LearningSummary,
} from "../../../../services/studentLearningService";
import {
  BASE,
  CourseCard,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  PathCard,
  ProgressBar,
  SummaryTile,
} from "./components";

const HeavyPanels = lazy(() => import("./HeavyPanels"));

const SCOPES = [
  { id: "all", label: "All" },
  { id: "assigned", label: "Assigned" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "overdue", label: "Overdue" },
] as const;

export default function MyLearningPage() {
  const [params, setParams] = useSearchParams();
  const scope = params.get("scope") || "all";
  const search = params.get("q") || "";
  const category = params.get("category") || "";
  const difficulty = params.get("difficulty") || "";
  const [qDraft, setQDraft] = useState(search);

  const summaryQ = useQuery({
    queryKey: ["learning-summary"],
    queryFn: () => studentLearningService.getSummary(),
    staleTime: 30_000,
  });
  const continueQ = useQuery({
    queryKey: ["learning-continue"],
    queryFn: async () => {
      const dash = (await studentLearningService.getDashboard()) as {
        continue_learning: {
          course_id: string;
          course_title: string;
          progress_percent: number;
          lesson_id?: string | null;
          lesson_title?: string | null;
          estimated_remaining_minutes?: number | null;
        } | null;
      };
      return dash.continue_learning;
    },
    staleTime: 20_000,
  });
  const pathsQ = useQuery({
    queryKey: ["learning-paths"],
    queryFn: () => studentLearningService.getPaths(),
    staleTime: 60_000,
  });
  const coursesQ = useQuery({
    queryKey: ["learning-courses", scope, search, category, difficulty],
    queryFn: () =>
      studentLearningService.getCourses({
        scope,
        search: search || undefined,
        category: category || undefined,
        difficulty: difficulty || undefined,
      }),
    staleTime: 30_000,
  });
  const recsQ = useQuery({
    queryKey: ["learning-recommendations"],
    queryFn: () => studentLearningService.getRecommendations(),
    staleTime: 60_000,
  });
  const eventsQ = useQuery({
    queryKey: ["learning-events"],
    queryFn: () => studentLearningService.getLearningEvents(21),
    staleTime: 60_000,
  });

  const summary = summaryQ.data as LearningSummary | undefined;
  const courses = (coursesQ.data || []) as LearningCourse[];
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const c of courses) if (c.category) set.add(c.category);
    return [...set].sort();
  }, [courses]);

  const applySearch = () => {
    const next = new URLSearchParams(params);
    if (qDraft.trim()) next.set("q", qDraft.trim());
    else next.delete("q");
    setParams(next);
  };

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Learn</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Learning Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Voice lessons, learning paths, notes, continue learning, and AI-guided next steps.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`${BASE}/progress`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
          >
            Progress
          </Link>
          <Link
            to={`${BASE}/bookmarks`}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
          >
            <Bookmark className="h-3.5 w-3.5" /> Bookmarks
          </Link>
          <Link
            to="/app/student-portal/learn"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
          >
            Skill Programs
          </Link>
        </div>
      </header>

      {/* Summary */}
      {summaryQ.isLoading ? (
        <LoadingBlock label="Loading summary" />
      ) : summaryQ.isError ? (
        <ErrorBlock message="Couldn’t load learning summary." onRetry={() => summaryQ.refetch()} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-7">
          <SummaryTile label="Assigned" value={summary.total_assigned_courses} icon={BookOpen} />
          <SummaryTile label="In Progress" value={summary.courses_in_progress} icon={TrendingUp} />
          <SummaryTile label="Completed" value={summary.completed_courses} icon={GraduationCap} />
          <SummaryTile label="Hours" value={summary.learning_hours} icon={Clock} />
          <SummaryTile label="Certificates" value={summary.certificates_earned} icon={Award} />
          <SummaryTile label="Streak" value={`${summary.learning_streak_days}d`} icon={Flame} />
          <div className="col-span-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm md:col-span-3 xl:col-span-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Overall</p>
            <p className="mt-1 text-2xl font-black text-indigo-600">{summary.overall_progress_percent}%</p>
            <ProgressBar value={summary.overall_progress_percent} />
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-6">
          {/* Continue */}
          <section aria-labelledby="continue-heading">
            <h2 id="continue-heading" className="mb-3 text-sm font-black text-slate-900">
              Continue Learning
            </h2>
            {continueQ.isLoading ? (
              <LoadingBlock />
            ) : continueQ.data ? (
              <div className="flex flex-col gap-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-white p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-indigo-500">Last accessed</p>
                  <p className="truncate text-lg font-black text-slate-900">{continueQ.data.course_title}</p>
                  {continueQ.data.lesson_title && (
                    <p className="mt-0.5 text-sm text-slate-600">Current: {continueQ.data.lesson_title}</p>
                  )}
                  <div className="mt-3 max-w-sm">
                    <ProgressBar value={continueQ.data.progress_percent} label="Course progress" />
                  </div>
                  {continueQ.data.estimated_remaining_minutes != null && (
                    <p className="mt-2 text-xs text-slate-500">
                      ~{continueQ.data.estimated_remaining_minutes} min remaining in lesson
                    </p>
                  )}
                </div>
                <Link
                  to={
                    continueQ.data.lesson_id
                      ? `${BASE}/lessons/${continueQ.data.lesson_id}`
                      : `${BASE}/courses/${continueQ.data.course_id}`
                  }
                  className="inline-flex min-h-12 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white hover:bg-indigo-700 sm:w-auto"
                >
                  <Play className="h-4 w-4" /> Continue
                </Link>
              </div>
            ) : (
              <EmptyBlock title="Nothing in progress yet" hint="Open an assigned course to start learning." />
            )}
          </section>

          {/* Paths */}
          <section aria-labelledby="paths-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="paths-heading" className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
                <Route className="h-4 w-4 text-indigo-500" /> Assigned Learning Paths
              </h2>
            </div>
            {pathsQ.isLoading ? (
              <LoadingBlock />
            ) : pathsQ.isError ? (
              <ErrorBlock message="Couldn’t load learning paths." onRetry={() => pathsQ.refetch()} />
            ) : !pathsQ.data?.length ? (
              <EmptyBlock title="No learning paths published yet" />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pathsQ.data.map((p) => (
                  <PathCard key={p.id} path={p} />
                ))}
              </div>
            )}
          </section>

          {/* Courses */}
          <section aria-labelledby="courses-heading">
            <h2 id="courses-heading" className="mb-3 text-sm font-black text-slate-900">
              My Courses
            </h2>

            <div className="mb-4 space-y-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={qDraft}
                    onChange={(e) => setQDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && applySearch()}
                    placeholder="Search courses, skills…"
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
                    aria-label="Search courses"
                  />
                </div>
                <button
                  type="button"
                  onClick={applySearch}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
                >
                  Search
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Course status filters">
                {SCOPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setFilter("scope", s.id)}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${
                      scope === s.id
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                    }`}
                    aria-pressed={scope === s.id}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={category}
                  onChange={(e) => setFilter("category", e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  aria-label="Filter by category"
                >
                  <option value="">Category</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={difficulty}
                  onChange={(e) => setFilter("difficulty", e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                  aria-label="Filter by difficulty"
                >
                  <option value="">Difficulty</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            {coursesQ.isLoading ? (
              <LoadingBlock />
            ) : coursesQ.isError ? (
              <ErrorBlock message="Couldn’t load courses." onRetry={() => coursesQ.refetch()} />
            ) : courses.length === 0 ? (
              <EmptyBlock title="No courses match these filters" />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {courses.map((c) => (
                  <CourseCard key={c.id} course={c} />
                ))}
              </div>
            )}
          </section>

          <Suspense fallback={<LoadingBlock label="Loading more panels" />}>
            <HeavyPanels />
          </Suspense>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-labelledby="recs-heading">
            <h2 id="recs-heading" className="mb-3 inline-flex items-center gap-1.5 text-sm font-black text-slate-900">
              <Sparkles className="h-4 w-4 text-amber-500" /> AI Recommendations
            </h2>
            {recsQ.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-slate-50" />
            ) : !recsQ.data?.length ? (
              <p className="text-xs text-slate-400">Recommendations will appear as you learn.</p>
            ) : (
              <ul className="space-y-2">
                {recsQ.data.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={r.href}
                      className="block rounded-xl border border-slate-100 px-3 py-2 hover:border-indigo-100 hover:bg-indigo-50/40"
                    >
                      <p className="text-xs font-bold text-slate-900">{r.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">{r.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-labelledby="deadlines-heading">
            <h2 id="deadlines-heading" className="mb-3 inline-flex items-center gap-1.5 text-sm font-black text-slate-900">
              <Calendar className="h-4 w-4 text-indigo-500" /> Upcoming
            </h2>
            {eventsQ.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-slate-50" />
            ) : !eventsQ.data?.length ? (
              <p className="text-xs text-slate-400">No upcoming learning deadlines.</p>
            ) : (
              <ul className="space-y-2">
                {eventsQ.data.slice(0, 6).map((e) => (
                  <li key={e.id}>
                    <Link to={e.href} className="block rounded-xl px-2 py-1.5 hover:bg-slate-50">
                      <p className="text-xs font-bold text-slate-800">{e.title}</p>
                      <p className="text-[10px] capitalize text-slate-400">
                        {e.type.replace(/_/g, " ")}
                        {e.starts_at || e.ends_at
                          ? ` · ${new Date(e.starts_at || e.ends_at || "").toLocaleDateString()}`
                          : ""}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <Link to={`${BASE}/calendar`} className="mt-3 block text-xs font-bold text-indigo-600 hover:underline">
              Open learning calendar
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
