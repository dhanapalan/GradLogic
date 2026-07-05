import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowPathIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  Cog6ToothIcon,
  CurrencyRupeeIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import StatsCard from "../../../components/superadmin/StatsCard";
import AlertCard from "../../../components/superadmin/AlertCard";
import ChartCard from "../../../components/superadmin/ChartCard";
import LiveMetricStrip from "../../../components/superadmin/LiveMetricStrip";
import ActionInbox from "../../../components/superadmin/ActionInbox";
import { useAuthStore } from "../../../stores/authStore";
import superadminMetrics, {
  PlatformMetrics,
  GrowthSeries,
  SystemAlert,
  RecentActivity,
  MostActiveCollege,
  LiveDashboard,
  DashboardBilling,
} from "../../../services/superadminMetrics";

const QUICK_ACTIONS = [
  { label: "College", href: "/app/superadmin/colleges/new", icon: PlusIcon, grad: "from-blue-500 to-indigo-600" },
  { label: "Approvals", href: "/app/superadmin/approvals", icon: ShieldCheckIcon, grad: "from-amber-400 to-orange-500" },
  { label: "Questions", href: "/app/superadmin/question-bank", icon: ClipboardDocumentListIcon, grad: "from-violet-500 to-purple-600" },
  { label: "Students", href: "/app/superadmin/students", icon: UsersIcon, grad: "from-emerald-500 to-teal-600" },
  { label: "Analytics", href: "/app/superadmin/analytics", icon: ChartBarIcon, grad: "from-cyan-500 to-sky-600" },
  { label: "Settings", href: "/app/superadmin/settings", icon: Cog6ToothIcon, grad: "from-slate-500 to-gray-600" },
];

const ALERT_LINKS: Record<string, string> = {
  "pending-colleges": "/app/superadmin/approvals",
  "review-queue": "/app/superadmin/approvals",
  "failed-logins": "/app/superadmin/audit-trail",
};

const RANK_BG = ["bg-amber-400", "bg-slate-300", "bg-orange-400", "bg-gray-300", "bg-gray-200"];

function formatReadiness(value?: number) {
  if (value == null || Number.isNaN(value)) return "N/A";
  const pct = value <= 1 ? value * 100 : value;
  return `${Math.round(pct)}%`;
}

function formatCurrency(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [live, setLive] = useState<LiveDashboard | null>(null);
  const [growth, setGrowth] = useState<GrowthSeries>({ collegeGrowth: [], studentGrowth: [] });
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [mostActiveColleges, setMostActiveColleges] = useState<MostActiveCollege[]>([]);
  const [billing, setBilling] = useState<DashboardBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const applyBundle = useCallback((bundle: Awaited<ReturnType<typeof superadminMetrics.getDashboard>>) => {
    setMetrics(bundle.metrics);
    setLive(bundle.live);
    setGrowth(bundle.growth);
    setAlerts(bundle.alerts);
    setRecentActivities(bundle.activities);
    setMostActiveColleges(bundle.colleges);
    setBilling(bundle.billing);
    setLastUpdated(new Date());
  }, []);

  const fetchDashboard = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    try {
      applyBundle(await superadminMetrics.getDashboard(force));
    } catch {
      /* keep prior data */
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [applyBundle]);

  const pollLive = useCallback(async () => {
    try {
      setLive(await superadminMetrics.getLiveDashboard(true));
      setLastUpdated(new Date());
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const liveInterval = setInterval(pollLive, 15000);
    const fullInterval = setInterval(() => fetchDashboard(true), 60000);
    return () => {
      clearInterval(liveInterval);
      clearInterval(fullInterval);
    };
  }, [fetchDashboard, pollLive]);

  const handleRefresh = () => {
    superadminMetrics.clearCache();
    fetchDashboard(true);
  };

  const handleInboxAction = () => {
    superadminMetrics.clearCache();
    fetchDashboard(true);
  };

  const visibleAlerts = alerts.filter((a) => !dismissedAlerts.has(a.id) && a.id !== "all-clear");
  const firstName = user?.name?.split(" ")[0] || "Admin";
  const liveCounts = live?.counts;
  const totalInbox =
    (liveCounts?.pendingColleges ?? 0) +
    (liveCounts?.pendingQuestions ?? 0) +
    (liveCounts?.pendingPayments ?? 0);

  const collected = billing?.collected ?? 0;
  const expected = billing?.expected ?? 0;
  const billingPct = expected > 0 ? Math.round((collected / expected) * 100) : 0;

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-3 max-w-[1800px] mx-auto">
      {/* Hero — compact */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600 p-3 sm:p-4 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-60" />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Live</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold truncate">Hi, {firstName}</h2>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-2.5 py-1.5 text-xs font-medium disabled:opacity-60"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">{lastUpdated ? lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Refresh"}</span>
            </button>
          </div>
          <LiveMetricStrip
            today={live?.today ?? { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 }}
            yesterday={live?.yesterday ?? { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 }}
            activeNow={live?.activeNow ?? 0}
            examsInProgress={live?.examsInProgress ?? 0}
            loading={loading && !live}
          />
        </div>
      </div>

      {/* Quick actions — horizontal scroll on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 snap-x snap-mandatory -mx-0.5 px-0.5">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon, grad }) => (
          <Link
            key={href}
            to={href}
            className={`snap-start shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r ${grad} px-3 py-2 text-xs font-semibold text-white shadow-md hover:shadow-lg hover:scale-105 transition-all`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </div>

      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              type={alert.type}
              title={alert.title}
              message={alert.message}
              action={ALERT_LINKS[alert.id] ? { label: "Act →", onClick: () => navigate(ALERT_LINKS[alert.id]) } : undefined}
              onClose={() => setDismissedAlerts((prev) => new Set(prev).add(alert.id))}
            />
          ))}
        </div>
      )}

      {/* Colorful KPI grid — 2 cols mobile, 4 tablet, 8 desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        <StatsCard compact title="Colleges" value={metrics?.totalColleges ?? 0} subtitle={`+${live?.today.newColleges ?? 0} today`} color="blue" icon={<BuildingOffice2Icon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/colleges")} />
        <StatsCard compact title="Students" value={metrics?.totalStudents ?? 0} subtitle={`+${live?.today.newStudents ?? 0} today`} color="emerald" icon={<UsersIcon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/students")} />
        <StatsCard compact title="Active 24h" value={metrics?.activeUsers ?? 0} subtitle={`${live?.activeNow ?? 0} now`} color="cyan" icon={<UsersIcon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/users")} />
        <StatsCard compact title="Pending" value={totalInbox} subtitle={totalInbox ? "Action needed" : "Clear"} color="amber" icon={<ShieldCheckIcon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/approvals")} />
        <StatsCard compact title="Questions" value={metrics?.totalQuestions ?? 0} subtitle={`${liveCounts?.pendingQuestions ?? 0} review`} color="indigo" icon={<ClipboardDocumentListIcon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/question-bank")} />
        <StatsCard compact title="AI Gen" value={metrics?.aiGeneratedQuestions ?? 0} subtitle="total" color="violet" icon={<SparklesIcon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/question-bank/ai-generator")} />
        <StatsCard compact title="Tests" value={metrics?.totalTests ?? 0} subtitle="completed" color="rose" icon={<ChartBarIcon className="w-4 h-4" />} loading={loading} />
        <StatsCard compact title="Readiness" value={formatReadiness(metrics?.avgPlacementReadiness)} subtitle="avg score" color="orange" icon={<ChartBarIcon className="w-4 h-4" />} loading={loading} onClick={() => navigate("/app/superadmin/analytics")} />
      </div>

      {/* Main grid — fits one viewport on lg+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-2 sm:gap-3 auto-rows-fr">
        {/* Inbox */}
        <div className="md:col-span-2 xl:col-span-4 min-h-[220px] max-h-[280px] xl:max-h-[300px]">
          <ActionInbox items={live?.actionItems ?? []} totalPending={totalInbox} loading={loading && !live} onActionComplete={handleInboxAction} />
        </div>

        {/* Charts row */}
        <div className="xl:col-span-2 min-h-[180px]">
          <ChartCard compact title="Exams 7d" data={live?.examTrend ?? []} color="violet" variant="bar" loading={loading && !live} />
        </div>
        <div className="xl:col-span-3 min-h-[180px]">
          <ChartCard compact title="Colleges 30d" data={growth.collegeGrowth} color="blue" variant="area" loading={loading} />
        </div>
        <div className="xl:col-span-3 min-h-[180px]">
          <ChartCard compact title="Students 30d" data={growth.studentGrowth} color="emerald" variant="bar" loading={loading} />
        </div>

        {/* Billing + health */}
        <div className="md:col-span-1 xl:col-span-4 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-3 text-white shadow-lg min-h-[120px]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <CurrencyRupeeIcon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold truncate">Billing {billing?.academic_year ?? ""}</span>
            </div>
            <Link to="/app/superadmin/analytics" className="text-[10px] font-medium text-white/80 hover:text-white shrink-0">Details →</Link>
          </div>
          {loading && !billing ? (
            <div className="h-10 bg-white/20 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCurrency(collected)}</p>
              <div className="mt-2 h-1.5 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.min(billingPct, 100)}%` }} />
              </div>
              <p className="text-[10px] text-white/80 mt-1">{billingPct}% · {billing?.pending ?? 0} pending</p>
            </>
          )}
        </div>

        <div className="md:col-span-1 xl:col-span-4 grid grid-cols-2 gap-2">
          <HealthChip label="Exams live" value={live?.examsInProgress ?? 0} grad="from-fuchsia-500 to-violet-600" href="/app/superadmin/analytics" pulse={(live?.examsInProgress ?? 0) > 0} />
          <HealthChip label="Failed logins" value={liveCounts?.failedLoginsLastHour ?? 0} grad="from-rose-500 to-red-600" href="/app/superadmin/audit-trail" warn={(liveCounts?.failedLoginsLastHour ?? 0) >= 5} />
          <HealthChip label="Suspended" value={liveCounts?.suspendedColleges ?? 0} grad="from-slate-500 to-gray-600" href="/app/superadmin/colleges" warn={(liveCounts?.suspendedColleges ?? 0) > 0} />
          <HealthChip label="AI review" value={liveCounts?.pendingQuestions ?? 0} grad="from-amber-400 to-orange-500" href="/app/superadmin/approvals" warn={(liveCounts?.pendingQuestions ?? 0) > 0} />
        </div>

        {/* Bottom panels */}
        <div className="md:col-span-1 xl:col-span-5 rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50 to-white shadow-sm overflow-hidden max-h-[200px] flex flex-col">
          <PanelHeader icon={BuildingOffice2Icon} title="Top Colleges" href="/app/superadmin/colleges" color="text-blue-600" />
          <div className="flex-1 overflow-y-auto">
            {loading ? <PanelSkeleton /> : mostActiveColleges.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center">No data</p>
            ) : (
              <ul className="divide-y divide-blue-50">
                {mostActiveColleges.slice(0, 4).map((c, i) => (
                  <li key={c.id}>
                    <Link to={`/app/superadmin/colleges/${c.id}`} className="flex items-center gap-2 px-3 py-2 hover:bg-blue-50/80 text-sm">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${RANK_BG[i]}`}>{i + 1}</span>
                      <span className="flex-1 truncate font-medium text-gray-800">{c.name}</span>
                      <span className="text-[10px] text-gray-500 tabular-nums">{c.studentCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="md:col-span-1 xl:col-span-7 rounded-xl border border-indigo-100 bg-gradient-to-b from-indigo-50 to-white shadow-sm overflow-hidden max-h-[200px] flex flex-col">
          <PanelHeader icon={ClockIcon} title="Recent Activity" href="/app/superadmin/audit-trail" color="text-indigo-600" />
          <div className="flex-1 overflow-y-auto">
            {loading ? <PanelSkeleton /> : recentActivities.length === 0 ? (
              <p className="p-4 text-xs text-gray-400 text-center">No events</p>
            ) : (
              <ul className="divide-y divide-indigo-50">
                {recentActivities.slice(0, 5).map((a) => (
                  <li key={a.id} className="px-3 py-2 hover:bg-indigo-50/50">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-gray-800 truncate max-w-[30%]">{a.user}</span>
                      <span className="text-indigo-600 font-medium truncate flex-1">{a.action}</span>
                      <time className="text-[9px] text-gray-400 shrink-0 tabular-nums">
                        {new Date(a.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </time>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, href, color }: { icon: ComponentType<{ className?: string }>; title: string; href: string; color: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100/80 shrink-0">
      <div className="flex items-center gap-1.5">
        <Icon className={`w-4 h-4 ${color}`} />
        <h3 className="text-xs font-semibold text-gray-900">{title}</h3>
      </div>
      <Link to={href} className="text-[10px] font-medium text-gray-500 hover:text-gray-700 flex items-center gap-0.5">
        All <ArrowRightIcon className="w-3 h-3" />
      </Link>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
    </div>
  );
}

function HealthChip({ label, value, grad, href, warn, pulse }: { label: string; value: number; grad: string; href: string; warn?: boolean; pulse?: boolean }) {
  return (
    <Link
      to={href}
      className={`rounded-lg bg-gradient-to-br ${grad} p-2.5 text-white shadow-md hover:shadow-lg transition-shadow ${pulse ? "ring-2 ring-white/50 animate-pulse" : ""} ${warn ? "ring-2 ring-rose-200" : ""}`}
    >
      <p className="text-[9px] font-medium text-white/85 uppercase tracking-wide truncate">{label}</p>
      <p className="text-lg font-bold tabular-nums">{value}</p>
    </Link>
  );
}
