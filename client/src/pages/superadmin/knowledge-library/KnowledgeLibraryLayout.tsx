// =============================================================================
// Knowledge Library — shared layout (Sprint 1+2 secondary nav)
// =============================================================================

import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { Library, Plus } from "lucide-react";

const BASE = "/app/superadmin/knowledge-library";

const TABS = [
  { name: "Dashboard", href: BASE },
  { name: "All Knowledge", href: `${BASE}/all` },
  { name: "Lessons", href: `${BASE}/assets/lessons` },
  { name: "Questions", href: `${BASE}/assets/questions` },
  { name: "Flashcards", href: `${BASE}/assets/flashcards` },
  { name: "Coding", href: `${BASE}/assets/coding` },
  { name: "Cases", href: `${BASE}/assets/case-studies` },
  { name: "Interview", href: `${BASE}/assets/interview-questions` },
  { name: "Voice", href: `${BASE}/assets/voice-lessons` },
  { name: "Videos", href: `${BASE}/assets/videos` },
  { name: "Documents", href: `${BASE}/assets/documents` },
  { name: "Organization", href: `${BASE}/organization` },
  { name: "Collections", href: `${BASE}/collections` },
  { name: "AI Features", href: `${BASE}/ai` },
  { name: "Enterprise", href: `${BASE}/enterprise` },
];

export default function KnowledgeLibraryLayout() {
  const location = useLocation();
  const current = location.pathname + location.search;

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Learning Hub · Core repository
              </p>
              <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Library className="w-6 h-6 text-navy-900" />
                Knowledge Library
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Netflix for learning — every asset type in one repository for Companion, Courses,
                Assessments, and Voice Tutor.
              </p>
            </div>
            <Link
              to={`${BASE}/create`}
              className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
            >
              <Plus className="w-4 h-4" />
              Create Knowledge Asset
            </Link>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map((tab) => {
              const pathOnly = tab.href.split("?")[0];
              const active =
                tab.href === BASE
                  ? location.pathname === BASE
                  : pathOnly.endsWith("/organization")
                    ? location.pathname.startsWith(`${BASE}/organization`) ||
                      /\/knowledge-library\/topics\//.test(location.pathname)
                    : pathOnly.endsWith("/ai")
                      ? location.pathname.startsWith(`${BASE}/ai`)
                      : pathOnly.endsWith("/enterprise")
                        ? location.pathname.startsWith(`${BASE}/enterprise`)
                        : current.startsWith(pathOnly);
              return (
                <NavLink
                  key={tab.href}
                  to={tab.href}
                  end={tab.href === BASE}
                  className={`shrink-0 px-3 py-2.5 text-sm border-b-2 transition-colors ${
                    active
                      ? "border-navy-900 font-medium text-navy-900"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab.name}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <Outlet />
      </div>
    </div>
  );
}
