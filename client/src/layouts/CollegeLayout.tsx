import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { PortalFeatureOutlet } from "../components/PortalFeatureOutlet";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Workflow,
  ClipboardList,
  CalendarRange,
  PlayCircle,
  BarChart3,
  MessageSquare,
  Code2,
  Settings,
  GraduationCap,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Wallet,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { logout } from "../lib/logout";
import NotificationBell from "../components/NotificationBell";
import { cn } from "../lib/utils";
import { usePortalFeatures } from "../hooks/usePortalFeatures";
import { moduleIcon } from "../constants/lmsModules";
import type { PlatformFeatureKey } from "../constants/platformFeatures";

const BASE = "/app/college-portal";

/** Primary navigation for the Campus / College Portal (TPO role). */
const NAV_ITEMS: {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  segment: string;
  featureKey: PlatformFeatureKey | null;
  /** Omit to allow every role this layout already gates for (see RoleGuard above). */
  roles?: string[];
}[] = [
  { name: "Dashboard", href: `${BASE}/dashboard`, icon: LayoutDashboard, segment: "dashboard", featureKey: null },
  { name: "Students", href: `${BASE}/students`, icon: Users, segment: "students", featureKey: "students" },
  { name: "Question Bank", href: `${BASE}/question-bank`, icon: BookOpen, segment: "question-bank", featureKey: "question_bank" },
  { name: "Workflows", href: `${BASE}/workflows`, icon: Workflow, segment: "workflows", featureKey: "workflows" },
  { name: "Tests & Assessments", href: `${BASE}/assessments`, icon: ClipboardList, segment: "assessments", featureKey: "assessments" },
  { name: "Assessment Campaigns", href: `${BASE}/campaigns`, icon: CalendarRange, segment: "campaigns", featureKey: "assessments" },
  { name: "Scheduled Tests", href: `${BASE}/drives`, icon: PlayCircle, segment: "drives", featureKey: "assessments" },
  { name: "Analytics & Reports", href: `${BASE}/analytics`, icon: BarChart3, segment: "analytics", featureKey: "analytics" },
  { name: "Placement Insights", href: `${BASE}/insights`, icon: TrendingUp, segment: "insights", featureKey: "analytics" },
  { name: "Billing", href: `${BASE}/billing`, icon: Wallet, segment: "billing", featureKey: "payments", roles: ["college_admin", "college"] },
  { name: "Integrity", href: `${BASE}/integrity`, icon: ShieldCheck, segment: "integrity", featureKey: "analytics" },
  { name: "Soft Skills", href: `${BASE}/soft-skills`, icon: MessageSquare, segment: "soft-skills", featureKey: "soft_skills" },
  { name: "Technical Skills", href: `${BASE}/technical-skills`, icon: Code2, segment: "technical-skills", featureKey: "technical_skills" },
  { name: "Settings", href: `${BASE}/settings`, icon: Settings, segment: "settings", featureKey: "settings" },
];

function initials(name?: string) {
  if (!name) return "TP";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "TP";
}

export default function CollegeLayout() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasFeature, modules: lmsModules } = usePortalFeatures("college");

  const visibleNav = NAV_ITEMS.filter(
    (item) => hasFeature(item.featureKey) && (!item.roles || item.roles.includes(user?.role ?? ""))
  );

  useEffect(() => {
    if (!token) window.location.href = "/auth/login";
  }, [token]);

  const handleLogout = () => {
    void logout().finally(() => {
      window.location.href = "/auth/login";
    });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      isActive
        ? "bg-white/10 text-white"
        : "text-slate-300/90 hover:bg-white/5 hover:text-white"
    );

  const sidebar = (
    <>
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-white shadow-admin-elegant">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display font-semibold text-white">GradLogic</span>
          <span className="text-[11px] text-white/50">Campus Portal</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
          Placement Office
        </p>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={navLinkClass}
              onClick={() => setMobileOpen(false)}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}

        {lmsModules.length > 0 && (
          <>
            <p className="mt-4 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-white/35">
              Learning Modules
            </p>
            {lmsModules.map((mod) => {
              const ModIcon = moduleIcon(mod.icon);
              return (
                <NavLink
                  key={mod.key}
                  to={`${BASE}/lms/${mod.key}`}
                  className={navLinkClass}
                  onClick={() => setMobileOpen(false)}
                >
                  <ModIcon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{mod.name}</span>
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-accent text-xs font-semibold text-white">
            {initials(user?.name)}
          </div>
          <div className="min-w-0 flex-col leading-tight">
            <span className="block truncate text-sm font-medium text-white">
              {user?.name || "TPO Admin"}
            </span>
            <span className="block truncate text-[11px] text-white/50">{user?.email}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300/80 transition-colors hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="admin-shell flex h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col bg-navy-900 text-slate-300 md:flex">{sidebar}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-64 flex-col bg-navy-900 text-slate-300 shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div>
              <p className="text-sm font-medium text-gray-900">Campus Portal</p>
              <p className="text-xs text-gray-500 hidden sm:block">
                Training & Placement — your college only
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-slate-50">
          <PortalFeatureOutlet portal="college" />
        </main>
      </div>
    </div>
  );
}
