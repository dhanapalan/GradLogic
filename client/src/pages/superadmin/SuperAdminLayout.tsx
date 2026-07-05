import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { authActions, useAuthStore } from "../../stores/authStore";
import Logo from "../../components/Logo";
import NotificationBell from "../../components/NotificationBell";
import {
  HomeIcon,
  UsersIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  BookOpenIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  ChevronRightIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

type IconType = React.ForwardRefExoticComponent<
  React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }
>;

interface NavLeaf {
  name: string;
  href: string;
}

interface NavEntry {
  name: string;
  icon: IconType;
  href?: string; // flat item
  children?: NavLeaf[]; // collapsible group
}

const BASE = "/app/superadmin";

const navigation: NavEntry[] = [
  { name: "Dashboard", icon: HomeIcon, href: `${BASE}/dashboard` },
  {
    name: "Colleges",
    icon: AcademicCapIcon,
    children: [
      { name: "All Colleges", href: `${BASE}/colleges` },
      { name: "Add New College", href: `${BASE}/colleges/new` },
      { name: "College Requests", href: `${BASE}/colleges/requests` },
    ],
  },
  { name: "Students", icon: UserGroupIcon, href: `${BASE}/students` },
  { name: "Approvals", icon: CheckBadgeIcon, href: `${BASE}/approvals` },
  {
    name: "Users",
    icon: UsersIcon,
    children: [
      { name: "All Users", href: `${BASE}/users` },
      { name: "Role Management", href: `${BASE}/roles` },
    ],
  },
  {
    name: "Question Bank",
    icon: ClipboardDocumentListIcon,
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
    icon: BookOpenIcon,
    children: [
      { name: "Aptitude & Reasoning", href: `${BASE}/workflows?category=aptitude` },
      { name: "Soft Skills", href: `${BASE}/workflows?category=soft-skills` },
      { name: "Technical Skills", href: `${BASE}/workflows?category=technical` },
    ],
  },
  {
    name: "Analytics",
    icon: ChartBarIcon,
    children: [
      { name: "Platform Overview", href: `${BASE}/analytics` },
      { name: "College Performance", href: `${BASE}/analytics?view=colleges` },
      { name: "Reports", href: `${BASE}/analytics?view=reports` },
    ],
  },
  {
    name: "AI Configuration",
    icon: Cog6ToothIcon,
    children: [
      { name: "API Keys & Services", href: `${BASE}/ai-config?tab=services` },
      { name: "Model Settings", href: `${BASE}/ai-config` },
      { name: "Prompt Templates", href: `${BASE}/ai-config?tab=prompts` },
      { name: "Usage Quotas", href: `${BASE}/ai-config?tab=quotas` },
      { name: "Usage Monitoring", href: `${BASE}/ai-config?tab=usage` },
    ],
  },
  { name: "Notifications", icon: EnvelopeIcon, href: `${BASE}/notifications` },
  { name: "Billing", icon: CreditCardIcon, href: `${BASE}/billing` },
  {
    name: "Settings",
    icon: WrenchScrewdriverIcon,
    children: [
      { name: "System Settings", href: `${BASE}/settings` },
      { name: "Audit Logs", href: `${BASE}/audit-trail` },
      { name: "Backup & Security", href: `${BASE}/settings?tab=backup` },
    ],
  },
];

function basePath(href: string) {
  return href.split("?")[0];
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
      for (const entry of navigation) {
        if (entry.children && groupOwnsRoute(entry)) next[entry.name] = true;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  // Route is guarded by ProtectedRoute + RoleGuard; this is a belt-and-suspenders
  // check plus a clean bounce if the session token disappears mid-session.
  useEffect(() => {
    if (!token) {
      window.location.href = "/auth/login";
    }
  }, [token]);

  const handleLogout = () => {
    authActions.logout();
    window.location.href = "/auth/login";
  };

  const leafClasses = (active: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150 ${
      active
        ? "bg-blue-50 font-medium text-blue-700"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    }`;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-gray-200 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-6 py-6">
          <Logo />
          <div>
            <h1 className="text-sm font-bold text-gray-900">TalentSecure</h1>
            <p className="text-xs text-gray-500">SuperAdmin Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navigation.map((entry) => {
            const Icon = entry.icon;

            // Flat item
            if (!entry.children) {
              const active = leafActive(entry.href!);
              return (
                <NavLink
                  key={entry.name}
                  to={entry.href!}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
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
                  onClick={() =>
                    setOpen((p) => ({ ...p, [entry.name]: !isOpen }))
                  }
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    owns && !isOpen
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span className="flex-1 text-left">{entry.name}</span>
                  <ChevronRightIcon
                    className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-150 ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="mt-1 space-y-1 border-l border-gray-100 pl-4">
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
        </nav>

        {/* User Menu */}
        <div className="space-y-2 border-t border-gray-200 px-4 py-4">
          <div className="px-3 py-2 text-sm">
            <p className="font-medium text-gray-900">{user?.name || "Admin"}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">SuperAdmin Portal</h1>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto bg-gray-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
