import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  Users,
  CheckCircle2,
  UserCog,
  BookOpen,
  Workflow,
  BarChart3,
  Cpu,
  Bell,
  CreditCard,
  Settings,
  ChevronDown,
  LogOut,
  Package,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { logout } from "../../lib/logout";
import NotificationBell from "../../components/NotificationBell";

interface NavLeaf {
  name: string;
  href: string;
}

interface NavEntry {
  name: string;
  icon: LucideIcon;
  href?: string; // flat item
  children?: NavLeaf[]; // collapsible group
}

interface NavSection {
  label: string;
  items: NavEntry[];
}

const BASE = "/app/superadmin";

// Grouped into Overview / Manage / System (from the redesign) while keeping
// every real route the portal already has.
const SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ name: "Dashboard", icon: LayoutDashboard, href: `${BASE}/dashboard` }],
  },
  {
    label: "Manage",
    items: [
      {
        name: "Colleges",
        icon: GraduationCap,
        children: [
          { name: "All Colleges", href: `${BASE}/colleges` },
          { name: "Add New College", href: `${BASE}/colleges/new` },
          { name: "College Requests", href: `${BASE}/colleges/requests` },
        ],
      },
      { name: "Students", icon: Users, href: `${BASE}/students` },
      { name: "Approvals", icon: CheckCircle2, href: `${BASE}/approvals` },
      { name: "Modules", icon: Package, href: `${BASE}/modules` },
    ],
  },
  {
    label: "System",
    items: [
      {
        name: "Users",
        icon: UserCog,
        children: [
          { name: "All Users", href: `${BASE}/users` },
          { name: "Role Management", href: `${BASE}/roles` },
          { name: "Permission Matrix", href: `${BASE}/roles/matrix` },
        ],
      },
      {
        name: "Question Bank",
        icon: BookOpen,
        children: [
          { name: "All Questions", href: `${BASE}/question-bank` },
          { name: "AI Question Generator", href: `${BASE}/question-bank/ai-generator` },
          { name: "Categories & Topics", href: `${BASE}/question-bank/categories` },
          { name: "Review Queue", href: `${BASE}/question-bank/review-queue` },
          { name: "Import from Books", href: `${BASE}/question-bank/import-books` },
        ],
      },
      {
        name: "Workflows",
        icon: Workflow,
        children: [
          { name: "Aptitude & Reasoning", href: `${BASE}/workflows?category=aptitude` },
          { name: "Soft Skills", href: `${BASE}/workflows?category=soft-skills` },
          { name: "Technical Skills", href: `${BASE}/workflows?category=technical` },
        ],
      },
      {
        name: "Analytics",
        icon: BarChart3,
        children: [
          { name: "Platform Overview", href: `${BASE}/analytics` },
          { name: "College Performance", href: `${BASE}/analytics?view=colleges` },
          { name: "Reports", href: `${BASE}/analytics?view=reports` },
        ],
      },
      {
        name: "AI Configuration",
        icon: Cpu,
        children: [
          { name: "API Keys & Services", href: `${BASE}/ai-config?tab=services` },
          { name: "Model Settings", href: `${BASE}/ai-config` },
          { name: "Prompt Templates", href: `${BASE}/ai-config?tab=prompts` },
          { name: "Usage Quotas", href: `${BASE}/ai-config?tab=quotas` },
          { name: "Usage Monitoring", href: `${BASE}/ai-config?tab=usage` },
        ],
      },
      { name: "Notifications", icon: Bell, href: `${BASE}/notifications` },
      { name: "Billing", icon: CreditCard, href: `${BASE}/billing` },
      {
        name: "Settings",
        icon: Settings,
        children: [
          { name: "System Settings", href: `${BASE}/settings` },
          { name: "Audit Logs", href: `${BASE}/audit-trail` },
          { name: "My Security (2FA)", href: `/app/security` },
          { name: "Backup & Security", href: `${BASE}/settings?tab=backup` },
        ],
      },
    ],
  },
];

const ALL_ENTRIES = SECTIONS.flatMap((s) => s.items);

function basePath(href: string) {
  return href.split("?")[0];
}

function initials(name?: string) {
  if (!name) return "AU";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AU";
}

export default function SuperAdminLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const current = location.pathname + location.search;

  // A leaf is active when its full path (incl. query) matches. Query-less leaves
  // require an empty search so query-siblings on the same page don't both light up.
  const leafActive = (href: string) => {
    if (href.includes("?")) return current === href;
    return location.pathname === href && location.search === "";
  };

  // A group owns the current route when the pathname matches any child's base path.
  const groupOwnsRoute = (entry: NavEntry) =>
    !!entry.children?.some(
      (c) =>
        location.pathname === basePath(c.href) ||
        location.pathname.startsWith(basePath(c.href) + "/")
    );

  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Auto-expand whichever group contains the active route.
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const entry of ALL_ENTRIES) {
        if (entry.children && groupOwnsRoute(entry)) next[entry.name] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Route is guarded by ProtectedRoute + RoleGuard; belt-and-suspenders bounce
  // if the session token disappears mid-session.
  useEffect(() => {
    if (!token) window.location.href = "/auth/login";
  }, [token]);

  const handleLogout = () => {
    void logout().finally(() => {
      window.location.href = "/auth/login";
    });
  };

  const flatClasses = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
      active
        ? "bg-white/10 text-white"
        : "text-slate-300/80 hover:bg-white/5 hover:text-white"
    }`;

  const leafClasses = (active: boolean) =>
    `flex items-center rounded-lg px-3 py-1.5 text-sm transition-colors duration-150 ${
      active
        ? "bg-white/10 font-medium text-white"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <div className="admin-shell flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col bg-navy-900 text-slate-300">
        {/* Brand */}
        <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-white shadow-admin-elegant">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-semibold text-white">GradLogic</span>
            <span className="text-[11px] text-white/50">Admin Console</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((entry) => {
                  const Icon = entry.icon;

                  // Flat item
                  if (!entry.children) {
                    return (
                      <NavLink
                        key={entry.name}
                        to={entry.href!}
                        className={flatClasses(leafActive(entry.href!))}
                      >
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="flex-1">{entry.name}</span>
                      </NavLink>
                    );
                  }

                  // Collapsible group
                  const isOpen = open[entry.name] ?? false;
                  const owns = groupOwnsRoute(entry);
                  return (
                    <div key={entry.name}>
                      <button
                        type="button"
                        onClick={() => setOpen((p) => ({ ...p, [entry.name]: !isOpen }))}
                        className={flatClasses(owns && !isOpen)}
                      >
                        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                        <span className="flex-1 text-left">{entry.name}</span>
                        <ChevronDown
                          className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform duration-150 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>

                      {isOpen && (
                        <div className="ml-[1.15rem] mt-1 space-y-0.5 border-l border-white/10 pl-3">
                          {entry.children.map((child) => (
                            <NavLink
                              key={child.href}
                              to={child.href}
                              className={leafClasses(leafActive(child.href))}
                            >
                              <span className="flex-1">{child.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 px-3 py-3">
          <div className="flex items-center gap-2.5 px-1 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-admin-accent text-xs font-semibold text-white">
              {initials(user?.name)}
            </div>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-white">
                {user?.name || "Admin"}
              </span>
              <span className="truncate text-[11px] text-white/50">{user?.email}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300/80 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/80 px-6 backdrop-blur">
          <div className="text-sm text-gray-500">Admin Console</div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
