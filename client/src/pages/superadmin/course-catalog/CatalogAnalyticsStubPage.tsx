import { Link } from "react-router-dom";
import { COURSE_CATALOG_BASE as BASE } from "../../../services/courseCatalogService";

/** Inc 1 stub — deeper per-course drop-off analytics in a later increment. */
export default function CatalogAnalyticsStubPage() {
  return (
    <div className="max-w-xl rounded-xl border border-dashed border-gray-300 bg-white p-8">
      <h2 className="text-lg font-semibold text-gray-900">Course Catalog analytics</h2>
      <p className="mt-2 text-sm text-gray-500">
        Dashboard KPIs and Placement Track stats ship in Increment 1. Per-course drop-off, AI usage,
        and voice usage widgets reuse Course Builder analytics next.
      </p>
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        <Link to={BASE} className="text-admin-accent hover:underline">
          Catalog dashboard
        </Link>
        <Link
          to="/app/superadmin/course-builder/analytics"
          className="text-admin-accent hover:underline"
        >
          Course Builder analytics →
        </Link>
      </div>
    </div>
  );
}
