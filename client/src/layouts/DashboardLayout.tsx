import { useEffect } from "react";
import { Outlet, NavLink } from "react-router-dom";
import { authActions, useAuthStore } from "../stores/authStore";
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
  BuildingOffice2Icon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";

// ── Sidebar navigation items with role access control ────────────────────────

interface NavItem {
  name: string;
  href: string;
  icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;
  roles: AppRole[]; // which roles see this link
}

const navigation: NavItem[] = [
  // ── HR / Admin workflow ──────────────────────────────────────────────────────
  // 1. Overview
  {
    name: "HR Dashboard",
    href: "/app/hr-dashboard",
    icon: HomeIcon,
    roles: ["super_admin", "hr", "cxo"],
  },
  // 2. Onboard partner colleges
  {
    name: "CXO Analytics",
    href: "/app/cxo-analytics",
    icon: ChartBarIcon,
    roles: ["cxo", "super_admin"],
  },
  {
    name: "Campuses",
    href: "/app/campuses",
    icon: AcademicCapIcon,
    roles: ["super_admin", "hr"],
  },
  // 3. Define scoring / cutoff rules before creating drives
  {
    name: "Assessment Rules",
    href: "/app/assessment-rules",
    icon: ClipboardDocumentListIcon,
    roles: ["super_admin", "hr", "engineer"],
  },
  {
    name: "JD Extractor",
    href: "/app/company/jd-extract",
    icon: SparklesIcon,
    roles: ["super_admin", "hr", "engineer"],
  },
  // 4. Create and manage assessment drives
  {
    name: "Drives",
    href: "/app/drives",
    icon: RocketLaunchIcon,
    roles: ["super_admin", "hr", "engineer"],
  },
  // 5. Review registered candidates
  {
    name: "Students",
    href: "/app/students",
    icon: UsersIcon,
    roles: ["super_admin", "hr", "cxo"],
  },
  // 6. Monitor live exams
  {
    name: "Live Monitoring",
    href: "/app/admin/monitoring",
    icon: EyeIcon,
    roles: ["super_admin", "hr", "cxo"],
  },
  // 7. Track placements
  {
    name: "Placements",
    href: "/app/placements",
    icon: TrophyIcon,
    roles: ["super_admin", "hr", "college_admin"],
  },
  // 8. User / system management
  {
    name: "Administration",
    href: "/app/administration",
    icon: WrenchScrewdriverIcon,
    roles: ["super_admin", "admin", "hr", "cxo"],
  },

  // ── Engineer workflow ────────────────────────────────────────────────────────
  {
    name: "Engineer Panel",
    href: "/app/engineer-panel",
    icon: WrenchScrewdriverIcon,
    roles: ["engineer"],
  },

  // ── College / Campus Portal workflow ────────────────────────────────────────
  // 1. Overview
  {
    name: "Dashboard",
    href: "/app/college-dashboard",
    icon: HomeIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 2. View assigned drives
  {
    name: "Drives",
    href: "/app/college/drives",
    icon: RocketLaunchIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 3. Manage students in the college
  {
    name: "Students",
    href: "/app/students",
    icon: UsersIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 4. View results after drives complete
  {
    name: "Results",
    href: "/app/college/results",
    icon: ClipboardDocumentListIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 5. Analytics & trends
  {
    name: "Insights",
    href: "/app/college/insights",
    icon: ChartBarIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 6. Proctoring / academic integrity
  {
    name: "Integrity",
    href: "/app/college/integrity",
    icon: ShieldCheckIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 7. Announcements & messages
  {
    name: "Communications",
    href: "/app/college/communications",
    icon: EnvelopeIcon,
    roles: ["college_admin", "college", "college_staff"],
  },
  // 8. Manage college staff accounts
  {
    name: "Campus Admins",
    href: "/app/college/campus-admins",
    icon: UserGroupIcon,
    roles: ["college_admin", "college"],
  },
  // 9. College settings
  {
    name: "Settings",
    href: "/app/college/settings",
    icon: Cog6ToothIcon,
    roles: ["college_admin", "college"],
  },

  // ── Student Portal ───────────────────────────────────────────────────────────
  {
    name: "Student Portal",
    href: "/app/student-portal",
    icon: HomeIcon,
    roles: ["student"],
  },
  {
    name: "Exams",
    href: "/app/student-portal?tab=exams",
    icon: AcademicCapIcon,
    roles: ["student"],
  },
  {
    name: "Learning Portal",
    href: "/app/learn",
    icon: AcademicCapIcon,
    roles: ["student"],
  },
  {
    name: "Course Catalog",
    href: "/app/lms/catalog",
    icon: BookOpenIcon,
    roles: ["student"],
  },
  {
    name: "Practice Arena",
    href: "/app/student-portal/practice",
    icon: PuzzlePieceIcon,
    roles: ["student"],
  },
  {
    name: "Development",
    href: "/app/student-portal/development",
    icon: SparklesIcon,
    roles: ["student"],
  },
  {
    name: "Achievements",
    href: "/app/student-portal/gamification",
    icon: TrophyIcon,
    roles: ["student"],
  },

  // ── Company Portal ───────────────────────────────────────────────────────────
  {
    name: "Dashboard",
    href: "/app/company",
    icon: BuildingOffice2Icon,
    roles: ["company"],
  },
  {
    name: "Candidates",
    href: "/app/company/candidates",
    icon: UsersIcon,
    roles: ["company"],
  },
  {
    name: "My Drives",
    href: "/app/drives",
    icon: RocketLaunchIcon,
    roles: ["company"],
  },
  {
    name: "JD Extractor",
    href: "/app/company/jd-extract",
    icon: SparklesIcon,
    roles: ["company"],
  },
  {
    name: "Company Profile",
    href: "/app/company/profile",
    icon: UserCircleIcon,
    roles: ["company"],
  },

  // ── Mentor Portal ─────────────────────────────────────────────────────────────
  {
    name: "My Students",
    href: "/app/mentor",
    icon: UserGroupIcon,
    roles: ["mentor"],
  },
  // ── Instructor Portal ────────────────────────────────────────────────────────
  {
    name: "Course Builder",
    href: "/app/lms/builder",
    icon: BookOpenIcon,
    roles: ["instructor"],
  },
  {
    name: "Course Catalog",
    href: "/app/lms/catalog",
    icon: BookOpenIcon,
    roles: ["instructor"],
  },


  // ── Skill Development Layer (HR/Admin) ───────────────────────────────────────
  {
    name: "Skills",
    href: "/app/skills",
    icon: AcademicCapIcon,
    roles: ["super_admin", "hr", "cxo"],
  },
  {
    name: "Learning Modules",
    href: "/app/learning-modules",
    icon: ClipboardDocumentListIcon,
    roles: ["super_admin", "hr", "cxo"],
  },
  {
    name: "Skill Programs",
    href: "/app/skill-programs",
    icon: RocketLaunchIcon,
    roles: ["super_admin", "hr", "cxo"],
  },
  {
    name: "Skill Partners",
    href: "/app/skill-partners",
    icon: UserGroupIcon,
    roles: ["super_admin", "hr", "cxo"],
  },

  // ── LMS management (HR/Admin) ────────────────────────────────────────────────
  {
    name: "Course Builder",
    href: "/app/lms/builder",
    icon: BookOpenIcon,
    roles: ["super_admin", "hr"],
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

  // Filter navigation items to only those the user's role can see
  const visibleNav = navigation.filter((item) =>
    item.roles.includes(effectiveRole),
  );

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
        <nav className="flex-1 overflow-y-auto space-y-1.5 px-4 py-6">
          {visibleNav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === "/"}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-all ${isActive
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
                onClick={() => authActions.logout()}
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
