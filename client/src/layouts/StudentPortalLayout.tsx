import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import { PortalFeatureOutlet } from "../components/PortalFeatureOutlet";
import { LearningCompanionProvider } from "../contexts/LearningCompanionContext";
import LearningCompanionWidget from "../components/student/LearningCompanionWidget";
import OfflineBanner from "../components/student/OfflineBanner";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  BookOpenCheck,
  Dumbbell,
  ClipboardList,
  Bell,
  User,
  GraduationCap,
  LogOut,
  Flame,
  Sparkles,
  Menu,
  X,
  BarChart3,
  Settings,
  CreditCard,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { logout } from "../lib/logout";
import NotificationBell from "../components/NotificationBell";
import studentPracticeService from "../services/studentPracticeService";
import studentPaymentsService from "../services/studentPaymentsService";
import studentDashboardService from "../services/studentDashboardService";
import { cn } from "../lib/utils";
import { usePortalFeatures } from "../hooks/usePortalFeatures";
import { STUDENT_NAV_FEATURE_MAP, type PlatformFeatureKey } from "../constants/platformFeatures";
import { useStudentMobilePrefs } from "../hooks/useStudentMobilePrefs";

const BASE = "/app/student-portal";
const COLLAPSE_KEY = "student-portal-sidebar-collapsed";

const BOTTOM_TABS: {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
  matchPrefixes?: string[];
}[] = [
  { name: "Home", href: BASE, icon: LayoutDashboard, end: true },
  { name: "Learn", href: `${BASE}/my-learning`, icon: BookOpenCheck, matchPrefixes: ["/my-learning"] },
  { name: "Practice", href: `${BASE}/practice`, icon: Dumbbell, matchPrefixes: ["/practice", "/question-bank"] },
  {
    name: "Assess",
    href: `${BASE}/my-assessments`,
    icon: ClipboardList,
    matchPrefixes: ["/my-assessments", "/results", "/assessments"],
  },
];

function hrefFeatureKey(href: string): PlatformFeatureKey | null {
  const suffix = href === BASE ? "" : href.replace(`${BASE}/`, "").split("?")[0];
  const top = suffix.split("/")[0] || "";
  return STUDENT_NAV_FEATURE_MAP[suffix] ?? STUDENT_NAV_FEATURE_MAP[top] ?? null;
}

const NAV_GROUPS: {
  label: string | null;
  items: { name: string; href: string; icon: typeof LayoutDashboard; end?: boolean }[];
}[] = [
  {
    label: null,
    items: [{ name: "Dashboard", href: BASE, icon: LayoutDashboard, end: true }],
  },
  {
    label: "Learn",
    items: [{ name: "Learning Hub", href: `${BASE}/my-learning`, icon: BookOpenCheck }],
  },
  {
    label: "Practice",
    items: [{ name: "Practice Hub", href: `${BASE}/practice`, icon: Dumbbell }],
  },
  {
    label: "Assessments",
    items: [
      { name: "My Assessments", href: `${BASE}/my-assessments`, icon: ClipboardList },
      { name: "Results", href: `${BASE}/results`, icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { name: "Profile", href: `${BASE}/profile`, icon: User },
      { name: "Notifications", href: `${BASE}/notifications`, icon: Bell },
      { name: "Settings", href: `${BASE}/settings`, icon: Settings },
    ],
  },
];

export const FUTURE_NAV_GROUPS = [
  {
    label: "Inside Practice Hub",
    items: [{ name: "Question Library", href: `${BASE}/question-bank` }],
  },
  {
    label: "Overview",
    items: [{ name: "My Workflow", href: `${BASE}/workflow` }],
  },
  {
    label: "Learning (internal / future)",
    items: [
      { name: "Skill Programs", href: `${BASE}/learn` },
      { name: "Course Catalog", href: "/app/lms/catalog" },
      { name: "Adaptive Learning", href: `${BASE}/adaptive-learning` },
      { name: "AI Search", href: `${BASE}/ai-search` },
      { name: "Tests & Mocks", href: `${BASE}/tests` },
    ],
  },
  {
    label: "Progress (future)",
    items: [{ name: "Achievements", href: `${BASE}/achievements` }],
  },
  {
    label: "Account (future)",
    items: [
      { name: "Payments", href: `${BASE}/payments` },
      { name: "Sessions", href: `${BASE}/sessions` },
    ],
  },
] as const;

function initials(name?: string) {
  if (!name) return "ST";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "ST";
}

function formatINR(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function tabIsActive(pathname: string, tab: (typeof BOTTOM_TABS)[number]): boolean {
  if (tab.end) return pathname === tab.href || pathname === `${tab.href}/`;
  if (tab.matchPrefixes?.length) {
    return tab.matchPrefixes.some((p) => pathname.startsWith(`${BASE}${p}`));
  }
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export default function StudentPortalLayout() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const { hasFeature } = usePortalFeatures("student");
  const { prefs, isDark, isOnline, fontScale } = useStudentMobilePrefs();

  const allNavGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasFeature(hrefFeatureKey(item.href))),
  })).filter((group) => group.items.length > 0);

  const bottomTabs = BOTTOM_TABS.filter((tab) => hasFeature(hrefFeatureKey(tab.href)));

  useEffect(() => {
    if (!token) window.location.href = "/auth/login";
  }, [token]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const { data: daily } = useQuery({
    queryKey: ["student-daily-target"],
    queryFn: () => studentPracticeService.getDailyTarget(),
    staleTime: 30_000,
  });
  const { data: fees } = useQuery({
    queryKey: ["student-my-fees"],
    queryFn: () => studentPaymentsService.getMyFees(),
    staleTime: 60_000,
  });
  const { data: shell } = useQuery({
    queryKey: ["student-dashboard-shell-nav"],
    queryFn: () => studentDashboardService.getShell(),
    staleTime: 60_000,
  });

  const streak = daily?.current_streak ?? 0;
  const student = shell?.student;
  const displayName = student?.name || user?.name || "Student";
  const photoUrl = student?.profile_photo_url || null;
  const department = student?.specialization || student?.degree || user?.department || null;
  const semester = student?.class_name
    ? student.section
      ? `${student.class_name} · ${student.section}`
      : student.class_name
    : student?.section || null;

  const due = fees?.current;
  const feeBadge = !due
    ? null
    : due.status === "paid"
      ? {
          text: "All fees paid",
          cls: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
        }
      : due.status === "overdue"
        ? {
            text: `${formatINR(due.amount)} overdue`,
            cls: "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800",
          }
        : {
            text: `${formatINR(due.amount)} due`,
            cls: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
          };

  const handleLogout = () => {
    void logout().finally(() => {
      window.location.href = "/auth/login";
    });
  };

  const renderSidebar = (opts: { forceExpanded?: boolean } = {}) => {
    const isCollapsed = opts.forceExpanded ? false : collapsed;

    const navLinkClass = ({ isActive }: { isActive: boolean }) =>
      cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium outline-none transition-all duration-200",
        isCollapsed && "justify-center px-2",
        "focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900",
        isActive
          ? "bg-white/12 text-white shadow-sm ring-1 ring-white/10"
          : "text-slate-300/90 hover:bg-white/[0.06] hover:text-white",
        !isCollapsed && !isActive && "hover:translate-x-0.5"
      );

    return (
      <>
        <div className={cn("border-b border-white/10", isCollapsed ? "px-2 py-3" : "px-4 py-4")}>
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "gap-2.5")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-admin-accent text-white shadow-admin-elegant">
              <GraduationCap className="h-5 w-5" aria-hidden />
            </div>
            {!isCollapsed && (
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate font-display text-[15px] font-semibold tracking-tight text-white">
                  GradLogic
                </span>
                <span className="truncate text-[11px] text-white/45">Learn · Practice · Assess</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <div
              className="mt-3 flex items-center gap-2 rounded-xl border border-orange-400/25 bg-orange-500/10 px-2.5 py-2"
              aria-label={`${streak}-day learning streak`}
            >
              <Flame className="h-4 w-4 shrink-0 text-orange-400" aria-hidden />
              <span className="text-xs font-semibold text-white/90">{streak}-Day Learning Streak</span>
            </div>
          )}
          {isCollapsed && (
            <div
              className="mt-2 flex justify-center"
              title={`${streak}-day learning streak`}
              aria-label={`${streak}-day learning streak`}
            >
              <Flame className="h-4 w-4 text-orange-400" aria-hidden />
            </div>
          )}
        </div>

        <nav
          className={cn("flex-1 space-y-5 overflow-y-auto py-4", isCollapsed ? "px-1.5" : "px-3")}
          aria-label="Student journey"
        >
          {allNavGroups.map((group) => (
            <div key={group.label || "root"}>
              {group.label && !isCollapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
                  {group.label}
                </p>
              )}
              {group.label && isCollapsed && (
                <div className="mx-auto mb-1.5 h-px w-6 bg-white/10" aria-hidden />
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <NavLink
                        to={item.href}
                        end={item.end === true ? true : undefined}
                        className={navLinkClass}
                        onClick={() => setMobileOpen(false)}
                        title={isCollapsed ? item.name : undefined}
                        aria-label={item.name}
                      >
                        <Icon
                          className="h-[18px] w-[18px] shrink-0 opacity-90 group-hover:opacity-100"
                          aria-hidden
                        />
                        {!isCollapsed && <span className="truncate">{item.name}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className={cn("space-y-2 border-t border-white/10 py-3", isCollapsed ? "px-1.5" : "px-3")}>
          <Link
            to={`${BASE}/profile`}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center rounded-xl transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              isCollapsed ? "justify-center p-2" : "gap-3 px-2 py-2"
            )}
            title={isCollapsed ? displayName : undefined}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/15"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-admin-accent text-xs font-semibold text-white ring-2 ring-white/15">
                {initials(displayName)}
              </div>
            )}
            {!isCollapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold text-white">{displayName}</span>
                {department && (
                  <span className="mt-0.5 block truncate text-[11px] text-white/55">{department}</span>
                )}
                {semester && (
                  <span className="mt-0.5 block truncate text-[11px] text-white/40">{semester}</span>
                )}
                {!department && !semester && (
                  <span className="mt-0.5 block truncate text-[11px] text-white/45">
                    {user?.email || "Student"}
                  </span>
                )}
              </div>
            )}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              "flex w-full items-center rounded-xl text-sm text-slate-300/80 transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              isCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            )}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-[18px] w-[18px]" aria-hidden />
            {!isCollapsed && "Logout"}
          </button>
        </div>
      </>
    );
  };

  return (
    <LearningCompanionProvider>
      <div
        className={cn(
          "admin-shell student-portal-shell flex h-[100dvh] min-h-[100dvh] bg-slate-50 dark:bg-slate-950",
          isDark && "dark"
        )}
        style={{ ["--student-font-scale" as string]: String(fontScale) }}
        data-low-bandwidth={prefs.lowBandwidth ? "1" : "0"}
      >
        <aside
          className={cn(
            "relative hidden flex-col bg-navy-900 text-slate-300 transition-[width] duration-200 ease-out md:flex",
            collapsed ? "w-[72px]" : "w-64"
          )}
        >
          {renderSidebar()}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <button
              type="button"
              className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="relative flex h-full w-64 flex-col bg-navy-900 text-slate-300 shadow-2xl animate-in slide-in-from-left duration-200">
              {renderSidebar({ forceExpanded: true })}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="student-top-header sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur sm:px-6 dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 md:hidden dark:text-slate-300 dark:hover:bg-slate-800"
                onClick={() => setMobileOpen((o) => !o)}
                aria-label={mobileOpen ? "Close menu" : "Open menu"}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <p className="hidden text-sm font-medium text-slate-500 sm:block dark:text-slate-400">
                Student Portal
              </p>
            </div>
            <div className="flex items-center gap-2">
              {feeBadge && (
                <Link
                  to={`${BASE}/payments`}
                  className={cn(
                    "hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold sm:inline-flex",
                    feeBadge.cls
                  )}
                >
                  <CreditCard className="h-3.5 w-3.5" />
                  {feeBadge.text}
                </Link>
              )}
              <NotificationBell />
            </div>
          </header>

          <OfflineBanner online={isOnline} />

          <main className="student-main-surface flex-1 overflow-auto bg-slate-50 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:p-6 md:pb-6 dark:bg-slate-950">
            <PortalFeatureOutlet portal="student" />
          </main>

          <nav
            className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-1 pb-[env(safe-area-inset-bottom,0px)] pt-1 backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-900/95"
            aria-label="Primary journey"
          >
            <ul className="mx-auto flex max-w-lg items-stretch justify-between">
              {bottomTabs.map((tab) => {
                const Icon = tab.icon;
                const active = tabIsActive(location.pathname, tab);
                return (
                  <li key={tab.href} className="flex-1">
                    <NavLink
                      to={tab.href}
                      end={tab.end}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-[3.25rem] flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-admin-accent/40",
                        active ? "text-admin-accent" : "text-slate-500 dark:text-slate-400"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                      <span>{tab.name}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <LearningCompanionWidget />
      </div>
    </LearningCompanionProvider>
  );
}
