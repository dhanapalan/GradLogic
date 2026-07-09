import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { PortalFeatureOutlet } from "../components/PortalFeatureOutlet";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Workflow,
  BookOpenCheck,
  Dumbbell,
  ClipboardCheck,
  Library,
  Trophy,
  CreditCard,
  Bell,
  User,
  GraduationCap,
  LogOut,
  Flame,
  Menu,
  X,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { logout } from "../lib/logout";
import studentPracticeService from "../services/studentPracticeService";
import studentPaymentsService from "../services/studentPaymentsService";
import { cn } from "../lib/utils";
import { usePortalFeatures } from "../hooks/usePortalFeatures";
import { moduleIcon } from "../constants/lmsModules";
import { STUDENT_NAV_FEATURE_MAP, type PlatformFeatureKey } from "../constants/platformFeatures";

const BASE = "/app/student-portal";

function hrefFeatureKey(href: string): PlatformFeatureKey | null {
  const suffix = href === BASE ? "" : href.replace(`${BASE}/`, "");
  return STUDENT_NAV_FEATURE_MAP[suffix] ?? null;
}

/** Grouped navigation mirroring the Student Portal export. */
const NAV_GROUPS: {
  label: string;
  items: { name: string; href: string; icon: typeof LayoutDashboard; end?: boolean }[];
}[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: BASE, icon: LayoutDashboard, end: true },
      { name: "My Workflow", href: `${BASE}/workflow`, icon: Workflow },
    ],
  },
  {
    label: "Learning",
    items: [
      { name: "Learn", href: `${BASE}/learn`, icon: BookOpenCheck },
      { name: "Practice", href: `${BASE}/practice`, icon: Dumbbell },
      { name: "Tests & Mocks", href: `${BASE}/tests`, icon: ClipboardCheck },
      { name: "Question Bank", href: `${BASE}/question-bank`, icon: Library },
    ],
  },
  {
    label: "Progress",
    items: [{ name: "Achievements", href: `${BASE}/achievements`, icon: Trophy }],
  },
  {
    label: "Account",
    items: [
      { name: "Payments", href: `${BASE}/payments`, icon: CreditCard },
      { name: "Notifications", href: `${BASE}/notifications`, icon: Bell },
      { name: "Profile", href: `${BASE}/profile`, icon: User },
    ],
  },
];

function initials(name?: string) {
  if (!name) return "ST";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "ST";
}

function formatINR(n: number) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

export default function StudentPortalLayout() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasFeature, modules: lmsModules } = usePortalFeatures("student");

  const filteredGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasFeature(hrefFeatureKey(item.href))),
  })).filter((group) => group.items.length > 0);

  const lmsNavItems =
    lmsModules.length > 0
      ? [
          {
            label: "Learning Modules",
            items: lmsModules.map((mod) => {
              const ModIcon = moduleIcon(mod.icon);
              return {
                name: mod.name,
                href: `${BASE}/lms/${mod.key}`,
                icon: ModIcon,
              };
            }),
          },
        ]
      : [];

  const allNavGroups = [...filteredGroups, ...lmsNavItems];

  useEffect(() => {
    if (!token) window.location.href = "/auth/login";
  }, [token]);

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

  const streak = daily?.current_streak ?? 0;
  const due = fees?.current;
  const feeBadge = !due
    ? null
    : due.status === "paid"
      ? { text: "All fees paid", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" }
      : due.status === "overdue"
        ? { text: `${formatINR(due.amount)} overdue`, cls: "bg-rose-50 text-rose-700 border-rose-100" }
        : { text: `${formatINR(due.amount)} due`, cls: "bg-amber-50 text-amber-700 border-amber-100" };

  const handleLogout = () => {
    void logout().finally(() => {
      window.location.href = "/auth/login";
    });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
      isActive
        ? "bg-indigo-50 text-indigo-700"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    );

  const sidebar = (
    <>
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="font-black text-slate-900 truncate">GradLogic</span>
            <span className="text-[11px] text-slate-400 truncate">Student Portal</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-orange-100 bg-orange-50/60 px-2.5 py-1.5">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-xs font-bold text-slate-700">{streak}-day streak</span>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {allNavGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={(item as { end?: boolean }).end === true ? true : undefined}
                    className={navLinkClass}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-100 px-3 py-3">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-col leading-tight">
            <span className="block truncate text-sm font-bold text-slate-900">{user?.name || "Student"}</span>
            <span className="block truncate text-[11px] text-slate-400">{user?.email}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-white shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <p className="text-sm font-medium text-slate-500 hidden sm:block">Student Portal</p>
          </div>
          <div className="flex items-center gap-2">
            {feeBadge && (
              <Link
                to={`${BASE}/payments`}
                className={cn(
                  "hidden sm:inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold",
                  feeBadge.cls
                )}
              >
                <CreditCard className="h-3.5 w-3.5" />
                {feeBadge.text}
              </Link>
            )}
            <Link
              to={`${BASE}/notifications`}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50 p-4 sm:p-6">
          <PortalFeatureOutlet portal="student" />
        </main>
      </div>
    </div>
  );
}
