import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode, Children } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  RefreshCw,
  ArrowUpRight,
  ArrowRight,
  GraduationCap,
  Users,
  ShieldCheck,
  Activity,
  ClipboardList,
  Sparkles,
  BarChart3,
  TrendingUp,
  IndianRupee,
  Clock,
  Building2,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";
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

const QUICK_ACTIONS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Add college", href: "/app/superadmin/colleges/new", icon: Plus },
  { label: "Approvals", href: "/app/superadmin/approvals", icon: ShieldCheck },
  { label: "Question bank", href: "/app/superadmin/question-bank", icon: ClipboardList },
  { label: "Students", href: "/app/superadmin/students", icon: Users },
  { label: "Billing", href: "/app/superadmin/billing", icon: IndianRupee },
  { label: "Settings", href: "/app/superadmin/settings", icon: Settings },
];

const ALERT_LINKS: Record<string, string> = {
  "pending-colleges": "/app/superadmin/approvals",
  "review-queue": "/app/superadmin/approvals",
  "failed-logins": "/app/superadmin/audit-trail",
};

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
  const lastLiveErrorToast = useRef(0);
  const hasLoadedRef = useRef(false);

  const applyBundle = useCallback((bundle: Awaited<ReturnType<typeof superadminMetrics.getDashboard>>) => {
    hasLoadedRef.current = true;
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
      toast.error(
        hasLoadedRef.current
          ? "Could not refresh dashboard — showing last loaded data"
          : "Failed to load dashboard. Check your connection and try again."
      );
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
      const now = Date.now();
      if (now - lastLiveErrorToast.current > 60000) {
        lastLiveErrorToast.current = now;
        toast.error("Live metrics update failed — will retry shortly");
      }
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
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 font-medium">Welcome back, {firstName}</p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 mt-1">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">A snapshot of your colleges and students today.</p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-gray-400 tabular-nums mr-1">
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/app/superadmin/colleges"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Manage Colleges
          </Link>
          <Link
            to="/app/superadmin/students"
            className="rounded-lg bg-navy-900 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800"
          >
            View Students
          </Link>
        </div>
      </header>

      {visibleAlerts.length > 0 && (
        <div className="space-y-2">
          {visibleAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              type={alert.type}
              title={alert.title}
              message={alert.message}
              action={ALERT_LINKS[alert.id] ? { label: "View", onClick: () => navigate(ALERT_LINKS[alert.id]) } : undefined}
              onClose={() => setDismissedAlerts((prev) => new Set(prev).add(alert.id))}
            />
          ))}
        </div>
      )}

      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Colleges" value={metrics?.totalColleges ?? 0} delta={`+${live?.today.newColleges ?? 0} today`} icon={GraduationCap} onClick={() => navigate("/app/superadmin/colleges")} />
        <KpiCard title="Active Students" value={metrics?.totalStudents ?? 0} delta={`+${live?.today.newStudents ?? 0} today`} icon={Users} onClick={() => navigate("/app/superadmin/students")} />
        <KpiCard title="Pending Actions" value={totalInbox} delta={totalInbox ? "Needs review" : "All clear"} icon={ShieldCheck} onClick={() => navigate("/app/superadmin/approvals")} />
        <KpiCard title="Active Users" value={metrics?.activeUsers ?? 0} delta={`${live?.activeNow ?? 0} online now`} icon={Activity} onClick={() => navigate("/app/superadmin/users")} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Questions in Bank" value={metrics?.totalQuestions ?? 0} delta={`${liveCounts?.pendingQuestions ?? 0} to review`} icon={ClipboardList} onClick={() => navigate("/app/superadmin/question-bank")} />
        <KpiCard title="AI Generated" value={metrics?.aiGeneratedQuestions ?? 0} delta="in question bank" icon={Sparkles} onClick={() => navigate("/app/superadmin/question-bank/ai-generator")} />
        <KpiCard title="Tests Completed" value={metrics?.totalTests ?? 0} delta="all time" icon={BarChart3} />
        <KpiCard title="Avg Readiness" value={formatReadiness(metrics?.avgPlacementReadiness)} delta="exam scores" icon={TrendingUp} onClick={() => navigate("/app/superadmin/analytics")} />
      </div>

      {/* Today live strip */}
      <Panel title="Today">
        <LiveMetricStrip
          today={live?.today ?? { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 }}
          yesterday={live?.yesterday ?? { newStudents: 0, newColleges: 0, examAttempts: 0, completedExams: 0, logins: 0 }}
          activeNow={live?.activeNow ?? 0}
          examsInProgress={live?.examsInProgress ?? 0}
          loading={loading && !live}
        />
      </Panel>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            to={href}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-admin-card hover:border-gray-300 hover:bg-gray-50"
          >
            <Icon className="w-4 h-4 text-admin-accent" />
            {label}
          </Link>
        ))}
      </div>

      {/* Action inbox + charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 min-h-[260px] lg:max-h-[340px]">
          <ActionInbox items={live?.actionItems ?? []} totalPending={totalInbox} loading={loading && !live} onActionComplete={handleInboxAction} />
        </div>
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChartCard compact title="Exams (7d)" data={live?.examTrend ?? []} color="violet" variant="bar" loading={loading && !live} />
          <ChartCard compact title="Colleges (30d)" data={growth.collegeGrowth} color="blue" variant="area" loading={loading} />
          <ChartCard compact title="Students (30d)" data={growth.studentGrowth} color="emerald" variant="bar" loading={loading} />
        </div>
      </div>

      {/* Billing + system tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="sm:col-span-2 bg-white rounded-xl border border-gray-200/70 p-5 shadow-admin-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-admin-accent" />
              <span className="text-sm font-semibold text-gray-900">Billing · {billing?.academic_year ?? "—"}</span>
            </div>
            <Link to="/app/superadmin/billing" className="text-xs font-medium text-admin-accent hover:underline">View all →</Link>
          </div>
          {loading && !billing ? (
            <div className="h-12 bg-gray-50 rounded animate-pulse" />
          ) : (
            <>
              <p className="text-2xl font-display font-semibold text-gray-900 tabular-nums">{formatCurrency(collected)}</p>
              <p className="text-xs text-gray-500 mt-1">of {formatCurrency(expected)} expected</p>
              <div className="mt-3 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-admin-accent transition-all" style={{ width: `${Math.min(billingPct, 100)}%` }} />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {billingPct}% collected
                {(billing?.pending ?? 0) > 0 && (
                  <> · <Link to="/app/superadmin/billing" className="text-gray-900 font-medium hover:underline">{billing?.pending} pending</Link></>
                )}
              </p>
            </>
          )}
        </div>

        <StatTile label="Exams in progress" value={live?.examsInProgress ?? 0} href="/app/superadmin/analytics" highlight={(live?.examsInProgress ?? 0) > 0} />
        <StatTile label="Failed logins (1h)" value={liveCounts?.failedLoginsLastHour ?? 0} href="/app/superadmin/audit-trail" warn={(liveCounts?.failedLoginsLastHour ?? 0) >= 5} />
        <StatTile label="Suspended colleges" value={liveCounts?.suspendedColleges ?? 0} href="/app/superadmin/colleges" />
        <StatTile label="AI pending review" value={liveCounts?.pendingQuestions ?? 0} href="/app/superadmin/approvals" warn={(liveCounts?.pendingQuestions ?? 0) > 0} />
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ListPanel icon={Building2} title="Top colleges" href="/app/superadmin/colleges" loading={loading} empty="No colleges yet">
          {mostActiveColleges.slice(0, 5).map((c, i) => (
            <Link key={c.id} to={`/app/superadmin/colleges/${c.id}`} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 text-sm border-t border-gray-100 first:border-t-0">
              <span className="text-gray-400 text-xs w-4">{i + 1}</span>
              <span className="flex-1 truncate font-medium text-gray-900 mx-2">{c.name}</span>
              <span className="text-xs text-gray-500 tabular-nums">{c.studentCount}</span>
            </Link>
          ))}
        </ListPanel>

        <ListPanel icon={Clock} title="Recent activity" href="/app/superadmin/audit-trail" loading={loading} empty="No recent events">
          {recentActivities.slice(0, 6).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 px-5 py-2.5 border-t border-gray-100 first:border-t-0 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900">{a.user}</span>
                <span className="text-gray-400 mx-1">·</span>
                <span className="text-gray-600">{a.action}</span>
              </div>
              <time className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                {new Date(a.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </time>
            </div>
          ))}
        </ListPanel>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  delta,
  icon: Icon,
  onClick,
}: {
  title: string;
  value: number | string;
  delta?: string;
  icon: LucideIcon;
  onClick?: () => void;
}) {
  const Wrapper: any = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`text-left w-full bg-white rounded-xl border border-gray-200/70 p-5 shadow-admin-card transition-shadow ${
        onClick ? "hover:shadow-admin-elegant cursor-pointer" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-900/[0.06] text-navy-900">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowUpRight className="h-4 w-4 text-gray-300" />
      </div>
      <div className="mt-4">
        <div className="text-2xl font-display font-semibold tracking-tight text-gray-900 tabular-nums">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{title}</div>
        {delta && <div className="text-xs text-admin-accent mt-2 font-medium">{delta}</div>}
      </div>
    </Wrapper>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200/70 p-5 shadow-admin-card">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400 mb-3">{title}</p>
      {children}
    </section>
  );
}

function StatTile({ label, value, href, warn, highlight }: { label: string; value: number; href: string; warn?: boolean; highlight?: boolean }) {
  return (
    <Link
      to={href}
      className={`bg-white rounded-xl border p-5 shadow-admin-card hover:border-gray-300 transition-colors ${warn ? "border-rose-200" : "border-gray-200/70"}`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-display font-semibold tabular-nums ${warn ? "text-rose-600" : highlight ? "text-admin-accent" : "text-gray-900"}`}>
        {value}
      </p>
    </Link>
  );
}

function ListPanel({
  icon: Icon,
  title,
  href,
  loading,
  empty,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  href: string;
  loading?: boolean;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Children.count(children) > 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200/70 shadow-admin-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-admin-accent" />
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        </div>
        <Link to={href} className="text-xs font-medium text-gray-500 hover:text-gray-900 flex items-center gap-0.5">
          All <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      {loading ? (
        <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 bg-gray-50 rounded animate-pulse" />)}</div>
      ) : !hasChildren ? (
        <p className="p-6 text-sm text-gray-400 text-center">{empty}</p>
      ) : (
        <div className="max-h-[240px] overflow-y-auto">{children}</div>
      )}
    </div>
  );
}
