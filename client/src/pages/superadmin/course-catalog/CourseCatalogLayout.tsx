// =============================================================================
// Course Catalog layout — Placement Tracks are the centerpiece
// =============================================================================

import { NavLink, Outlet, useLocation, Link } from "react-router-dom";
import { Compass, Plus } from "lucide-react";
import { COURSE_CATALOG_BASE as BASE } from "../../../services/courseCatalogService";

const TABS = [
  { name: "Placement Tracks", href: `${BASE}/tracks` },
  { name: "Dashboard", href: BASE },
  { name: "All Courses", href: `${BASE}/all` },
  { name: "Featured", href: `${BASE}/featured` },
  { name: "Recently Published", href: `${BASE}/recent` },
  { name: "Drafts", href: `${BASE}/drafts` },
  { name: "Archived", href: `${BASE}/archived` },
  { name: "Analytics", href: `${BASE}/analytics` },
];

export default function CourseCatalogLayout() {
  const location = useLocation();

  return (
    <div className="min-h-full bg-slate-50/80">
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Learning Hub · Discover & publish
              </p>
              <h1 className="mt-1 text-xl sm:text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Compass className="w-6 h-6 text-navy-900" />
                Course Catalog
              </h1>
              <p className="mt-1 text-sm text-gray-500 max-w-2xl">
                Placement Tracks first — then browse, publish, and assign courses to colleges.
                Assembly stays in Course Builder.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/app/superadmin/course-builder"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-navy-900/30"
              >
                Open Course Builder
              </Link>
              <Link
                to="/app/superadmin/course-builder/new"
                className="inline-flex items-center gap-2 rounded-lg bg-navy-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
              >
                <Plus className="w-4 h-4" />
                New Course
              </Link>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto -mb-px">
            {TABS.map((tab) => {
              const active =
                tab.href === BASE
                  ? location.pathname === BASE
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
