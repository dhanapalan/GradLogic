// Tags facet view — free-text tags (promote into Topics from Topics page)
import { Link } from "react-router-dom";
import TopicsPage from "../learning-companion/TopicsPage";

export default function TagsOrgPage() {
  return (
    <div className="space-y-3">
      <div>
        <Link to="/app/superadmin/knowledge-library/organization" className="text-xs text-admin-accent hover:underline">
          ← Organization
        </Link>
        <p className="text-sm text-gray-500 mt-2">
          Free-text tags remain searchable metadata. Promote popular tags into formal Topics when ready.
        </p>
      </div>
      <TopicsPage />
    </div>
  );
}
