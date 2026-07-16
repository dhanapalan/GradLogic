/**
 * Student Portal Module 05 — My Assessments dashboard.
 * Consumes /api/assessments/* facade; launches shared Assessment Workspace.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Search,
  LayoutGrid,
  List,
  Calendar,
  Bell,
  RefreshCw,
} from "lucide-react";
import studentAssessmentsHubService, {
  type AssessmentHubRow,
  type HubFilters,
} from "../../../services/studentAssessmentsHubService";
import {
  AssessmentCard,
  AssessmentRow,
  BASE,
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  SummaryCard,
  TimelineCard,
} from "./my-assessments/components";

const CalendarPanel = lazy(() => import("./my-assessments/CalendarPanel"));

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live / Available" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "missed", label: "Missed" },
  { id: "practice", label: "Practice" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const SORTS = [
  { id: "upcoming_first", label: "Upcoming first" },
  { id: "due_soon", label: "Due soon" },
  { id: "recently_completed", label: "Recently completed" },
  { id: "highest_score", label: "Highest score" },
  { id: "alphabetical", label: "Alphabetical" },
];

function useTabList(tab: TabId, filters: HubFilters) {
  return useQuery({
    queryKey: ["assessments-hub", tab, filters],
    queryFn: () => {
      switch (tab) {
        case "upcoming":
          return studentAssessmentsHubService.getUpcoming(filters);
        case "live":
          return studentAssessmentsHubService.getLive(filters);
        case "in_progress":
          return studentAssessmentsHubService.getInProgress(filters);
        case "completed":
          return studentAssessmentsHubService.getCompleted(filters);
        case "missed":
          return studentAssessmentsHubService.getMissed(filters);
        case "practice":
          return studentAssessmentsHubService.getPractice(filters);
        default:
          return studentAssessmentsHubService.getAssigned(filters);
      }
    },
    staleTime: 20_000,
    refetchInterval: tab === "live" || tab === "in_progress" ? 45_000 : false,
  });
}

export default function MyAssessmentsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as TabId) || "upcoming";
  const view = params.get("view") === "list" ? "list" : "cards";
  const search = params.get("q") || "";
  const type = params.get("type") || "";
  const dateFrom = params.get("from") || "";
  const dateTo = params.get("to") || "";
  const sort = params.get("sort") || "upcoming_first";
  const page = Number(params.get("page") || "1") || 1;
  const [qDraft, setQDraft] = useState(search);
  const [showCalendar, setShowCalendar] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  const filters: HubFilters = useMemo(
    () => ({
      search: search || undefined,
      assessment_type: type || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      sort,
      page,
      limit: 20,
    }),
    [search, type, dateFrom, dateTo, sort, page]
  );

  const dashQ = useQuery({
    queryKey: ["assessments-hub-dashboard"],
    queryFn: () => studentAssessmentsHubService.getDashboard(),
    staleTime: 30_000,
  });
  const listQ = useTabList(tab, filters);
  const notesQ = useQuery({
    queryKey: ["assessments-hub-notifications"],
    queryFn: () => studentAssessmentsHubService.getNotifications(8),
    staleTime: 45_000,
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || (key === "tab" && value === "upcoming") || (key === "page" && value === "1")) {
      if (key === "tab" && value === "upcoming") next.delete("tab");
      else if (key === "page" && value === "1") next.delete("page");
      else if (!value) next.delete(key);
      else next.set(key, value);
    } else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next);
  };

  const launchMut = useMutation({
    mutationFn: (row: AssessmentHubRow) =>
      row.can_resume
        ? studentAssessmentsHubService.resume(row.campaign_id)
        : studentAssessmentsHubService.launch(row.campaign_id),
    onMutate: (row) => setBusyId(row.campaign_id),
    onSettled: () => setBusyId(null),
    onSuccess: (data, row) => {
      toast.success(data.message || "Opening Assessment Workspace…");
      qc.invalidateQueries({ queryKey: ["assessments-hub"] });
      navigate(data.workspace_href || `${BASE}/${row.campaign_id}/attempt`);
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        "Could not launch assessment";
      toast.error(msg);
    },
  });

  const onLaunch = (row: AssessmentHubRow) => {
    // Prefer instructions page for first start (rules), resume goes straight to workspace via API.
    if (row.can_start && !row.can_resume) {
      navigate(`${BASE}/${row.campaign_id}/instructions`);
      return;
    }
    launchMut.mutate(row);
  };
  const onResume = (row: AssessmentHubRow) => launchMut.mutate(row);

  const summary = dashQ.data?.summary;
  const rows = listQ.data?.data ?? [];
  const pagination = listQ.data?.pagination;

  const sticky = dashQ.data?.in_progress_preview?.[0] || dashQ.data?.live_preview?.[0];

  return (
    <div className="mx-auto max-w-7xl space-y-5 animate-in fade-in duration-500">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assessments</p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">My Assessments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assigned campaigns, eligibility, schedules, and launches into the Assessment Workspace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowCalendar((v) => !v)}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
          >
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </button>
          <button
            type="button"
            onClick={() => {
              qc.invalidateQueries({ queryKey: ["assessments-hub"] });
              dashQ.refetch();
              listQ.refetch();
            }}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </header>

      {dashQ.isLoading ? (
        <LoadingBlock label="Loading summary" />
      ) : dashQ.isError ? (
        <ErrorBlock message="Couldn’t load assessment summary." onRetry={() => dashQ.refetch()} />
      ) : summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          <SummaryCard label="Assigned" value={summary.total_assigned} />
          <SummaryCard label="Upcoming" value={summary.upcoming} />
          <SummaryCard label="Active" value={summary.active} />
          <SummaryCard label="Completed" value={summary.completed} />
          <SummaryCard label="Missed" value={summary.missed} />
          <SummaryCard label="Practice" value={summary.practice} />
          <SummaryCard label="Avg score" value={summary.average_score != null ? `${summary.average_score}%` : "—"} />
          <SummaryCard label="Pending results" value={summary.pending_results} />
        </div>
      ) : null}

      {dashQ.data?.upcoming_preview?.length ? (
        <section aria-labelledby="upcoming-timeline-heading">
          <h2 id="upcoming-timeline-heading" className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Upcoming timeline
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {dashQ.data.upcoming_preview.map((row) => (
              <TimelineCard key={row.campaign_id} row={row} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <div className="min-w-0 space-y-4">
          {/* Filters */}
          <div className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setParam("q", qDraft.trim())}
                  placeholder="Search assessment, campaign, subject…"
                  className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
                  aria-label="Search assessments"
                />
              </div>
              <button
                type="button"
                onClick={() => setParam("q", qDraft.trim())}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
              >
                Search
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={type}
                onChange={(e) => setParam("type", e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                aria-label="Assessment type"
              >
                <option value="">All types</option>
                <option value="practice_test">Practice</option>
                <option value="mock_test">Mock</option>
                <option value="placement_test">Placement</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setParam("from", e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                aria-label="From date"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setParam("to", e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                aria-label="To date"
              />
              <select
                value={sort}
                onChange={(e) => setParam("sort", e.target.value)}
                className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                aria-label="Sort assessments"
              >
                {SORTS.filter((s) => s.id !== "highest_score" || tab === "completed").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <div className="ml-auto flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="View mode">
                <button
                  type="button"
                  onClick={() => setParam("view", "cards")}
                  className={`rounded-md p-1.5 ${view === "cards" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}
                  aria-pressed={view === "cards"}
                  aria-label="Card view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setParam("view", "list")}
                  className={`rounded-md p-1.5 ${view === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500"}`}
                  aria-pressed={view === "list"}
                  aria-label="List view"
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-100 bg-white p-1 shadow-sm"
            role="tablist"
            aria-label="Assessment status"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setParam("tab", t.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${
                  tab === t.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {showCalendar && (
            <Suspense fallback={<LoadingBlock label="Loading calendar" />}>
              <CalendarPanel />
            </Suspense>
          )}

          {/* Tab content */}
          <section role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label}>
            {listQ.isLoading ? (
              <LoadingBlock />
            ) : listQ.isError ? (
              <ErrorBlock message="Couldn’t load assessments." onRetry={() => listQ.refetch()} />
            ) : rows.length === 0 ? (
              <EmptyBlock title={`No ${tab.replace(/_/g, " ")} assessments`} hint="Filters may be hiding results." />
            ) : view === "cards" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {rows.map((row) => (
                  <AssessmentCard
                    key={row.campaign_id}
                    row={row}
                    onLaunch={onLaunch}
                    onResume={onResume}
                    busyId={busyId}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
                <table className="min-w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Assessment</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Scheduled</th>
                      <th className="px-3 py-2">Countdown</th>
                      <th className="px-3 py-2">Attempts</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <AssessmentRow
                        key={row.campaign_id}
                        row={row}
                        onLaunch={onLaunch}
                        onResume={onResume}
                        busyId={busyId}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pagination && pagination.pages > 1 && (
              <div className="mt-4 flex items-center justify-between text-xs">
                <p className="text-slate-500">
                  Page {pagination.page} of {pagination.pages} · {pagination.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setParam("page", String(page - 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= pagination.pages}
                    onClick={() => setParam("page", String(page + 1))}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Sticky actions + notifications */}
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white p-4 shadow-sm">
            <h2 className="text-sm font-black text-slate-900">Quick actions</h2>
            {sticky ? (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-bold text-slate-800">{sticky.assessment_name}</p>
                <p className="text-[11px] text-slate-500">{sticky.campaign_name}</p>
                {sticky.can_resume ? (
                  <button
                    type="button"
                    onClick={() => onResume(sticky)}
                    className="w-full rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white"
                  >
                    Resume Assessment
                  </button>
                ) : sticky.can_start ? (
                  <button
                    type="button"
                    onClick={() => onLaunch(sticky)}
                    className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-bold text-white"
                  >
                    Start Assessment
                  </button>
                ) : (
                  <Link
                    to={`${BASE}/${sticky.campaign_id}`}
                    className="block w-full rounded-xl border border-slate-200 py-2.5 text-center text-xs font-bold"
                  >
                    View Details
                  </Link>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No live or in-progress assessments right now.</p>
            )}
            <div className="mt-3 flex flex-col gap-1.5 text-xs font-bold">
              <button type="button" onClick={() => setParam("tab", "completed")} className="text-left text-indigo-600">
                View Results
              </button>
              <button type="button" onClick={() => setParam("tab", "practice")} className="text-left text-indigo-600">
                Practice Assessments
              </button>
              <button type="button" onClick={() => setShowCalendar(true)} className="text-left text-indigo-600">
                Open Calendar
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm" aria-labelledby="assess-notes">
            <h2 id="assess-notes" className="mb-2 inline-flex items-center gap-1.5 text-sm font-black text-slate-900">
              <Bell className="h-4 w-4 text-indigo-500" /> Notifications
            </h2>
            {notesQ.isLoading ? (
              <div className="h-20 animate-pulse rounded-xl bg-slate-50" />
            ) : !notesQ.data?.length ? (
              <p className="text-xs text-slate-400">No assessment alerts.</p>
            ) : (
              <ul className="space-y-2">
                {notesQ.data.map((n) => (
                  <li key={n.id}>
                    <Link to={n.href || BASE} className="block rounded-xl px-2 py-1.5 hover:bg-slate-50">
                      <p className="text-xs font-bold text-slate-800">{n.title}</p>
                      <p className="line-clamp-2 text-[11px] text-slate-500">{n.message}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
