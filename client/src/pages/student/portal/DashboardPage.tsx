import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import studentDashboardService from "../../../services/studentDashboardService";
import { WidgetSkeleton } from "./dashboard/WidgetShell";
import {
  AssignedLearningWidget,
  NotificationsWidget,
  QuickActionsWidget,
  ReadinessWidget,
  RecentResultsWidget,
  RefreshButton,
  UpcomingAssessmentsWidget,
  WelcomeCard,
} from "./dashboard/widgets";

const BelowFoldWidgets = lazy(() => import("./dashboard/BelowFoldWidgets"));

const WIDGET_VIS_KEY = "student-dashboard-widgets";

const ALL_WIDGETS = [
  "welcome",
  "readiness",
  "upcoming_assessments",
  "recent_results",
  "assigned_learning",
  "skill_progress",
  "ai_recommendations",
  "campus_drives",
  "notifications",
  "achievements",
  "calendar",
  "quick_actions",
] as const;

type WidgetId = (typeof ALL_WIDGETS)[number];

function loadVisibility(): Record<WidgetId, boolean> {
  try {
    const raw = localStorage.getItem(WIDGET_VIS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<WidgetId, boolean>>;
      return Object.fromEntries(ALL_WIDGETS.map((id) => [id, parsed[id] !== false])) as Record<
        WidgetId,
        boolean
      >;
    }
  } catch {
    /* ignore */
  }
  return Object.fromEntries(ALL_WIDGETS.map((id) => [id, true])) as Record<WidgetId, boolean>;
}

export default function StudentDashboardPage() {
  const qc = useQueryClient();
  const [visibility, setVisibility] = useState(loadVisibility);
  const [refreshing, setRefreshing] = useState(false);
  const pullStart = useRef<number | null>(null);
  const [pulling, setPulling] = useState(false);

  const shellQ = useQuery({
    queryKey: ["student-dash-shell"],
    queryFn: () => studentDashboardService.getShell(),
    staleTime: 60_000,
  });

  const stickyNotesQ = useQuery({
    queryKey: ["student-dash-notifications"],
    queryFn: () => studentDashboardService.getNotifications(5),
    staleTime: 20_000,
    refetchInterval: 45_000,
  });

  const unread = (stickyNotesQ.data ?? []).filter((n) => !n.is_read);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["student-dash-shell"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-readiness"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-upcoming"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-results"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-learning"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-skills"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-recs"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-drives"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-notifications"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-achievements"] }),
        qc.invalidateQueries({ queryKey: ["student-dash-calendar"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [qc]);

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0) pullStart.current = e.touches[0]?.clientY ?? null;
    };
    const onMove = (e: TouchEvent) => {
      if (pullStart.current == null) return;
      const dy = (e.touches[0]?.clientY ?? 0) - pullStart.current;
      setPulling(dy > 70);
    };
    const onEnd = () => {
      if (pulling) void refreshAll();
      pullStart.current = null;
      setPulling(false);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [pulling, refreshAll]);

  const toggleWidget = (id: WidgetId) => {
    setVisibility((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(WIDGET_VIS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const show = (id: WidgetId) => visibility[id] !== false;

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in duration-500">
      {pulling && (
        <p className="text-center text-xs font-bold text-indigo-600" role="status">
          Release to refresh…
        </p>
      )}

      {unread.length > 0 && (
        <div
          className="sticky top-0 z-20 rounded-2xl border border-indigo-100 bg-indigo-50/95 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-indigo-50/80"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wider text-indigo-700">
                {unread.length} unread notification{unread.length === 1 ? "" : "s"}
              </p>
              <p className="mt-0.5 truncate text-sm font-medium text-slate-800">{unread[0].title}</p>
            </div>
            <Link
              to="/app/student-portal/notifications"
              className="shrink-0 text-xs font-bold text-indigo-700 hover:underline"
            >
              View all
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Today&apos;s journey — continue learning, practice, assess, and improve with AI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Customize widgets
            </summary>
            <div
              className="absolute right-0 z-30 mt-2 max-h-72 w-56 overflow-y-auto rounded-xl border border-slate-100 bg-white p-2 shadow-lg"
              role="group"
              aria-label="Toggle dashboard widgets"
            >
              {ALL_WIDGETS.map((id) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs capitalize text-slate-700 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={show(id)}
                    onChange={() => toggleWidget(id)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  {id.replace(/_/g, " ")}
                </label>
              ))}
            </div>
          </details>
          <RefreshButton onRefresh={() => void refreshAll()} refreshing={refreshing} />
        </div>
      </div>

      {show("welcome") && (
        <WelcomeCard
          shell={shellQ.data}
          loading={shellQ.isLoading}
          error={shellQ.isError}
          onRetry={() => void shellQ.refetch()}
        />
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {show("readiness") && (
          <div className="lg:col-span-2">
            <ReadinessWidget />
          </div>
        )}
        {show("quick_actions") && <QuickActionsWidget />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {show("upcoming_assessments") && <UpcomingAssessmentsWidget />}
        {show("recent_results") && <RecentResultsWidget />}
        {show("assigned_learning") && <AssignedLearningWidget />}
        {show("notifications") && <NotificationsWidget />}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Suspense
          fallback={
            <>
              <WidgetSkeleton />
              <WidgetSkeleton />
              <WidgetSkeleton />
            </>
          }
        >
          <BelowFoldWidgets visibility={visibility} />
        </Suspense>
      </div>
    </div>
  );
}
