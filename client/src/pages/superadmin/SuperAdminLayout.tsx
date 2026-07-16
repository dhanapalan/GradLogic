import { useEffect, useState } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  GraduationCap,
  BarChart3,
  Settings,
  ChevronDown,
  LogOut,
  ClipboardCheck,
  Building2,
  Menu,
  X,
  BookOpenCheck,
  Wand2,
  Mic,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { logout } from "../../lib/logout";
import NotificationBell from "../../components/NotificationBell";

interface NavLeaf {
  name: string;
  href: string;
  hidden?: boolean;
}

interface NavGroup {
  name: string;
  children: NavLeaf[];
}

type NavChild = NavLeaf | NavGroup;

interface NavItem {
  name: string;
  icon: LucideIcon;
  /** Flat top-level link (Dashboard only). */
  href?: string;
  /** Accordion hub children. */
  children?: NavChild[];
}

const BASE = "/app/superadmin";

function isGroup(child: NavChild): child is NavGroup {
  return "children" in child && Array.isArray((child as NavGroup).children);
}

function collectHrefs(children: NavChild[]): string[] {
  const hrefs: string[] = [];
  for (const child of children) {
    if (isGroup(child)) {
      for (const leaf of child.children) {
        if (!leaf.hidden) hrefs.push(leaf.href);
      }
    } else if (!child.hidden) {
      hrefs.push(child.href);
    }
  }
  return hrefs;
}

function pathMatches(href: string, pathname: string, search: string) {
  const [path, query] = href.split("?");
  if (query) return pathname + search === href;
  // Exact leaf (e.g. knowledge-library dashboard) — not child routes.
  if (pathname === path) {
    return search === "" || !href.includes("?");
  }
  // Parent path ownership: /knowledge-library owns /knowledge-library/all, etc.
  // Dashboard leaf is exact-only so sibling hubs can compete cleanly.
  if (path === `${BASE}/knowledge-library`) return false;
  return pathname.startsWith(path + "/");
}

function hubOwnsRoute(item: NavItem, pathname: string, search: string) {
  if (!item.children) return false;
  return collectHrefs(item.children).some((href) => pathMatches(href, pathname, search));
}

/** Prefer the hub with the most specific (longest) matching leaf href. */
function resolveOpenHub(pathname: string, search: string): string | null {
  let bestName: string | null = null;
  let bestLen = -1;
  for (const item of NAV) {
    if (!item.children) continue;
    for (const href of collectHrefs(item.children)) {
      if (!pathMatches(href, pathname, search)) continue;
      if (href.length > bestLen) {
        bestLen = href.length;
        bestName = item.name;
      }
    }
  }
  return bestName;
}

// Accordion hubs: only top-level rows show by default. One hub open at a time.
const NAV: NavItem[] = [
  { name: "Dashboard", icon: LayoutDashboard, href: `${BASE}/dashboard` },
  {
    name: "Organization Management",
    icon: Building2,
    children: [
      { name: "Colleges", href: `${BASE}/colleges` },
      { name: "Faculty", href: `${BASE}/users?role=instructor` },
      { name: "Students", href: `${BASE}/students` },
      { name: "Batches", href: `${BASE}/batches` },
      { name: "Enrollments", href: `${BASE}/enrollments`, hidden: true },
      { name: "Certificates", href: `${BASE}/certificates` },
    ],
  },
  {
    name: "Learning Hub",
    icon: BookOpenCheck,
    children: [
      {
        name: "Knowledge Library",
        children: [
          { name: "Dashboard", href: `${BASE}/knowledge-library` },
          { name: "All Knowledge", href: `${BASE}/knowledge-library/all` },
          { name: "Lessons", href: `${BASE}/knowledge-library/assets/lessons` },
          { name: "Questions", href: `${BASE}/knowledge-library/assets/questions` },
          { name: "Flashcards", href: `${BASE}/knowledge-library/assets/flashcards` },
          { name: "Coding Challenges", href: `${BASE}/knowledge-library/assets/coding` },
          { name: "Case Studies", href: `${BASE}/knowledge-library/assets/case-studies` },
          { name: "Interview Questions", href: `${BASE}/knowledge-library/assets/interview-questions` },
          { name: "Voice Lessons", href: `${BASE}/knowledge-library/assets/voice-lessons` },
          { name: "Videos", href: `${BASE}/knowledge-library/assets/videos` },
          { name: "Documents", href: `${BASE}/knowledge-library/assets/documents` },
          { name: "Organization", href: `${BASE}/knowledge-library/organization` },
          { name: "Categories", href: `${BASE}/knowledge-library/organization/categories` },
          { name: "Subjects", href: `${BASE}/knowledge-library/organization/subjects` },
          { name: "Topics", href: `${BASE}/knowledge-library/organization/topics` },
          { name: "Skills", href: `${BASE}/knowledge-library/organization/skills` },
          { name: "Tags", href: `${BASE}/knowledge-library/organization/tags` },
          { name: "Collections", href: `${BASE}/knowledge-library/collections` },
          { name: "AI Features", href: `${BASE}/knowledge-library/ai` },
          { name: "Enterprise", href: `${BASE}/knowledge-library/enterprise` },
          { name: "Create Asset", href: `${BASE}/knowledge-library/create` },
        ],
      },
      { name: "AI Learning Companion", href: `${BASE}/learning-companion` },
      { name: "Course Builder", href: `${BASE}/course-builder` },
      { name: "Course Catalog", href: `${BASE}/course-catalog/tracks` },
      { name: "AI Learning Journey", href: `${BASE}/learning-journey` },
      { name: "Learning Resources", href: `${BASE}/knowledge-library/assets/documents` },
      { name: "Skills", href: `${BASE}/knowledge-library/organization/skills` },
      { name: "Topics", href: `${BASE}/knowledge-library/organization/topics` },
      { name: "Voice Lessons", href: `${BASE}/knowledge-library/assets/voice-lessons` },
    ],
  },
  {
    name: "Assessment Hub",
    icon: ClipboardCheck,
    children: [
      { name: "Dashboard", href: `${BASE}/assessment-hub` },
      { name: "Question Bank", href: `${BASE}/question-bank` },
      { name: "Question Collections", href: `${BASE}/question-collections` },
      { name: "Assessment Builder", href: `${BASE}/drives` },
      { name: "Assessment Templates", href: `${BASE}/assessment-templates` },
      { name: "Practice Sets", href: `${BASE}/practice-sets` },
      { name: "Mock Tests", href: `${BASE}/mock-tests` },
      { name: "Coding Assessments", href: `${BASE}/coding-assessments` },
      { name: "Results & Evaluation", href: `${BASE}/assessment-results` },
      { name: "Certificates", href: `${BASE}/certificates` },
      { name: "Analytics", href: `${BASE}/analytics/assessments` },
    ],
  },
  {
    name: "AI Studio",
    icon: Wand2,
    children: [
      { name: "Content Generator", href: `${BASE}/learning-companion/studio` },
      { name: "AI Review Center", href: `${BASE}/learning-companion/review` },
      { name: "AI Content Improver", href: `${BASE}/ai-studio/content-improver` },
      { name: "Voice Generator", href: `${BASE}/learning-companion/studio?kind=voice_lessons` },
      { name: "Translation Studio", href: `${BASE}/ai-studio/translation` },
      { name: "Prompt Manager", href: `${BASE}/ai-config?tab=prompts` },
      { name: "AI Models", href: `${BASE}/ai-config` },
      { name: "Embedding Manager", href: `${BASE}/ai-studio/embeddings` },
    ],
  },
  {
    name: "Voice Studio",
    icon: Mic,
    children: [
      { name: "Voice Lessons", href: `${BASE}/knowledge-library/assets/voice-lessons` },
      { name: "AI Tutor Voices", href: `${BASE}/voice-studio/tutor-voices` },
      { name: "Languages", href: `${BASE}/voice-studio/languages` },
      { name: "Audio Library", href: `${BASE}/voice-studio/audio-library` },
      { name: "Voice Templates", href: `${BASE}/voice-studio/templates` },
      { name: "Voice Analytics", href: `${BASE}/analytics/voice` },
    ],
  },
  {
    name: "Analytics",
    icon: BarChart3,
    children: [
      { name: "Platform", href: `${BASE}/analytics` },
      { name: "Learning", href: `${BASE}/analytics/learning` },
      { name: "Students", href: `${BASE}/analytics/students` },
      { name: "Assessments", href: `${BASE}/analytics/assessments` },
      { name: "Skills", href: `${BASE}/analytics/skills` },
      { name: "AI Usage", href: `${BASE}/learning-companion/analytics` },
      { name: "Voice Usage", href: `${BASE}/analytics/voice` },
      { name: "Reports", href: `${BASE}/analytics?view=reports` },
    ],
  },
  {
    name: "Administration",
    icon: Settings,
    children: [
      { name: "Users", href: `${BASE}/users` },
      { name: "Roles", href: `${BASE}/roles` },
      { name: "Permissions", href: `${BASE}/roles/matrix` },
      { name: "Notifications", href: `${BASE}/notifications` },
      { name: "Audit Logs", href: `${BASE}/audit-trail` },
      { name: "Branding", href: `${BASE}/branding` },
      { name: "Integrations", href: `${BASE}/integrations` },
      { name: "AI Configuration", href: `${BASE}/ai-config?tab=services` },
      { name: "Platform Settings", href: `${BASE}/settings` },
      { name: "License", href: `${BASE}/license` },
    ],
  },
];

function initials(name?: string) {
  if (!name) return "AU";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "AU";
}

export default function SuperAdminLayout() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Accordion: at most one hub open.
  const [openHub, setOpenHub] = useState<string | null>(null);
  // Nested group inside an open hub (e.g. Knowledge Library).
  const [openNested, setOpenNested] = useState<string | null>(null);

  const current = location.pathname + location.search;

  const leafActive = (href: string) => {
    if (href.includes("?")) return current === href;
    if (location.pathname !== href) return false;
    // Allow filter query strings on Knowledge Library asset routes.
    if (location.pathname.startsWith(`${BASE}/knowledge-library/`)) return true;
    return location.search === "";
  };

  // Sync open hub / nested group from the active route.
  useEffect(() => {
    const ownerName = resolveOpenHub(location.pathname, location.search);
    setOpenHub(ownerName);
    const owner = NAV.find((item) => item.name === ownerName);

    if (owner?.children) {
      const nested = owner.children.find(
        (child) =>
          isGroup(child) &&
          child.children.some((leaf) => !leaf.hidden && pathMatches(leaf.href, location.pathname, location.search))
      );
      setOpenNested(nested && isGroup(nested) ? nested.name : null);
    } else {
      setOpenNested(null);
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!token) window.location.href = "/auth/login";
  }, [token]);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const handleLogout = () => {
    void logout().finally(() => {
      window.location.href = "/auth/login";
    });
  };

  const toggleHub = (name: string) => {
    setOpenHub((prev) => {
      if (prev === name) {
        setOpenNested(null);
        return null;
      }
      setOpenNested(null);
      return name;
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

  const sidebar = (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent text-white shadow-admin-elegant">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-display font-semibold text-white">GradLogic</span>
            <span className="text-[11px] text-white/50">Admin Console</span>
          </div>
        </div>
        <button
          type="button"
          className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV.map((item) => {
          const Icon = item.icon;

          // Flat top-level link (Dashboard)
          if (!item.children) {
            return (
              <NavLink
                key={item.name}
                to={item.href!}
                className={flatClasses(leafActive(item.href!))}
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="flex-1">{item.name}</span>
              </NavLink>
            );
          }

          const isOpen = openHub === item.name;
          const owns = hubOwnsRoute(item, location.pathname, location.search);

          return (
            <div key={item.name}>
              <button
                type="button"
                onClick={() => toggleHub(item.name)}
                className={flatClasses(owns)}
                aria-expanded={isOpen}
              >
                <Icon className="h-[18px] w-[18px] flex-shrink-0" />
                <span className="flex-1 text-left">{item.name}</span>
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform duration-150 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isOpen && (
                <div className="ml-[1.15rem] mt-1 space-y-0.5 border-l border-white/10 pl-3">
                  {item.children.map((child) => {
                    if (isGroup(child)) {
                      const nestedOpen = openNested === child.name;
                      const nestedOwns = child.children.some(
                        (leaf) => !leaf.hidden && pathMatches(leaf.href, location.pathname, location.search)
                      );
                      return (
                        <div key={child.name}>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenNested((prev) => (prev === child.name ? null : child.name))
                            }
                            className={leafClasses(nestedOwns && !nestedOpen)}
                            aria-expanded={nestedOpen}
                          >
                            <span className="flex-1 text-left">{child.name}</span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 flex-shrink-0 text-white/40 transition-transform duration-150 ${
                                nestedOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                          {nestedOpen && (
                            <div className="ml-2 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                              {child.children
                                .filter((leaf) => !leaf.hidden)
                                .map((leaf) => (
                                  <NavLink
                                    key={leaf.href}
                                    to={leaf.href}
                                    className={leafClasses(leafActive(leaf.href))}
                                    onClick={() => setMobileOpen(false)}
                                  >
                                    <span className="flex-1">{leaf.name}</span>
                                  </NavLink>
                                ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (child.hidden) return null;
                    return (
                      <NavLink
                        key={child.href}
                        to={child.href}
                        className={leafClasses(leafActive(child.href))}
                        onClick={() => setMobileOpen(false)}
                      >
                        <span className="flex-1">{child.name}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

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
    <div className="admin-shell flex h-[100dvh] bg-slate-50">
      <aside className="hidden w-64 shrink-0 flex-col bg-navy-900 text-slate-300 md:flex">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(18rem,85vw)] flex-col bg-navy-900 text-slate-300 shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">Admin Console</p>
              <p className="hidden text-xs text-gray-500 sm:block">Platform operations</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
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

        <main className="min-w-0 flex-1 overflow-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
