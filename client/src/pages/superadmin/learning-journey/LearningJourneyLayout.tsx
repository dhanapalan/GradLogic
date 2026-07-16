// =============================================================================
// AI Learning Journey layout — personalized roadmaps powered by Companion
// =============================================================================

import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { LEARNING_JOURNEY_BASE as BASE } from "../../../services/learningJourneyService";

const TABS = [
  { name: "Dashboard", href: BASE },
  { name: "Journey Templates", href: `${BASE}/templates` },
  { name: "Student Journeys", href: `${BASE}/student-journeys` },
  { name: "Placement Tracks", href: `${BASE}/placement-tracks` },
  { name: "AI Recommendations", href: `${BASE}/ai-recommendations` },
  { name: "Milestones", href: `${BASE}/milestones` },
  { name: "Progress Monitoring", href: `${BASE}/progress` },
  { name: "Daily Learning Plan", href: `${BASE}/daily-plan` },
  { name: "Weekly Goals", href: `${BASE}/weekly-goals` },
  { name: "Revision Planner", href: `${BASE}/revision` },
  { name: "Journey Analytics", href: `${BASE}/analytics` },
];

export default function LearningJourneyLayout() {
  const location = useLocation();

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Learning Hub · AI-powered placement readiness
              </p>
              <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-navy-900" />
                AI Learning Journey
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Personalized roadmaps from skill assessment to placement-ready — Aptitude,
                Reasoning, Python, Java, and AI/ML — guided by the AI Learning Companion, not
                static course delivery.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/superadmin/learning-companion"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-navy-900/30"
              >
                AI Learning Companion
              </Link>
              <Link
                to={`${BASE}/templates`}
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
              >
                Journey Templates
              </Link>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map((tab) => {
              const active =
                tab.href === BASE
                  ? location.pathname === BASE || location.pathname === `${BASE}/`
                  : location.pathname.startsWith(tab.href);
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
