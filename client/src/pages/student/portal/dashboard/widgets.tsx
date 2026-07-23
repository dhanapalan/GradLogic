import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  PlayCircle,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  Lightbulb,
  RefreshCw,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import studentDashboardService, {
  type DashboardShell,
  type UpcomingAssessment,
} from "../../../../services/studentDashboardService";
import WidgetShell from "./WidgetShell";

const BASE = "/app/student-portal";

function greetingForHour(h: number) {
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function useCountdown(targetIso?: string | null) {
  const [label, setLabel] = useState("—");
  useEffect(() => {
    if (!targetIso) {
      setLabel("—");
      return;
    }
    const tick = () => {
      const diff = new Date(targetIso).getTime() - Date.now();
      if (Number.isNaN(diff)) {
        setLabel("—");
        return;
      }
      if (diff <= 0) {
        setLabel("Started");
        return;
      }
      const s = Math.floor(diff / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      setLabel(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [targetIso]);
  return label;
}

function statusTone(status: UpcomingAssessment["status"]) {
  switch (status) {
    case "Live":
    case "In Progress":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "Missed":
      return "bg-rose-50 text-rose-700 border-rose-100";
    default:
      return "bg-slate-50 text-slate-600 border-slate-100";
  }
}

function CircularProgress({ value, size = 112 }: { value: number; size?: number }) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="stroke-slate-100" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          className="stroke-indigo-500 transition-all duration-700"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-slate-900">{value}</span>
        <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Score</span>
      </div>
    </div>
  );
}

export function WelcomeCard({ shell, loading, error, onRetry }: {
  shell?: DashboardShell;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const student = shell?.student;
  const completion = shell?.profile_completion;
  const hour = new Date().getHours();
  const name = student?.first_name || student?.name?.split(" ")[0] || "Student";

  return (
    <WidgetShell
      title="Welcome"
      loading={loading}
      error={error}
      onRetry={onRetry}
      minHeight="min-h-[160px]"
      className="bg-gradient-to-br from-white via-white to-indigo-50/40"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          {student?.profile_photo_url ? (
            <img
              src={student.profile_photo_url}
              alt=""
              className="h-14 w-14 rounded-2xl object-cover border border-slate-100"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-black text-white shadow-md shadow-indigo-200">
              {(name[0] || "S").toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-xl font-black tracking-tight text-slate-900">
              {greetingForHour(hour)}, <span className="text-indigo-600">{name}</span>
            </p>
            <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs text-slate-500 sm:grid-cols-2">
              <div>
                <dt className="inline font-semibold text-slate-400">Department: </dt>
                <dd className="inline">{student?.specialization || "—"}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-400">Program: </dt>
                <dd className="inline">{student?.degree || "—"}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-400">Semester / Class: </dt>
                <dd className="inline">
                  {student?.class_name || student?.section || "—"}
                  {student?.passing_year ? ` · Batch ${student.passing_year}` : ""}
                </dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-400">College: </dt>
                <dd className="inline">{student?.college_name || "—"}</dd>
              </div>
            </dl>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-100 bg-white px-4 py-2 text-center">
            <p className="text-2xl font-black text-slate-900">{completion?.percentage ?? 0}%</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Profile</p>
          </div>
          {completion && !completion.is_profile_complete && (
            <Link
              to={`${BASE}/profile`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-black text-white hover:bg-indigo-600"
            >
              Complete profile <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

export function ReadinessWidget() {
  const q = useQuery({
    queryKey: ["student-dash-readiness"],
    queryFn: () => studentDashboardService.getReadiness(),
    staleTime: 60_000,
  });
  const data = q.data;

  return (
    <WidgetShell
      title="Placement readiness"
      subtitle={data ? data.level : undefined}
      loading={q.isLoading}
      error={q.isError}
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/workflow`} className="text-xs font-bold text-indigo-600 hover:underline">
          View analysis
        </Link>
      }
    >
      {data && (
        <div className="flex items-center gap-5">
          <CircularProgress value={data.score} />
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-slate-600">
              Learn → Practice → Test → Certify composite from your real progress.
            </p>
            {data.trend != null ? (
              <p className={`inline-flex items-center gap-1 text-xs font-bold ${data.trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {data.trend >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {data.trend >= 0 ? "+" : ""}
                {data.trend} vs earlier assessments
              </p>
            ) : (
              <p className="text-xs font-medium text-slate-400">Trend appears after more published results</p>
            )}
            <div className="grid grid-cols-4 gap-2 pt-1">
              {Object.entries(data.stages).map(([k, v]) => (
                <div key={k} className="rounded-lg bg-slate-50 px-2 py-1.5 text-center">
                  <p className="text-sm font-black text-slate-900">{v}</p>
                  <p className="text-[9px] font-bold uppercase text-slate-400">{k}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </WidgetShell>
  );
}

function AssessmentRow({ item }: { item: UpcomingAssessment }) {
  const countdown = useCountdown(
    item.status === "Upcoming" ? item.scheduled_at : item.available_until
  );
  return (
    <li className="rounded-xl border border-slate-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{item.assessment_name}</p>
          <p className="truncate text-xs text-slate-500">
            {item.campaign_name} · {item.subject?.replace(/_/g, " ")}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusTone(item.status)}`}>
          {item.status}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-500 sm:grid-cols-4">
        <div>
          <dt className="font-semibold text-slate-400">When</dt>
          <dd>{formatWhen(item.scheduled_at)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-400">Countdown</dt>
          <dd>{countdown}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-400">Duration</dt>
          <dd>{item.duration_minutes ? `${item.duration_minutes} min` : "—"}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-400">Attempts left</dt>
          <dd>
            {item.attempts_remaining}/{item.max_attempts}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to={`${BASE}/my-assessments/${item.campaign_id}/instructions`}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          View details
        </Link>
        {(item.can_start || item.can_resume) && (
          <Link
            to={`${BASE}/my-assessments/${item.campaign_id}/instructions`}
            className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-700"
          >
            {item.can_resume ? "Resume" : "Start assessment"}
          </Link>
        )}
      </div>
    </li>
  );
}

export function UpcomingAssessmentsWidget() {
  const q = useQuery({
    queryKey: ["student-dash-upcoming"],
    queryFn: () => studentDashboardService.getUpcomingAssessments(6),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <WidgetShell
      title="Upcoming assessments"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="No upcoming assessments. Check My Assessments for your full list."
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/my-assessments`} className="text-xs font-bold text-indigo-600 hover:underline">
          View all
        </Link>
      }
      minHeight="min-h-[240px]"
    >
      <ul className="space-y-3">{q.data?.map((item) => <AssessmentRow key={item.campaign_id} item={item} />)}</ul>
    </WidgetShell>
  );
}

export function RecentResultsWidget() {
  const q = useQuery({
    queryKey: ["student-dash-results"],
    queryFn: () => studentDashboardService.getRecentResults(6),
    staleTime: 60_000,
  });

  return (
    <WidgetShell
      title="Recent results"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="No published results yet."
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/my-assessments`} className="text-xs font-bold text-indigo-600 hover:underline">
          View all
        </Link>
      }
    >
      <ul className="divide-y divide-slate-100">
        {q.data?.map((r) => (
          <li key={r.campaign_id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{r.assessment_name}</p>
              <p className="text-xs text-slate-500">
                {formatDate(r.completed_at)}
                {r.rank != null ? ` · Rank #${r.rank}` : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-black text-slate-900">{r.percentage}%</p>
                <p className="text-[11px] text-slate-500">
                  {r.score}/{r.total_marks}
                </p>
              </div>
              {r.passed == null ? null : r.passed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Passed" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-500" aria-label="Failed" />
              )}
              <Link
                to={`${BASE}/my-assessments/${r.campaign_id}/result`}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                View
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function AssignedLearningWidget() {
  const q = useQuery({
    queryKey: ["student-dash-learning"],
    queryFn: () => studentDashboardService.getAssignedLearning(),
    staleTime: 60_000,
  });

  return (
    <WidgetShell
      title="Assigned learning"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="No learning paths assigned yet."
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/learn`} className="text-xs font-bold text-indigo-600 hover:underline">
          Open learn
        </Link>
      }
    >
      <ul className="space-y-3">
        {q.data?.slice(0, 5).map((item) => (
          <li key={item.enrollment_id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">{item.program_name}</p>
                <p className="text-xs text-slate-500">
                  {item.completed_modules}/{item.total_modules} modules
                  {item.due_at ? ` · Due ${formatDate(item.due_at)}` : ""}
                </p>
              </div>
              <span className="text-sm font-black text-indigo-600">{item.completion_percentage}%</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${item.completion_percentage}%` }}
              />
            </div>
            {item.status !== "completed" && (
              <Link
                to={`${BASE}/learn`}
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
              >
                Continue learning <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function SkillProgressWidget() {
  const q = useQuery({
    queryKey: ["student-dash-skills"],
    queryFn: () => studentDashboardService.getSkills(),
    staleTime: 60_000,
  });
  const empty = !q.data?.top_skills?.length && !q.data?.weak_skills?.length;

  return (
    <WidgetShell
      title="Skill progress"
      loading={q.isLoading}
      error={q.isError}
      empty={empty}
      emptyMessage="Skill data appears after practice and assessments."
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/practice`} className="text-xs font-bold text-indigo-600 hover:underline">
          Practice
        </Link>
      }
    >
      {q.data && (
        <div className="space-y-4">
          <div className="space-y-2">
            {q.data.top_skills.map((s) => (
              <div key={s.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-bold text-slate-700">{s.name}</span>
                  <span className="font-black text-slate-900">{s.proficiency}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.proficiency}%` }} />
                </div>
              </div>
            ))}
          </div>
          {q.data.recommended_improvements.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                Improve next
              </p>
              <ul className="space-y-1">
                {q.data.recommended_improvements.map((r) => (
                  <li key={r.skill} className="text-xs text-slate-600">
                    · {r.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

export function RecommendationsWidget() {
  const q = useQuery({
    queryKey: ["student-dash-recs"],
    queryFn: () => studentDashboardService.getRecommendations(),
    staleTime: 60_000,
  });

  return (
    <WidgetShell
      title="AI recommendations"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="You're on track — check back after more activity."
      onRetry={() => q.refetch()}
    >
      <ul className="space-y-2">
        {q.data?.map((r) => (
          <li key={r.id}>
            <Link
              to={r.href}
              className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-100 hover:bg-indigo-50/40"
            >
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-100 bg-amber-50 text-amber-600">
                <Lightbulb className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{r.title}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{r.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function CampusDrivesWidget() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-dash-drives"],
    queryFn: () => studentDashboardService.getEligibleDrives(),
    staleTime: 60_000,
  });
  const apply = useMutation({
    mutationFn: (id: string) => studentDashboardService.applyDrive(id),
    onSuccess: () => {
      toast.success("Enrolled successfully");
      qc.invalidateQueries({ queryKey: ["student-dash-drives"] });
    },
    onError: () => toast.error("Could not apply to this drive"),
  });

  return (
    <WidgetShell
      title="Scheduled tests"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="No scheduled tests right now."
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/tests`} className="text-xs font-bold text-indigo-600 hover:underline">
          Browse tests
        </Link>
      }
    >
      <ul className="space-y-3">
        {q.data?.slice(0, 5).map((d) => (
          <li key={d.drive_id} className="rounded-xl border border-slate-100 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{d.company}</p>
                <p className="text-xs capitalize text-slate-500">{d.role}</p>
              </div>
              <PlayCircle className="h-4 w-4 text-slate-300" />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Drive: {formatDate(d.drive_date)} · Deadline: {formatDate(d.registration_deadline)}
            </p>
            <div className="mt-2 flex gap-2">
              <Link
                to={`${BASE}/tests`}
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                View details
              </Link>
              {d.can_apply && (
                <button
                  type="button"
                  disabled={apply.isPending}
                  onClick={() => apply.mutate(d.drive_id)}
                  className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-600 disabled:opacity-50"
                >
                  Apply
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function NotificationsWidget() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["student-dash-notifications"],
    queryFn: () => studentDashboardService.getNotifications(6),
    staleTime: 20_000,
    refetchInterval: 45_000,
  });
  const mark = useMutation({
    mutationFn: (id: string) => studentDashboardService.markNotificationRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student-dash-notifications"] }),
  });

  return (
    <WidgetShell
      title="Notifications"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="You're all caught up."
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/notifications`} className="text-xs font-bold text-indigo-600 hover:underline">
          View all
        </Link>
      }
    >
      <ul className="space-y-2">
        {q.data?.map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-3 ${n.is_read ? "border-slate-100 bg-white" : "border-indigo-100 bg-indigo-50/40"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{n.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
              </div>
              {!n.is_read && (
                <button
                  type="button"
                  onClick={() => mark.mutate(n.id)}
                  className="shrink-0 text-[11px] font-bold text-indigo-600 hover:underline"
                >
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function AchievementsWidget() {
  const q = useQuery({
    queryKey: ["student-dash-achievements"],
    queryFn: () => studentDashboardService.getAchievements(),
    staleTime: 60_000,
  });

  return (
    <WidgetShell
      title="Badges & achievements"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data}
      onRetry={() => q.refetch()}
      action={
        <Link to={`${BASE}/achievements`} className="text-xs font-bold text-indigo-600 hover:underline">
          All badges
        </Link>
      }
    >
      {q.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-amber-50 px-3 py-2 text-center">
              <Award className="mx-auto h-4 w-4 text-amber-600" />
              <p className="mt-1 text-lg font-black text-slate-900">{q.data.badges.length}</p>
              <p className="text-[10px] font-bold uppercase text-slate-400">Badges</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2 text-center">
              <Sparkles className="mx-auto h-4 w-4 text-emerald-600" />
              <p className="mt-1 text-lg font-black text-slate-900">{q.data.certificates_count}</p>
              <p className="text-[10px] font-bold uppercase text-slate-400">Certs</p>
            </div>
            <div className="rounded-xl bg-orange-50 px-3 py-2 text-center">
              <Flame className="mx-auto h-4 w-4 text-orange-600" />
              <p className="mt-1 text-lg font-black text-slate-900">{q.data.streaks.current}</p>
              <p className="text-[10px] font-bold uppercase text-slate-400">Streak</p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {q.data.assessment_milestones} assessment milestone
            {q.data.assessment_milestones === 1 ? "" : "s"} · Longest streak {q.data.streaks.longest} days
          </p>
          {q.data.badges.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {q.data.badges.slice(0, 6).map((b) => (
                <li
                  key={b.slug}
                  title={b.description}
                  className="rounded-full border border-slate-100 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
                >
                  {b.icon ? `${b.icon} ` : ""}
                  {b.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </WidgetShell>
  );
}

export function CalendarWidget() {
  const q = useQuery({
    queryKey: ["student-dash-calendar"],
    queryFn: () => studentDashboardService.getCalendarEvents(30),
    staleTime: 60_000,
  });

  return (
    <WidgetShell
      title="Calendar snapshot"
      loading={q.isLoading}
      error={q.isError}
      empty={!q.data?.length}
      emptyMessage="No upcoming events in the next 30 days."
      onRetry={() => q.refetch()}
    >
      <ul className="space-y-2">
        {q.data?.slice(0, 6).map((e) => (
          <li key={e.id}>
            {e.href ? (
              <Link to={e.href} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 hover:bg-slate-50">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{e.title}</span>
                  <span className="text-[11px] capitalize text-slate-500">
                    {e.type} · {formatWhen(e.starts_at)}
                  </span>
                </span>
              </Link>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-indigo-500" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{e.title}</p>
                  <p className="text-[11px] capitalize text-slate-500">
                    {e.type} · {formatWhen(e.starts_at)}
                  </p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </WidgetShell>
  );
}

export function QuickActionsWidget() {
  const actions = [
    { label: "Continue Learning", href: `${BASE}/my-learning`, icon: BookOpenCheck },
    { label: "Continue Practice", href: `${BASE}/practice`, icon: Target },
    { label: "Upcoming Assessment", href: `${BASE}/my-assessments`, icon: ClipboardCheck },
  ];

  return (
    <WidgetShell title="Today's journey" minHeight="min-h-[140px]">
      <div className="grid grid-cols-2 gap-2">
        {actions.map((a) => (
          <Link
            key={a.label}
            to={a.href}
            className="flex flex-col items-start gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3 transition hover:border-indigo-100 hover:bg-indigo-50/50"
          >
            <a.icon className="h-4 w-4 text-indigo-500" />
            <span className="text-xs font-bold text-slate-800">{a.label}</span>
          </Link>
        ))}
      </div>
    </WidgetShell>
  );
}

export function RefreshButton({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={refreshing}
      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      aria-label="Refresh dashboard"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
      Refresh
    </button>
  );
}
