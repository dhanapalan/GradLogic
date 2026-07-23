import { useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { authActions, useAuthStore } from "../stores/authStore";
import { logout } from "../lib/logout";
import { resolveRole, type AppRole } from "../components/ProtectedRoute";
import Logo from "../components/Logo";
import NotificationBell from "../components/NotificationBell";
import api from "../lib/api";
import {
  HomeIcon,
  UsersIcon,
  ClipboardDocumentListIcon,
  ArrowRightOnRectangleIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  RocketLaunchIcon,
  EyeIcon,
  ChartBarIcon,
  EnvelopeIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  BookOpenIcon,
  PuzzlePieceIcon,
  SparklesIcon,
  TrophyIcon,
  UserCircleIcon,
  CreditCardIcon,
  MapIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";

// ── Sidebar navigation: grouped sections with role access control ────────────

interface NavItem {
  name: string;
  href: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
  roles: AppRole[]; // which roles see this link
}

interface NavSection {
  title: string | null; // null → no header rendered
  items: NavItem[];
}

const navigation: NavSection[] = [
  // ── Overview ────────────────────────────────────────────────────────────────
  {
    title: null,
    items: [
      { name: "HR Dashboard", href: "/app/hr-dashboard", icon: HomeIcon, roles: ["super_admin", "hr", "cxo"] },
      { name: "CXO Analytics", href: "/app/cxo-analytics", icon: ChartBarIcon, roles: ["cxo", "super_admin"] },
      { name: "Dashboard", href: "/app/college-portal/dashboard", icon: HomeIcon, roles: ["college_admin", "college", "college_staff"] },
      { name: "Student Portal", href: "/app/student-portal", icon: HomeIcon, roles: ["student"] },
      { name: "My Students", href: "/app/mentor", icon: UserGroupIcon, roles: ["mentor"] },
      { name: "Engineer Panel", href: "/app/engineer-panel", icon: WrenchScrewdriverIcon, roles: ["engineer"] },
      { name: "Faculty Dashboard", href: "/app/faculty-dashboard", icon: AcademicCapIcon, roles: ["instructor"] },
      { name: "Placement Cell", href: "/app/placement-cell-dashboard", icon: TrophyIcon, roles: ["placement_cell"] },
    ],
  },

  // ── SuperAdmin: colleges & onboarding ───────────────────────────────────────
  {
    title: "Colleges",
    items: [
      { name: "Campuses", href: "/app/campuses", icon: AcademicCapIcon, roles: ["super_admin", "hr"] },
      { name: "Modules", href: "/app/superadmin/modules", icon: Squares2X2Icon, roles: ["super_admin"] },
      { name: "Pending Approvals", href: "/app/approvals/pending", icon: ShieldCheckIcon, roles: ["super_admin", "admin", "hr"] },
      { name: "Placements", href: "/app/placements", icon: TrophyIcon, roles: ["super_admin", "hr"] },
    ],
  },

  // ── SuperAdmin: content studio (question bank + learning content) ───────────
  {
    title: "Content Studio",
    items: [
      { name: "Question Bank", href: "/app/question-bank", icon: ClipboardDocumentListIcon, roles: ["super_admin", "hr", "engineer"] },
      { name: "AI Generator", href: "/app/question-bank/ai-generate", icon: SparklesIcon, roles: ["super_admin", "hr", "engineer"] },
      { name: "Learning Modules", href: "/app/learning-modules", icon: BookOpenIcon, roles: ["super_admin", "hr", "cxo"] },
      { name: "Skills", href: "/app/skills", icon: AcademicCapIcon, roles: ["super_admin", "hr", "cxo"] },
      { name: "Skill Programs", href: "/app/skill-programs", icon: RocketLaunchIcon, roles: ["super_admin", "hr", "cxo"] },
      { name: "Course Builder", href: "/app/lms/builder", icon: BookOpenIcon, roles: ["super_admin", "hr", "instructor"] },
    ],
  },

  // ── SuperAdmin: assessments & proctoring ────────────────────────────────────
  {
    title: "Assessments",
    items: [
      { name: "Drives", href: "/app/drives", icon: RocketLaunchIcon, roles: ["super_admin", "hr", "engineer"] },
      { name: "Assessment Rules", href: "/app/assessment-rules", icon: ClipboardDocumentListIcon, roles: ["super_admin", "hr", "engineer"] },
      { name: "Live Monitoring", href: "/app/admin/monitoring", icon: EyeIcon, roles: ["super_admin", "hr", "cxo"] },
    ],
  },

  // ── SuperAdmin: people & system ─────────────────────────────────────────────
  {
    title: "People & System",
    items: [
      { name: "Students", href: "/app/students", icon: UsersIcon, roles: ["super_admin", "hr", "cxo"] },
      { name: "Skill Partners", href: "/app/skill-partners", icon: UserGroupIcon, roles: ["super_admin", "hr", "cxo"] },
      { name: "Administration", href: "/app/administration", icon: WrenchScrewdriverIcon, roles: ["super_admin", "admin", "hr", "cxo"] },
    ],
  },

  // ── Campus portal: students & performance ───────────────────────────────────
  {
    title: "Students",
    items: [
      { name: "Students", href: "/app/students", icon: UsersIcon, roles: ["college_admin", "college", "college_staff"] },
      { name: "Results", href: "/app/college/results", icon: ClipboardDocumentListIcon, roles: ["college_admin", "college", "college_staff"] },
      { name: "Insights", href: "/app/college/insights", icon: ChartBarIcon, roles: ["college_admin", "college", "college_staff"] },
      { name: "Integrity", href: "/app/college/integrity", icon: ShieldCheckIcon, roles: ["college_admin", "college", "college_staff"] },
    ],
  },

  // ── Campus portal: placement activity ───────────────────────────────────────
  {
    title: "Placement",
    items: [
      { name: "Drives", href: "/app/college/drives", icon: RocketLaunchIcon, roles: ["college_admin", "college", "college_staff"] },
      { name: "Placements", href: "/app/placements", icon: TrophyIcon, roles: ["college_admin"] },
      { name: "Communications", href: "/app/college/communications", icon: EnvelopeIcon, roles: ["college_admin", "college", "college_staff"] },
    ],
  },

  // ── Campus portal: administration ───────────────────────────────────────────
  {
    title: "Administration",
    items: [
      { name: "Campus Admins", href: "/app/college/campus-admins", icon: UserGroupIcon, roles: ["college_admin", "college"] },
      { name: "Billing", href: "/app/college/billing", icon: CreditCardIcon, roles: ["college_admin"] },
      { name: "Settings", href: "/app/college/settings", icon: Cog6ToothIcon, roles: ["college_admin", "college"] },
    ],
  },

  // ── Student portal: learning ────────────────────────────────────────────────
  {
    title: "Learn",
    items: [
      { name: "Learning Portal", href: "/app/learn", icon: BookOpenIcon, roles: ["student"] },
      { name: "Course Catalog", href: "/app/lms/catalog", icon: AcademicCapIcon, roles: ["student", "instructor"] },
      { name: "Soft Skills Hub", href: "/app/student-portal/soft-skills", icon: SparklesIcon, roles: ["student"] },
      { name: "Development", href: "/app/student-portal/development", icon: SparklesIcon, roles: ["student"] },
    ],
  },

  // ── Student portal: practice & exams ────────────────────────────────────────
  {
    title: "Practice & Exams",
    items: [
      { name: "My Workflow", href: "/app/student-portal/workflow", icon: MapIcon, roles: ["student"] },
      { name: "Exams", href: "/app/student-portal?tab=exams", icon: AcademicCapIcon, roles: ["student"] },
      { name: "Practice Arena", href: "/app/student-portal/practice", icon: PuzzlePieceIcon, roles: ["student"] },
      { name: "Question Bank", href: "/app/student-portal/question-bank", icon: ClipboardDocumentListIcon, roles: ["student"] },
      { name: "Achievements", href: "/app/student-portal/gamification", icon: TrophyIcon, roles: ["student"] },
    ],
  },

  // ── Instructor portal ───────────────────────────────────────────────────────
  {
    title: "Teaching",
    items: [
      { name: "Course Builder", href: "/app/lms/builder", icon: BookOpenIcon, roles: ["instructor"] },
    ],
  },
];

// ── Formatted role label ─────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  hr: "HR",
  engineer: "Engineer",
  cxo: "CXO",
  college_admin: "College Admin",
  college: "College",
  college_staff: "College Staff",
  student: "Student",
  instructor: "Instructor",
  mentor: "Mentor",
  placement_cell: "Placement Cell",
};

export default function DashboardLayout() {
  const user = useAuthStore((s) => s.user);
  const effectiveRole = resolveRole(user?.role ?? "student");

  // Refresh user profile on mount to pick up college_name and any server-side changes
  useEffect(() => {
    const isCollegeRole = ["college", "college_admin", "college_staff"].includes(user?.role ?? "");
    if (isCollegeRole && user && !user.college_name) {
      api.get("/auth/me").then(({ data }) => {
        const me = data.data;
        if (me?.college_name) {
          authActions.setUser({ ...user, college_name: me.college_name });
        }
      }).catch(() => { /* silent */ });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter each section's items to the user's role; drop empty sections and
  // de-duplicate hrefs that appear in multiple sections (first wins).
  const seenHrefs = new Set<string>();
  const visibleSections = navigation
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.roles.includes(effectiveRole)) return false;
        if (seenHrefs.has(item.href)) return false;
        seenHrefs.add(item.href);
        return true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-[260px] flex-col bg-white border-r border-slate-200">
        {/* Brand */}
        <div className="flex h-20 flex-shrink-0 items-center gap-3 px-6 border-b border-slate-100">
          <Logo size={30} />
          <div className="min-w-0 flex-1">
            <span className="block text-lg font-black tracking-tight text-slate-900">
              Grad<span className="text-indigo-600">Logic</span>
            </span>
            <span className="block truncate text-[9px] font-semibold uppercase tracking-widest text-slate-400 leading-tight">
              {user?.college_name ?? "Talent & Placement Platform"}
            </span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          {visibleSections.map((section, si) => (
            <div key={section.title ?? `section-${si}`} className={si > 0 ? "mt-5" : ""}>
              {section.title && (
                <p className="px-4 pb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {section.title}
                </p>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    end={item.href === "/"}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${isActive
                        ? "bg-[#F0F5FF] text-blue-600 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`h-5 w-5 flex-shrink-0 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} strokeWidth={isActive ? 2 : 1.5} />
                        {item.name}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="ml-[260px] flex-1 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-20 items-center justify-end px-8 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
          <div className="flex items-center gap-6">
            <NotificationBell />

            <div className="h-8 w-px bg-slate-200"></div>

            {/* Profile & Logout */}
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex flex-col items-end">
                  <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-tight mt-0.5">
                    {ROLE_LABELS[user.role] ?? user.role}
                    {user.college_name && <span className="text-indigo-500 ml-1">({user.college_name})</span>}
                  </p>
                </div>
              )}
              
              <button
                onClick={() => { void logout().finally(() => { window.location.href = "/auth/login"; }); }}
                className="flex items-center justify-center p-2 rounded-xl text-slate-500 bg-slate-50 hover:bg-red-50 border border-slate-200 hover:border-red-100 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
